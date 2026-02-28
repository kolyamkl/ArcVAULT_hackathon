import { getAddress } from "viem";
import type { IUSYCAdapter, TxResult, YieldDataPoint } from "@/types/integrations";

export class RealUSYCAdapter implements IUSYCAdapter {
  private vaultAddress: `0x${string}`;
  private usycAddress: `0x${string}`;

  constructor() {
    this.vaultAddress = getAddress((process.env.NEXT_PUBLIC_TREASURY_VAULT_ADDRESS ?? '0x0').trim());
    this.usycAddress = getAddress((process.env.NEXT_PUBLIC_USYC_ADDRESS ?? '0x0').trim());
  }

  async deposit(amount: bigint): Promise<TxResult> {
    // In production: call TreasuryVault.sweepToUSYC via walletClient
    void amount;
    throw new Error("RealUSYCAdapter requires on-chain client configuration");
  }

  async redeem(amount: bigint): Promise<TxResult> {
    void amount;
    throw new Error("RealUSYCAdapter requires on-chain client configuration");
  }

  async getBalance(address: string): Promise<bigint> {
    void address;
    throw new Error("RealUSYCAdapter requires on-chain client configuration");
  }

  async getCurrentRate(): Promise<number> {
    throw new Error("RealUSYCAdapter requires on-chain client configuration");
  }

  async getYieldHistory(days: number): Promise<YieldDataPoint[]> {
    const { prisma } = await import("@/lib/prisma");
    const since = new Date(Date.now() - days * 86_400_000);
    const snapshots = await prisma.vaultSnapshot.findMany({
      where: { timestamp: { gte: since } },
      orderBy: { timestamp: "asc" },
    });
    return snapshots.map((s) => ({
      timestamp: s.timestamp,
      apy: Number(s.apy),
      totalValue: Number(s.totalValue),
    }));
  }
}

export class MockUSYCAdapter implements IUSYCAdapter {
  private balance: bigint = 450_000_000_000n; // $450K with 6 decimals
  private rate = 4.85;

  async deposit(amount: bigint): Promise<TxResult> {
    this.balance += amount;
    return {
      txHash: `0x${"a".repeat(64)}`,
      blockNumber: 1_000_000 + Math.floor(Math.random() * 1000),
      status: "success",
    };
  }

  async redeem(amount: bigint): Promise<TxResult> {
    if (amount > this.balance) {
      return { txHash: `0x${"0".repeat(64)}`, blockNumber: 0, status: "failed" };
    }
    this.balance -= amount;
    return {
      txHash: `0x${"b".repeat(64)}`,
      blockNumber: 1_000_000 + Math.floor(Math.random() * 1000),
      status: "success",
    };
  }

  async getBalance(_address: string): Promise<bigint> {
    return this.balance;
  }

  async getCurrentRate(): Promise<number> {
    return this.rate;
  }

  async getYieldHistory(days: number): Promise<YieldDataPoint[]> {
    const points: YieldDataPoint[] = [];
    const now = Date.now();
    for (let i = days; i >= 0; i--) {
      points.push({
        timestamp: new Date(now - i * 86_400_000),
        apy: this.rate + (Math.random() - 0.5) * 0.3,
        totalValue: 450_000 + Math.random() * 5_000,
      });
    }
    return points;
  }
}
