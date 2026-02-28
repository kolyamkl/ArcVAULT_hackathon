# 08 — External Integration Adapters Specification

> **Scope:** Adapter-pattern service layer that abstracts USYC yield, StableFX foreign exchange, CPN payments, and on-chain event indexing behind swappable real/mock implementations.
> All adapters live under `packages/frontend/src/services/` and are consumed exclusively by the API routes documented in `docs/technical/07-api-routes.md`.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Shared Types](#shared-types)
3. [Adapter 1 — USYC (Yield)](#adapter-1--usyc-yield)
4. [Adapter 2 — StableFX (Foreign Exchange)](#adapter-2--stablefx-foreign-exchange)
5. [Adapter 3 — CPN (Cross-border Payments)](#adapter-3--cpn-cross-border-payments)
6. [On-Chain Data Indexing — chain.service.ts](#on-chain-data-indexing--chainservicets)
7. [Factory & Barrel Export](#factory--barrel-export)
8. [Environment Variables](#environment-variables)
9. [Files to Create / Modify](#files-to-create--modify)
10. [Cross-references](#cross-references)

---

## Architecture Overview

Every external dependency follows the same pattern:

```
ENV: INTEGRATION_MODE = "real" | "mock"
                │
    ┌───────────┴───────────┐
    │   TypeScript Interface │
    └───────┬───────┬───────┘
            │       │
     ┌──────┘       └──────┐
     ▼                      ▼
 RealAdapter            MockAdapter
 (HTTP / on-chain)      (deterministic simulation)
```

**Key rules:**

- Interfaces are defined in `packages/frontend/src/types/integrations.ts`.
- Each adapter file exports **both** the real and mock class.
- A factory function in `packages/frontend/src/services/index.ts` returns the correct implementation based on `process.env.INTEGRATION_MODE`.
- The **mock** implementation is the default (env var missing or set to `"mock"`).
- Mock adapters must be deterministic enough for demo purposes but introduce realistic latencies and data shapes.

---

## Shared Types

**File:** `packages/frontend/src/types/integrations.ts`

```typescript
// ── Common ───────────────────────────────────────────────────────────

export type TxResult = {
  txHash: string;
  blockNumber: number;
  status: "success" | "failed";
};

// ── USYC ─────────────────────────────────────────────────────────────

export type YieldDataPoint = {
  timestamp: Date;
  apy: number;
  totalValue: number;
};

export interface IUSYCAdapter {
  /** Deposit USDC into the USYC yield source. */
  deposit(amount: bigint): Promise<TxResult>;
  /** Redeem USYC back to USDC. */
  redeem(amount: bigint): Promise<TxResult>;
  /** Get the USYC token balance for a given address. */
  getBalance(address: string): Promise<bigint>;
  /** Get the current yield rate as an annual percentage. */
  getCurrentRate(): Promise<number>;
  /** Historical yield data points for charting. */
  getYieldHistory(days: number): Promise<YieldDataPoint[]>;
}

// ── StableFX ─────────────────────────────────────────────────────────

export type FXQuoteResult = {
  quoteId: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  toAmount: string;
  rate: number;
  spread: number;
  expiresAt: Date;
};

export type SwapResult = {
  txHash: string;
  fromAmount: string;
  toAmount: string;
  rate: number;
  status: "success" | "failed";
};

export type CurrencyPair = {
  from: string;
  to: string;
  rate: number;
  spread: number;
};

export interface IStableFXAdapter {
  /** Request a firm quote for a currency swap. */
  getQuote(from: string, to: string, amount: bigint): Promise<FXQuoteResult>;
  /** Execute a previously received quote. */
  executeSwap(quoteId: string): Promise<SwapResult>;
  /** Return all supported trading pairs with current indicative rates. */
  getSupportedPairs(): Promise<CurrencyPair[]>;
}

// ── CPN ──────────────────────────────────────────────────────────────

export type CPNPaymentParams = {
  recipient: string;
  amount: string;
  currency: string;
  reference: string;
  metadata?: Record<string, string>;
};

export type CPNPaymentResult = {
  paymentId: string;
  status: "initiated" | "processing" | "completed" | "failed";
  estimatedCompletion: Date;
};

export type CPNStatus = {
  paymentId: string;
  status: "initiated" | "processing" | "settled" | "failed";
  settledAt?: Date;
  failureReason?: string;
};

export type ComplianceResult = {
  address: string;
  compliant: boolean;
  riskScore: number; // 0-100
  checks: string[];
};

export interface ICPNAdapter {
  /** Initiate a cross-border payment via the Circle Payments Network. */
  sendPayment(params: CPNPaymentParams): Promise<CPNPaymentResult>;
  /** Poll for the current status of a previously initiated payment. */
  getPaymentStatus(paymentId: string): Promise<CPNStatus>;
  /** Run KYC / sanctions checks on an address before sending funds. */
  verifyCompliance(address: string): Promise<ComplianceResult>;
}
```

---

## Adapter 1 — USYC (Yield)

**File:** `packages/frontend/src/services/usyc.service.ts`

### Real Implementation: `RealUSYCAdapter`

Communicates directly with on-chain contracts via viem.

```typescript
import { publicClient, walletClient } from "@/lib/contracts";
import { treasuryVaultAbi } from "@/lib/abis/TreasuryVault";
import { mockUSYCAbi } from "@/lib/abis/MockUSYC";
import type { IUSYCAdapter, TxResult, YieldDataPoint } from "@/types/integrations";

export class RealUSYCAdapter implements IUSYCAdapter {
  private vaultAddress: `0x${string}`;
  private usycAddress: `0x${string}`;

  constructor() {
    this.vaultAddress = process.env.NEXT_PUBLIC_TREASURY_VAULT_ADDRESS as `0x${string}`;
    this.usycAddress = process.env.NEXT_PUBLIC_USYC_ADDRESS as `0x${string}`;
  }

  async deposit(amount: bigint): Promise<TxResult> {
    const hash = await walletClient.writeContract({
      address: this.vaultAddress,
      abi: treasuryVaultAbi,
      functionName: "sweepToUSYC",
      args: [amount],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return {
      txHash: receipt.transactionHash,
      blockNumber: Number(receipt.blockNumber),
      status: receipt.status === "success" ? "success" : "failed",
    };
  }

  async redeem(amount: bigint): Promise<TxResult> {
    const hash = await walletClient.writeContract({
      address: this.vaultAddress,
      abi: treasuryVaultAbi,
      functionName: "redeemFromUSYC",
      args: [amount],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return {
      txHash: receipt.transactionHash,
      blockNumber: Number(receipt.blockNumber),
      status: receipt.status === "success" ? "success" : "failed",
    };
  }

  async getBalance(address: string): Promise<bigint> {
    return publicClient.readContract({
      address: this.usycAddress,
      abi: mockUSYCAbi,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });
  }

  async getCurrentRate(): Promise<number> {
    const rate = await publicClient.readContract({
      address: this.usycAddress,
      abi: mockUSYCAbi,
      functionName: "yieldRate",
    });
    return Number(rate) / 100; // stored as basis points (485 → 4.85)
  }

  async getYieldHistory(days: number): Promise<YieldDataPoint[]> {
    // Query VaultSnapshot table for historical data
    const { prisma } = await import("@/lib/prisma");
    const since = new Date(Date.now() - days * 86_400_000);
    const snapshots = await prisma.vaultSnapshot.findMany({
      where: { timestamp: { gte: since } },
      orderBy: { timestamp: "asc" },
    });
    return snapshots.map((s) => ({
      timestamp: s.timestamp,
      apy: s.apy,
      totalValue: Number(s.totalValue),
    }));
  }
}
```

### Mock Implementation: `MockUSYCAdapter`

```typescript
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
        apy: this.rate + (Math.random() - 0.5) * 0.3, // 4.85 +/- 0.15
        totalValue: 450_000 + Math.random() * 5_000,
      });
    }
    return points;
  }
}
```

---

## Adapter 2 — StableFX (Foreign Exchange)

**File:** `packages/frontend/src/services/stablefx.service.ts`

### Real Implementation: `RealStableFXAdapter`

Communicates with the StableFX RFQ (Request-for-Quote) REST API.

```typescript
import type { IStableFXAdapter, FXQuoteResult, SwapResult, CurrencyPair } from "@/types/integrations";

export class RealStableFXAdapter implements IStableFXAdapter {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.STABLEFX_API_URL!;
    this.apiKey = process.env.STABLEFX_API_KEY!;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`StableFX API error ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async getQuote(from: string, to: string, amount: bigint): Promise<FXQuoteResult> {
    return this.request<FXQuoteResult>("/v1/quotes", {
      method: "POST",
      body: JSON.stringify({ fromCurrency: from, toCurrency: to, amount: amount.toString() }),
    });
  }

  async executeSwap(quoteId: string): Promise<SwapResult> {
    return this.request<SwapResult>(`/v1/quotes/${quoteId}/execute`, {
      method: "POST",
    });
  }

  async getSupportedPairs(): Promise<CurrencyPair[]> {
    return this.request<CurrencyPair[]>("/v1/pairs");
  }
}
```

### Mock Implementation: `MockStableFXAdapter`

```typescript
import { randomUUID } from "crypto";
import type { IStableFXAdapter, FXQuoteResult, SwapResult, CurrencyPair } from "@/types/integrations";

// Mid-market rates (USDC base)
const MID_RATES: Record<string, number> = {
  "USDC/EURC": 0.9235,
  "USDC/GBPC": 0.7892,
  "USDC/JPYC": 149.5,
  "USDC/CADC": 1.365,
};

// Stored quotes (in-memory for mock)
const quoteStore = new Map<string, FXQuoteResult>();

export class MockStableFXAdapter implements IStableFXAdapter {
  async getSupportedPairs(): Promise<CurrencyPair[]> {
    return Object.entries(MID_RATES).map(([pair, rate]) => {
      const [from, to] = pair.split("/");
      const spread = 0.0003 + Math.random() * 0.0005; // 0.03% - 0.08%
      return { from, to, rate, spread };
    });
  }

  async getQuote(from: string, to: string, amount: bigint): Promise<FXQuoteResult> {
    const pairKey = `${from}/${to}`;
    const midRate = MID_RATES[pairKey];
    if (!midRate) {
      throw new Error(`Unsupported pair: ${pairKey}`);
    }

    const spread = 0.0003 + Math.random() * 0.0005; // 0.03% - 0.08%
    const adjustedRate = midRate * (1 - spread); // slightly worse than mid for buyer
    const fromAmount = amount.toString();
    const toAmount = (Number(amount) * adjustedRate).toFixed(0);

    const quote: FXQuoteResult = {
      quoteId: randomUUID(),
      fromCurrency: from,
      toCurrency: to,
      fromAmount,
      toAmount,
      rate: adjustedRate,
      spread,
      expiresAt: new Date(Date.now() + 30_000), // 30 second expiry
    };

    quoteStore.set(quote.quoteId, quote);
    return quote;
  }

  async executeSwap(quoteId: string): Promise<SwapResult> {
    const quote = quoteStore.get(quoteId);
    if (!quote) {
      throw new Error(`Quote not found: ${quoteId}`);
    }
    if (new Date() > quote.expiresAt) {
      throw new Error("Quote has expired");
    }

    // Simulate 1-3 second processing delay
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    quoteStore.delete(quoteId);

    return {
      txHash: `0x${randomUUID().replace(/-/g, "")}${"0".repeat(32)}`.slice(0, 66),
      fromAmount: quote.fromAmount,
      toAmount: quote.toAmount,
      rate: quote.rate,
      status: "success",
    };
  }
}
```

---

## Adapter 3 — CPN (Cross-border Payments)

**File:** `packages/frontend/src/services/cpn.service.ts`

### Real Implementation: `RealCPNAdapter`

Communicates with the Circle Payments Network REST API.

```typescript
import type {
  ICPNAdapter,
  CPNPaymentParams,
  CPNPaymentResult,
  CPNStatus,
  ComplianceResult,
} from "@/types/integrations";

export class RealCPNAdapter implements ICPNAdapter {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.CPN_API_URL!;
    this.apiKey = process.env.CPN_API_KEY!;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`CPN API error ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async sendPayment(params: CPNPaymentParams): Promise<CPNPaymentResult> {
    return this.request<CPNPaymentResult>("/v1/payments", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async getPaymentStatus(paymentId: string): Promise<CPNStatus> {
    return this.request<CPNStatus>(`/v1/payments/${paymentId}`);
  }

  async verifyCompliance(address: string): Promise<ComplianceResult> {
    return this.request<ComplianceResult>(`/v1/compliance/check`, {
      method: "POST",
      body: JSON.stringify({ address }),
    });
  }
}
```

### Mock Implementation: `MockCPNAdapter`

```typescript
import { randomUUID } from "crypto";
import type {
  ICPNAdapter,
  CPNPaymentParams,
  CPNPaymentResult,
  CPNStatus,
  ComplianceResult,
} from "@/types/integrations";

// In-memory store for tracking mock payment creation timestamps
const paymentTimestamps = new Map<string, number>();

export class MockCPNAdapter implements ICPNAdapter {
  async sendPayment(params: CPNPaymentParams): Promise<CPNPaymentResult> {
    const paymentId = randomUUID();
    const now = Date.now();
    paymentTimestamps.set(paymentId, now);

    return {
      paymentId,
      status: "initiated",
      estimatedCompletion: new Date(now + 60_000), // 1 minute from now
    };
  }

  async getPaymentStatus(paymentId: string): Promise<CPNStatus> {
    const createdAt = paymentTimestamps.get(paymentId);
    if (!createdAt) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    const elapsed = Date.now() - createdAt;

    // Progressive status based on elapsed time:
    //   0-10s   → initiated
    //   10-30s  → processing
    //   30s+    → settled
    let status: CPNStatus["status"];
    let settledAt: Date | undefined;

    if (elapsed < 10_000) {
      status = "initiated";
    } else if (elapsed < 30_000) {
      status = "processing";
    } else {
      status = "settled";
      settledAt = new Date(createdAt + 30_000);
    }

    return { paymentId, status, settledAt };
  }

  async verifyCompliance(address: string): Promise<ComplianceResult> {
    // Always returns compliant for demo purposes
    return {
      address,
      compliant: true,
      riskScore: 15,
      checks: [
        "OFAC screening: PASS",
        "EU sanctions list: PASS",
        "PEP database: PASS",
        "Adverse media: PASS",
      ],
    };
  }
}
```

---

## On-Chain Data Indexing — chain.service.ts

**File:** `packages/frontend/src/services/chain.service.ts`

**Purpose:** Polls contract events and snapshots vault state into Postgres so the API routes can serve fast queries without hitting the RPC on every request.

### Functions

#### `indexContractEvents()`

Polls for new events from all deployed contracts and persists them as `Transaction` records.

```typescript
import { publicClient } from "@/lib/contracts";
import { prisma } from "@/lib/prisma";
import {
  treasuryVaultAbi,
  payoutRouterAbi,
  budgetManagerAbi,
} from "@/lib/abis";

// Track the last processed block per contract to avoid re-indexing
let lastProcessedBlock: bigint = 0n;

export async function indexContractEvents(): Promise<void> {
  const currentBlock = await publicClient.getBlockNumber();
  if (currentBlock <= lastProcessedBlock) return;

  const fromBlock = lastProcessedBlock + 1n;

  // ── TreasuryVault events ───────────────────────────────────────
  const vaultEvents = await publicClient.getContractEvents({
    address: process.env.NEXT_PUBLIC_TREASURY_VAULT_ADDRESS as `0x${string}`,
    abi: treasuryVaultAbi,
    fromBlock,
    toBlock: currentBlock,
  });

  for (const event of vaultEvents) {
    const type = mapVaultEventToType(event.eventName);
    if (!type) continue;

    await prisma.transaction.upsert({
      where: { txHash: event.transactionHash! },
      update: {},
      create: {
        txHash: event.transactionHash!,
        type,
        status: "COMPLETED",
        amount: extractAmount(event),
        blockNumber: Number(event.blockNumber),
        metadata: event.args as Record<string, unknown>,
      },
    });
  }

  // ── PayoutRouter events ────────────────────────────────────────
  const payoutEvents = await publicClient.getContractEvents({
    address: process.env.NEXT_PUBLIC_PAYOUT_ROUTER_ADDRESS as `0x${string}`,
    abi: payoutRouterAbi,
    fromBlock,
    toBlock: currentBlock,
  });

  for (const event of payoutEvents) {
    if (event.eventName === "PayoutCreated") {
      // Create or update Payout record
      await prisma.payout.upsert({
        where: { onChainId: Number(event.args.payoutId) },
        update: { status: "PENDING" },
        create: {
          onChainId: Number(event.args.payoutId),
          recipient: event.args.recipient as string,
          amount: event.args.amount?.toString() ?? "0",
          sourceCurrency: "USDC",
          targetCurrency: event.args.targetCurrency as string,
          status: "PENDING",
          txHash: event.transactionHash!,
        },
      });
    }

    if (event.eventName === "PayoutStatusUpdated") {
      await prisma.payout.updateMany({
        where: { onChainId: Number(event.args.payoutId) },
        data: { status: event.args.newStatus as string },
      });
    }
  }

  // ── BudgetManager events ───────────────────────────────────────
  const budgetEvents = await publicClient.getContractEvents({
    address: process.env.NEXT_PUBLIC_BUDGET_MANAGER_ADDRESS as `0x${string}`,
    abi: budgetManagerAbi,
    fromBlock,
    toBlock: currentBlock,
  });

  for (const event of budgetEvents) {
    await prisma.transaction.upsert({
      where: { txHash: event.transactionHash! },
      update: {},
      create: {
        txHash: event.transactionHash!,
        type: `BUDGET_${event.eventName.toUpperCase()}`,
        status: "COMPLETED",
        amount: extractAmount(event),
        blockNumber: Number(event.blockNumber),
        metadata: event.args as Record<string, unknown>,
      },
    });
  }

  lastProcessedBlock = currentBlock;
}

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

function extractAmount(event: any): string {
  return (event.args?.amount ?? event.args?.value ?? 0n).toString();
}
```

#### `takeVaultSnapshot()`

Reads the current vault state on-chain and persists a `VaultSnapshot` record.

```typescript
export async function takeVaultSnapshot(): Promise<void> {
  const vaultAddress = process.env.NEXT_PUBLIC_TREASURY_VAULT_ADDRESS as `0x${string}`;

  const [usdcBalance, usycBalance, totalValue, threshold] = await Promise.all([
    publicClient.readContract({
      address: vaultAddress,
      abi: treasuryVaultAbi,
      functionName: "getUSDCBalance",
    }),
    publicClient.readContract({
      address: vaultAddress,
      abi: treasuryVaultAbi,
      functionName: "getUSYCBalance",
    }),
    publicClient.readContract({
      address: vaultAddress,
      abi: treasuryVaultAbi,
      functionName: "getTotalValue",
    }),
    publicClient.readContract({
      address: vaultAddress,
      abi: treasuryVaultAbi,
      functionName: "threshold",
    }),
  ]);

  // Calculate APY from recent yield accrual (simplified)
  const previousSnapshot = await prisma.vaultSnapshot.findFirst({
    orderBy: { timestamp: "desc" },
  });

  let apy = 4.85; // default
  if (previousSnapshot) {
    const elapsed =
      (Date.now() - previousSnapshot.timestamp.getTime()) / (365.25 * 86_400_000);
    if (elapsed > 0 && Number(previousSnapshot.totalValue) > 0) {
      const growth = Number(totalValue) / Number(previousSnapshot.totalValue) - 1;
      apy = (growth / elapsed) * 100;
    }
  }

  await prisma.vaultSnapshot.create({
    data: {
      usdcBalance: usdcBalance.toString(),
      usycBalance: usycBalance.toString(),
      totalValue: totalValue.toString(),
      threshold: threshold.toString(),
      apy,
      timestamp: new Date(),
    },
  });
}
```

#### `getVaultStatus()`

Returns current vault balances directly from on-chain reads (no DB).

```typescript
export async function getVaultStatus() {
  const vaultAddress = process.env.NEXT_PUBLIC_TREASURY_VAULT_ADDRESS as `0x${string}`;

  const [usdcBalance, usycBalance, totalValue, threshold] = await Promise.all([
    publicClient.readContract({
      address: vaultAddress,
      abi: treasuryVaultAbi,
      functionName: "getUSDCBalance",
    }),
    publicClient.readContract({
      address: vaultAddress,
      abi: treasuryVaultAbi,
      functionName: "getUSYCBalance",
    }),
    publicClient.readContract({
      address: vaultAddress,
      abi: treasuryVaultAbi,
      functionName: "getTotalValue",
    }),
    publicClient.readContract({
      address: vaultAddress,
      abi: treasuryVaultAbi,
      functionName: "threshold",
    }),
  ]);

  return {
    liquidUSDC: usdcBalance.toString(),
    usycBalance: usycBalance.toString(),
    totalValue: totalValue.toString(),
    threshold: threshold.toString(),
  };
}
```

#### `syncPayoutStatuses()`

Pulls on-chain payout statuses and updates the Prisma `Payout` records.

```typescript
export async function syncPayoutStatuses(): Promise<void> {
  const pendingPayouts = await prisma.payout.findMany({
    where: { status: { in: ["PENDING", "PROCESSING"] } },
  });

  for (const payout of pendingPayouts) {
    if (payout.onChainId === null) continue;

    const onChainStatus = await publicClient.readContract({
      address: process.env.NEXT_PUBLIC_PAYOUT_ROUTER_ADDRESS as `0x${string}`,
      abi: payoutRouterAbi,
      functionName: "getPayoutStatus",
      args: [BigInt(payout.onChainId)],
    });

    const statusMap: Record<number, string> = {
      0: "PENDING",
      1: "PROCESSING",
      2: "COMPLETED",
      3: "FAILED",
    };

    const newStatus = statusMap[Number(onChainStatus)] ?? "PENDING";

    if (newStatus !== payout.status) {
      await prisma.payout.update({
        where: { id: payout.id },
        data: { status: newStatus },
      });
    }
  }
}
```

### Event Types to Index

| Contract | Event Name | Maps to Transaction Type |
|----------|-----------|--------------------------|
| TreasuryVault | `Deposited` | `DEPOSIT` |
| TreasuryVault | `Withdrawn` | `WITHDRAW` |
| TreasuryVault | `SweptToUSYC` | `SWEEP` |
| TreasuryVault | `RedeemedFromUSYC` | `REDEEM` |
| TreasuryVault | `ThresholdUpdated` | `THRESHOLD_UPDATE` |
| PayoutRouter | `PayoutCreated` | (creates Payout record) |
| PayoutRouter | `PayoutStatusUpdated` | (updates Payout status) |
| BudgetManager | `BudgetCreated` | `BUDGET_BUDGETCREATED` |
| BudgetManager | `BudgetSpent` | `BUDGET_BUDGETSPENT` |
| BudgetManager | `BudgetReallocated` | `BUDGET_BUDGETREALLOCATED` |

### Scheduling

These functions should be called on a regular interval. For the hackathon, the simplest approach is a Next.js API route invoked by a Vercel Cron Job:

```typescript
// packages/frontend/src/app/api/cron/index-events/route.ts
import { indexContractEvents, takeVaultSnapshot, syncPayoutStatuses } from "@/services/chain.service";

export async function GET() {
  await indexContractEvents();
  await takeVaultSnapshot();
  await syncPayoutStatuses();
  return Response.json({ ok: true, timestamp: new Date().toISOString() });
}
```

**Vercel cron config** (`vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/cron/index-events",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

This runs every 5 minutes. For demo purposes you can also trigger it manually via a `curl` call.

---

## Factory & Barrel Export

**File:** `packages/frontend/src/services/index.ts`

```typescript
import type { IUSYCAdapter, IStableFXAdapter, ICPNAdapter } from "@/types/integrations";
import { RealUSYCAdapter, MockUSYCAdapter } from "./usyc.service";
import { RealStableFXAdapter, MockStableFXAdapter } from "./stablefx.service";
import { RealCPNAdapter, MockCPNAdapter } from "./cpn.service";

const isReal = process.env.INTEGRATION_MODE === "real";

// ── Singletons ───────────────────────────────────────────────────────

let _usyc: IUSYCAdapter | null = null;
let _stablefx: IStableFXAdapter | null = null;
let _cpn: ICPNAdapter | null = null;

export function getUSYCAdapter(): IUSYCAdapter {
  if (!_usyc) {
    _usyc = isReal ? new RealUSYCAdapter() : new MockUSYCAdapter();
  }
  return _usyc;
}

export function getStableFXAdapter(): IStableFXAdapter {
  if (!_stablefx) {
    _stablefx = isReal ? new RealStableFXAdapter() : new MockStableFXAdapter();
  }
  return _stablefx;
}

export function getCPNAdapter(): ICPNAdapter {
  if (!_cpn) {
    _cpn = isReal ? new RealCPNAdapter() : new MockCPNAdapter();
  }
  return _cpn;
}

// Re-export chain service functions for convenience
export {
  indexContractEvents,
  takeVaultSnapshot,
  getVaultStatus,
  syncPayoutStatuses,
} from "./chain.service";
```

---

## Environment Variables

| Variable | Required For | Example |
|----------|-------------|---------|
| `INTEGRATION_MODE` | All adapters | `"mock"` or `"real"` |
| `STABLEFX_API_URL` | Real StableFX | `"https://api.stablefx.io"` |
| `STABLEFX_API_KEY` | Real StableFX | `"sfx_live_..."` |
| `CPN_API_URL` | Real CPN | `"https://api.circle.com/cpn"` |
| `CPN_API_KEY` | Real CPN | `"cpn_live_..."` |
| `NEXT_PUBLIC_TREASURY_VAULT_ADDRESS` | USYC + chain.service | `"0x..."` |
| `NEXT_PUBLIC_PAYOUT_ROUTER_ADDRESS` | chain.service | `"0x..."` |
| `NEXT_PUBLIC_BUDGET_MANAGER_ADDRESS` | chain.service | `"0x..."` |
| `NEXT_PUBLIC_USYC_ADDRESS` | USYC adapter | `"0x..."` |
| `ARC_RPC_URL` | All on-chain reads | `"https://rpc.arc..."` |

---

## Files to Create / Modify

| File | Description |
|------|-------------|
| `packages/frontend/src/types/integrations.ts` | All shared types and interfaces |
| `packages/frontend/src/services/usyc.service.ts` | USYC real + mock adapter |
| `packages/frontend/src/services/stablefx.service.ts` | StableFX real + mock adapter |
| `packages/frontend/src/services/cpn.service.ts` | CPN real + mock adapter |
| `packages/frontend/src/services/chain.service.ts` | On-chain event indexer + vault snapshots |
| `packages/frontend/src/services/index.ts` | Factory functions + barrel export |
| `packages/frontend/src/app/api/cron/index-events/route.ts` | Cron endpoint for event indexing |

---

## Cross-references

| Document | Relevance |
|----------|-----------|
| `docs/technical/07-api-routes.md` | API routes consume these adapters via the factory functions |
| `docs/technical/02-treasury-vault-contract.md` | `chain.service.ts` reads vault events and state; USYC adapter interacts with vault |
| `docs/technical/03-payout-router-contract.md` | `chain.service.ts` reads payout events |
| `docs/technical/04-budget-manager-contract.md` | `chain.service.ts` reads budget events |
| `docs/technical/01-monorepo-setup.md` | Environment variables, project structure, viem client setup |
| `docs/technical/06-database-schema.md` | Prisma models written to by chain.service (`Transaction`, `VaultSnapshot`, `Payout`) |
