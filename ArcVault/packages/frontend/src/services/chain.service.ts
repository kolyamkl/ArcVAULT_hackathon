import prisma from "@/lib/prisma";
import { getPublicClient } from "@/lib/viem-server";
import {
  TreasuryVaultABI,
  PayoutRouterABI,
  TREASURY_VAULT_ADDRESS,
  PAYOUT_ROUTER_ADDRESS,
} from "@/lib/contracts";

let lastProcessedBlock: bigint = 0n;

function mapVaultEventToType(eventName: string): string | null {
  const map: Record<string, string> = {
    Deposited: "DEPOSIT",
    Withdrawn: "WITHDRAW",
    SweptToUSYC: "SWEEP",
    RedeemedFromUSYC: "REDEEM",
    ThresholdUpdated: "THRESHOLD_UPDATE",
  };
  return map[eventName] ?? null;
}

/**
 * Index TreasuryVault events from on-chain logs and upsert into the Transaction table.
 */
export async function indexContractEvents(): Promise<void> {
  const publicClient = getPublicClient();

  // If we haven't processed any blocks yet, start from latest - 1000
  if (lastProcessedBlock === 0n) {
    const currentBlock = await publicClient.getBlockNumber();
    lastProcessedBlock = currentBlock > 1000n ? currentBlock - 1000n : 0n;
  }

  const currentBlock = await publicClient.getBlockNumber();
  if (currentBlock <= lastProcessedBlock) return;

  const logs = await publicClient.getLogs({
    address: TREASURY_VAULT_ADDRESS,
    fromBlock: lastProcessedBlock + 1n,
    toBlock: currentBlock,
  });

  for (const log of logs) {
    try {
      const { decodeEventLog } = await import("viem");
      const decoded = decodeEventLog({
        abi: TreasuryVaultABI,
        data: log.data,
        topics: log.topics,
      });

      const txType = mapVaultEventToType(decoded.eventName);
      if (!txType) continue;

      const args = (decoded.args ?? {}) as Record<string, unknown>;
      const amount = ((args.amount ?? args.value ?? 0n) as bigint).toString();

      await prisma.transaction.upsert({
        where: { txHash: log.transactionHash ?? `block-${log.blockNumber}-${log.logIndex}` },
        create: {
          type: txType,
          txHash: log.transactionHash ?? `block-${log.blockNumber}-${log.logIndex}`,
          amount,
          currency: "USDC",
          status: "COMPLETED",
          metadata: { eventName: decoded.eventName, blockNumber: Number(log.blockNumber) },
          chainId: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID) || 1397,
        },
        update: {},
      });
    } catch {
      // Skip logs we can't decode (not from our contract events)
    }
  }

  lastProcessedBlock = currentBlock;
  console.log(`[chain.service] Indexed events up to block ${currentBlock}`);
}

/**
 * Read real on-chain balances from TreasuryVault and write a VaultSnapshot.
 */
export async function takeVaultSnapshot(): Promise<void> {
  const publicClient = getPublicClient();

  const [liquidBalance, usycBalance, totalValue, yieldAccrued] = await Promise.all([
    publicClient.readContract({
      address: TREASURY_VAULT_ADDRESS,
      abi: TreasuryVaultABI,
      functionName: "getLiquidBalance",
    }) as Promise<bigint>,
    publicClient.readContract({
      address: TREASURY_VAULT_ADDRESS,
      abi: TreasuryVaultABI,
      functionName: "getUSYCBalance",
    }) as Promise<bigint>,
    publicClient.readContract({
      address: TREASURY_VAULT_ADDRESS,
      abi: TreasuryVaultABI,
      functionName: "getTotalValue",
    }) as Promise<bigint>,
    publicClient.readContract({
      address: TREASURY_VAULT_ADDRESS,
      abi: TreasuryVaultABI,
      functionName: "getYieldAccrued",
    }) as Promise<bigint>,
  ]);

  // Convert from 6 decimal USDC to human-readable
  const toUsdc = (v: bigint) => (Number(v) / 1e6).toFixed(2);

  // Compute APY: yieldAccrued / totalValue * 100, annualised
  const tvNum = Number(totalValue);
  const yieldNum = Number(yieldAccrued);
  const apy = tvNum > 0 ? (yieldNum / tvNum) * 100 : 0;

  await prisma.vaultSnapshot.create({
    data: {
      liquidUSDC: toUsdc(liquidBalance),
      usycBalance: toUsdc(usycBalance),
      totalValue: toUsdc(totalValue),
      yieldAccrued: toUsdc(yieldAccrued),
      apy,
      timestamp: new Date(),
    },
  });

  console.log(`[chain.service] Vault snapshot taken: total=$${toUsdc(totalValue)}`);
}

export async function getVaultStatus() {
  const snapshot = await prisma.vaultSnapshot.findFirst({
    orderBy: { timestamp: "desc" },
  });

  if (!snapshot) {
    return {
      liquidUSDC: "0",
      usycBalance: "0",
      totalValue: "0",
      threshold: "50000",
    };
  }

  return {
    liquidUSDC: snapshot.liquidUSDC.toString(),
    usycBalance: snapshot.usycBalance.toString(),
    totalValue: snapshot.totalValue.toString(),
    threshold: "50000",
  };
}

/**
 * Query PayoutRouter for pending payouts and update their status in the DB.
 */
export async function syncPayoutStatuses(): Promise<void> {
  const publicClient = getPublicClient();

  const pendingPayouts = await prisma.payout.findMany({
    where: { status: { in: ["PENDING", "PROCESSING"] } },
  });

  if (pendingPayouts.length === 0) return;

  for (const payout of pendingPayouts) {
    try {
      const result = await publicClient.readContract({
        address: PAYOUT_ROUTER_ADDRESS,
        abi: PayoutRouterABI,
        functionName: "getPayoutStatus",
        args: [BigInt(payout.onChainId)],
      }) as {
        recipient: string;
        amount: bigint;
        targetCurrency: string;
        paymentRef: string;
        status: number;
        timestamp: bigint;
        outputAmount: bigint;
      };

      // Map on-chain status enum: 0=Pending, 1=Processing, 2=Completed, 3=Failed
      const statusMap: Record<number, string> = {
        0: "PENDING",
        1: "PROCESSING",
        2: "COMPLETED",
        3: "FAILED",
      };
      const newStatus = statusMap[result.status] ?? "PENDING";

      if (newStatus !== payout.status) {
        await prisma.payout.update({
          where: { id: payout.id },
          data: { status: newStatus },
        });
      }
    } catch (err) {
      console.error(`[chain.service] Failed to sync payout ${payout.id}:`, err);
    }
  }

  console.log(`[chain.service] Synced ${pendingPayouts.length} payout statuses`);
}
