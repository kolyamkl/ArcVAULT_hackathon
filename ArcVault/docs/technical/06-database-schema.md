# 06 — Database Schema (Prisma) Specification

> **Standalone implementation document.** An agent can implement the full database layer using only the information in this file.

---

## Overview

| Field | Value |
|---|---|
| **Database** | PostgreSQL on Railway |
| **ORM** | Prisma |
| **Schema Location** | `packages/frontend/prisma/schema.prisma` |
| **Seed Script** | `packages/frontend/prisma/seed.ts` |
| **Prisma Client** | `packages/frontend/src/lib/prisma.ts` |
| **TypeScript Types** | `packages/frontend/src/types/index.ts` |
| **Connection** | `DATABASE_URL` environment variable |

---

## Prisma Client Singleton

**File:** `packages/frontend/src/lib/prisma.ts`

Next.js hot-reloads in development, which would create multiple Prisma Client instances. This singleton pattern prevents connection pool exhaustion.

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
```

**Usage in API routes:**

```typescript
import prisma from '@/lib/prisma';

// In any API route or server component:
const transactions = await prisma.transaction.findMany({ ... });
```

---

## Full Prisma Schema

**File:** `packages/frontend/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────
// Transaction — universal ledger for all on-chain activity
// ─────────────────────────────────────────────
model Transaction {
  id            String   @id @default(cuid())
  type          String   // DEPOSIT | WITHDRAW | SWEEP | REDEEM | PAYOUT | FX_SWAP | BUDGET_SPEND
  txHash        String?  @unique
  fromAddress   String?
  toAddress     String?
  amount        Decimal
  currency      String   // USDC | EURC | USYC
  status        String   // PENDING | PROCESSING | COMPLETED | FAILED
  metadata      Json?    // Arbitrary JSON for type-specific data (e.g., payout reference, FX rate)
  chainId       Int      // Chain ID (e.g., 1 for Ethereum mainnet, 421614 for Arbitrum Sepolia)
  blockNumber   Int?     // Populated after on-chain confirmation
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([type])
  @@index([status])
  @@index([createdAt])
}

// ─────────────────────────────────────────────
// Payout — tracks individual payment lifecycle
// ─────────────────────────────────────────────
model Payout {
  id              String   @id @default(cuid())
  onChainId       Int      @unique         // Maps to PayoutRouter's payoutCounter
  recipient       String                    // Wallet address of recipient
  amount          Decimal                   // Amount in source currency
  sourceCurrency  String                    // Source token symbol (e.g., USDC)
  targetCurrency  String                    // Target token symbol (e.g., EURC, USDC)
  reference       String?                   // Human-readable ref (invoice #, PO #)
  status          String                    // PENDING | PROCESSING | CONVERTING | SETTLING | COMPLETED | FAILED
  cpnPaymentId    String?                   // Circle Payments Network ID (if applicable)
  txHash          String?                   // On-chain transaction hash
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([status])
  @@index([recipient])
}

// ─────────────────────────────────────────────
// FXQuote — foreign exchange quote lifecycle
// ─────────────────────────────────────────────
model FXQuote {
  id            String   @id @default(cuid())
  fromCurrency  String                      // Source token symbol
  toCurrency    String                      // Destination token symbol
  fromAmount    Decimal                     // Amount of source token
  toAmount      Decimal                     // Amount of destination token
  rate          Decimal                     // Exchange rate (fromCurrency -> toCurrency)
  spread        Decimal                     // Spread in basis points
  expiresAt     DateTime                    // Quote expiry timestamp
  status        String                      // PENDING | ACCEPTED | EXPIRED | EXECUTED
  txHash        String?                     // On-chain tx hash if executed
  createdAt     DateTime @default(now())

  @@index([status])
}

// ─────────────────────────────────────────────
// Pipeline — saved automation workflow (node/edge graph)
// ─────────────────────────────────────────────
model Pipeline {
  id          String               @id @default(cuid())
  name        String                        // Human-readable name (e.g., "Monthly Payroll")
  nodes       Json                          // Array of React Flow nodes
  edges       Json                          // Array of React Flow edges
  metadata    Json?                         // Optional config (schedule, thresholds, etc.)
  ownerWallet String                        // Wallet address of the pipeline creator
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt
  executions  PipelineExecution[]

  @@index([ownerWallet])
}

// ─────────────────────────────────────────────
// PipelineExecution — single run of a pipeline
// ─────────────────────────────────────────────
model PipelineExecution {
  id          String    @id @default(cuid())
  pipelineId  String
  pipeline    Pipeline  @relation(fields: [pipelineId], references: [id])
  status      String    // PENDING | RUNNING | COMPLETED | PARTIAL_FAILURE | FAILED
  totalCost   Decimal                       // Total USDC spent in this execution
  fxCost      Decimal   @default(0)         // FX conversion cost component
  results     Json                          // Per-node execution results
  triggeredBy String                        // Wallet address or "CRON" / "MANUAL"
  startedAt   DateTime  @default(now())
  completedAt DateTime?

  @@index([pipelineId])
  @@index([status])
}

// ─────────────────────────────────────────────
// Budget — off-chain mirror of on-chain BudgetManager state
// ─────────────────────────────────────────────
model Budget {
  id              String   @id @default(cuid())
  onChainId       Int      @unique         // Maps to BudgetManager's budgetCounter
  name            String                    // Department/budget name
  departmentHead  String                    // Wallet address of the department head
  totalAllocation Decimal                   // Total USDC allocated
  spent           Decimal  @default(0)      // Cumulative USDC spent
  periodStart     DateTime                  // Budget period start
  periodEnd       DateTime                  // Budget period end
  active          Boolean  @default(true)   // Whether the budget is active
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([active])
}

// ─────────────────────────────────────────────
// VaultSnapshot — periodic treasury state capture for charting
// ─────────────────────────────────────────────
model VaultSnapshot {
  id              String   @id @default(cuid())
  liquidUSDC      Decimal                   // USDC held in TreasuryVault (liquid)
  usycBalance     Decimal                   // USYC token balance
  totalValue      Decimal                   // liquidUSDC + (usycBalance * exchangeRate) in USDC terms
  yieldAccrued    Decimal                   // Cumulative yield earned in USDC
  apy             Decimal                   // Current annualized yield percentage
  timestamp       DateTime @default(now())

  @@index([timestamp])
}
```

---

## Enum Values Documentation

These are stored as strings (not Prisma enums) for flexibility during rapid iteration. Document them here as the source of truth.

### Transaction.type

| Value | Description |
|---|---|
| `DEPOSIT` | USDC deposited into TreasuryVault |
| `WITHDRAW` | USDC withdrawn from TreasuryVault |
| `SWEEP` | Idle USDC swept into USYC yield position |
| `REDEEM` | USYC redeemed back to USDC |
| `PAYOUT` | Payment sent via PayoutRouter |
| `FX_SWAP` | Foreign exchange swap executed |
| `BUDGET_SPEND` | Spend against a departmental budget |

### Transaction.status

| Value | Description |
|---|---|
| `PENDING` | Transaction submitted, awaiting confirmation |
| `PROCESSING` | Transaction is being processed on-chain |
| `COMPLETED` | Transaction confirmed and finalized |
| `FAILED` | Transaction reverted or failed |

### Payout.status

| Value | Description |
|---|---|
| `PENDING` | Payout created, awaiting execution |
| `PROCESSING` | On-chain transaction submitted |
| `CONVERTING` | FX conversion in progress (cross-currency payout) |
| `SETTLING` | Settlement in progress (CPN or on-chain) |
| `COMPLETED` | Payout delivered to recipient |
| `FAILED` | Payout failed at some stage |

### FXQuote.status

| Value | Description |
|---|---|
| `PENDING` | Quote requested, awaiting user acceptance |
| `ACCEPTED` | User accepted the quote, awaiting execution |
| `EXPIRED` | Quote expired before execution |
| `EXECUTED` | Swap completed on-chain |

### PipelineExecution.status

| Value | Description |
|---|---|
| `PENDING` | Execution queued |
| `RUNNING` | Pipeline is actively executing nodes |
| `COMPLETED` | All nodes executed successfully |
| `PARTIAL_FAILURE` | Some nodes failed, others succeeded |
| `FAILED` | Pipeline execution failed entirely |

---

## Migration Strategy

### Development

```bash
# Navigate to the frontend package
cd packages/frontend

# Create initial migration (generates SQL and applies it)
npx prisma migrate dev --name init

# Regenerate Prisma Client after schema changes
npx prisma generate

# Reset database (drops all data, re-applies migrations)
npx prisma migrate reset

# Open Prisma Studio (visual database browser)
npx prisma studio
```

### Production (Railway)

```bash
# Apply pending migrations (non-interactive, safe for CI/CD)
npx prisma migrate deploy

# Generate client (must run before build)
npx prisma generate
```

### Vercel Build Command

In `packages/frontend/package.json`:

```json
{
  "scripts": {
    "build": "prisma generate && next build",
    "postinstall": "prisma generate"
  }
}
```

### Railway Setup

1. Create a PostgreSQL instance on Railway.
2. Copy the connection string into the `DATABASE_URL` environment variable.
3. Format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require`
4. Set `DATABASE_URL` in both Railway (for migrations) and Vercel (for the app).

---

## Seed Script

**File:** `packages/frontend/prisma/seed.ts`

### Configuration

Add to `packages/frontend/package.json`:

```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

Install dev dependency: `pnpm add -D ts-node` (in `packages/frontend`).

Run with: `npx prisma db seed`

### Full Seed Script

```typescript
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ── Helper Constants ──────────────────────────────────────────

const TREASURY_WALLET = '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18';
const CFO_WALLET = '0x8ba1f109551bD432803012645Ac136ddd64DBA72';
const ENGINEERING_HEAD = '0xdD2FD4581271e230360230F9337D5c0430Bf44C0';
const MARKETING_HEAD = '0xbDA5747bFD65F08deb54cb465eB87D40e51B197E';
const OPERATIONS_HEAD = '0x2546BcD3c84621e976D8185a91A922aE77ECEc30';
const HR_HEAD = '0xcd3B766CCDd6AE721141F452C550Ca635964ce71';

const RECIPIENT_1 = '0xFABB0ac9d68B0B445fB7357272Ff202C5651694a';
const RECIPIENT_2 = '0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec';
const RECIPIENT_3 = '0x71bE63f3384f5fb98995898A86B02Fb2426c5788';
const RECIPIENT_4 = '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720';
const RECIPIENT_5 = '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f';

const CHAIN_ID = 421614; // Arbitrum Sepolia

// ── Seed Functions ────────────────────────────────────────────

async function seedVaultSnapshots() {
  console.log('Seeding VaultSnapshots (30 days)...');

  const snapshots: Prisma.VaultSnapshotCreateManyInput[] = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    // Simulate yield growth: APY rises from 4.50% to 4.85% over 30 days
    const dayIndex = 29 - i;
    const apy = 4.5 + (dayIndex / 29) * 0.35;

    // Total value grows from $900K to $1.245M (deposits + yield)
    const baseValue = 900000;
    const depositGrowth = (dayIndex / 29) * 300000; // $300K in new deposits over 30 days
    const yieldGrowth = (dayIndex / 29) * 45000;    // ~$45K in yield over 30 days
    const totalValue = baseValue + depositGrowth + yieldGrowth;

    // Split: ~30% liquid USDC, ~70% in USYC
    const liquidUSDC = totalValue * 0.3;
    const usycBalance = totalValue * 0.7;
    const yieldAccrued = yieldGrowth;

    snapshots.push({
      liquidUSDC: new Prisma.Decimal(liquidUSDC.toFixed(2)),
      usycBalance: new Prisma.Decimal(usycBalance.toFixed(2)),
      totalValue: new Prisma.Decimal(totalValue.toFixed(2)),
      yieldAccrued: new Prisma.Decimal(yieldAccrued.toFixed(2)),
      apy: new Prisma.Decimal(apy.toFixed(2)),
      timestamp: date,
    });
  }

  await prisma.vaultSnapshot.createMany({ data: snapshots });
  console.log(`  Created ${snapshots.length} VaultSnapshots`);
}

async function seedTransactions() {
  console.log('Seeding Transactions...');

  const now = new Date();
  const daysAgo = (d: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    return date;
  };

  const transactions: Prisma.TransactionCreateManyInput[] = [
    // ── DEPOSITS ──
    {
      type: 'DEPOSIT',
      txHash: '0xabc001def001abc001def001abc001def001abc001def001abc001def001ab01',
      fromAddress: CFO_WALLET,
      toAddress: TREASURY_WALLET,
      amount: new Prisma.Decimal('500000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { source: 'Circle mint', memo: 'Initial treasury funding' },
      chainId: CHAIN_ID,
      blockNumber: 18500001,
      createdAt: daysAgo(28),
    },
    {
      type: 'DEPOSIT',
      txHash: '0xabc002def002abc002def002abc002def002abc002def002abc002def002ab02',
      fromAddress: CFO_WALLET,
      toAddress: TREASURY_WALLET,
      amount: new Prisma.Decimal('200000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { source: 'Wire transfer', memo: 'Q1 operating budget' },
      chainId: CHAIN_ID,
      blockNumber: 18520050,
      createdAt: daysAgo(20),
    },
    {
      type: 'DEPOSIT',
      txHash: '0xabc003def003abc003def003abc003def003abc003def003abc003def003ab03',
      fromAddress: CFO_WALLET,
      toAddress: TREASURY_WALLET,
      amount: new Prisma.Decimal('150000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { source: 'Revenue deposit' },
      chainId: CHAIN_ID,
      blockNumber: 18545100,
      createdAt: daysAgo(10),
    },

    // ── WITHDRAWALS ──
    {
      type: 'WITHDRAW',
      txHash: '0xdef001abc001def001abc001def001abc001def001abc001def001abc001de01',
      fromAddress: TREASURY_WALLET,
      toAddress: CFO_WALLET,
      amount: new Prisma.Decimal('50000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { reason: 'Emergency operating funds' },
      chainId: CHAIN_ID,
      blockNumber: 18510030,
      createdAt: daysAgo(25),
    },

    // ── SWEEPS (USDC -> USYC) ──
    {
      type: 'SWEEP',
      txHash: '0xfed001abc001fed001abc001fed001abc001fed001abc001fed001abc001fe01',
      fromAddress: TREASURY_WALLET,
      toAddress: TREASURY_WALLET,
      amount: new Prisma.Decimal('400000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { targetAsset: 'USYC', usycReceived: '399200.50' },
      chainId: CHAIN_ID,
      blockNumber: 18502000,
      createdAt: daysAgo(27),
    },
    {
      type: 'SWEEP',
      txHash: '0xfed002abc002fed002abc002fed002abc002fed002abc002fed002abc002fe02',
      fromAddress: TREASURY_WALLET,
      toAddress: TREASURY_WALLET,
      amount: new Prisma.Decimal('150000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { targetAsset: 'USYC', usycReceived: '149700.25' },
      chainId: CHAIN_ID,
      blockNumber: 18522000,
      createdAt: daysAgo(18),
    },

    // ── REDEEMS (USYC -> USDC) ──
    {
      type: 'REDEEM',
      txHash: '0xcba001def001cba001def001cba001def001cba001def001cba001def001cb01',
      fromAddress: TREASURY_WALLET,
      toAddress: TREASURY_WALLET,
      amount: new Prisma.Decimal('100000.00'),
      currency: 'USYC',
      status: 'COMPLETED',
      metadata: { usdcReceived: '101250.00', exchangeRate: '1.0125' },
      chainId: CHAIN_ID,
      blockNumber: 18535000,
      createdAt: daysAgo(14),
    },

    // ── PAYOUTS ──
    {
      type: 'PAYOUT',
      txHash: '0xpay001def001pay001def001pay001def001pay001def001pay001def001pa01',
      fromAddress: TREASURY_WALLET,
      toAddress: RECIPIENT_1,
      amount: new Prisma.Decimal('25000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { payoutId: 1, reference: 'INV-2025-001' },
      chainId: CHAIN_ID,
      blockNumber: 18540000,
      createdAt: daysAgo(12),
    },
    {
      type: 'PAYOUT',
      txHash: '0xpay002def002pay002def002pay002def002pay002def002pay002def002pa02',
      fromAddress: TREASURY_WALLET,
      toAddress: RECIPIENT_2,
      amount: new Prisma.Decimal('18500.00'),
      currency: 'EURC',
      status: 'COMPLETED',
      metadata: { payoutId: 2, reference: 'INV-2025-002', fxRate: '0.9235' },
      chainId: CHAIN_ID,
      blockNumber: 18541000,
      createdAt: daysAgo(11),
    },
    {
      type: 'PAYOUT',
      txHash: '0xpay003def003pay003def003pay003def003pay003def003pay003def003pa03',
      fromAddress: TREASURY_WALLET,
      toAddress: RECIPIENT_3,
      amount: new Prisma.Decimal('42000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { payoutId: 3, reference: 'PO-2025-015' },
      chainId: CHAIN_ID,
      blockNumber: 18543000,
      createdAt: daysAgo(8),
    },
    {
      type: 'PAYOUT',
      txHash: null,
      fromAddress: TREASURY_WALLET,
      toAddress: RECIPIENT_4,
      amount: new Prisma.Decimal('15000.00'),
      currency: 'USDC',
      status: 'PENDING',
      metadata: { payoutId: 4, reference: 'INV-2025-003' },
      chainId: CHAIN_ID,
      blockNumber: null,
      createdAt: daysAgo(2),
    },
    {
      type: 'PAYOUT',
      txHash: null,
      fromAddress: TREASURY_WALLET,
      toAddress: RECIPIENT_5,
      amount: new Prisma.Decimal('8750.00'),
      currency: 'EURC',
      status: 'PROCESSING',
      metadata: { payoutId: 5, reference: 'INV-2025-004', fxRate: '0.9240' },
      chainId: CHAIN_ID,
      blockNumber: null,
      createdAt: daysAgo(1),
    },

    // ── FX SWAPS ──
    {
      type: 'FX_SWAP',
      txHash: '0xfx001abc001fx001abc001fx001abc001fx001abc001fx001abc001fx001fx01',
      fromAddress: TREASURY_WALLET,
      toAddress: TREASURY_WALLET,
      amount: new Prisma.Decimal('50000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { toCurrency: 'EURC', toAmount: '46175.00', rate: '0.9235', quoteId: 'q1' },
      chainId: CHAIN_ID,
      blockNumber: 18538000,
      createdAt: daysAgo(13),
    },
    {
      type: 'FX_SWAP',
      txHash: '0xfx002abc002fx002abc002fx002abc002fx002abc002fx002abc002fx002fx02',
      fromAddress: TREASURY_WALLET,
      toAddress: TREASURY_WALLET,
      amount: new Prisma.Decimal('30000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { toCurrency: 'EURC', toAmount: '27720.00', rate: '0.9240', quoteId: 'q2' },
      chainId: CHAIN_ID,
      blockNumber: 18542000,
      createdAt: daysAgo(9),
    },

    // ── BUDGET SPENDS ──
    {
      type: 'BUDGET_SPEND',
      txHash: '0xbud001abc001bud001abc001bud001abc001bud001abc001bud001abc001bu01',
      fromAddress: TREASURY_WALLET,
      toAddress: ENGINEERING_HEAD,
      amount: new Prisma.Decimal('75000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { budgetId: 1, department: 'Engineering', reference: 'Cloud infrastructure Q1' },
      chainId: CHAIN_ID,
      blockNumber: 18530000,
      createdAt: daysAgo(15),
    },
    {
      type: 'BUDGET_SPEND',
      txHash: '0xbud002abc002bud002abc002bud002abc002bud002abc002bud002abc002bu02',
      fromAddress: TREASURY_WALLET,
      toAddress: ENGINEERING_HEAD,
      amount: new Prisma.Decimal('120000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { budgetId: 1, department: 'Engineering', reference: 'Contractor payments Feb' },
      chainId: CHAIN_ID,
      blockNumber: 18548000,
      createdAt: daysAgo(5),
    },
    {
      type: 'BUDGET_SPEND',
      txHash: '0xbud003abc003bud003abc003bud003abc003bud003abc003bud003abc003bu03',
      fromAddress: TREASURY_WALLET,
      toAddress: MARKETING_HEAD,
      amount: new Prisma.Decimal('45000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { budgetId: 2, department: 'Marketing', reference: 'Ad campaigns Feb' },
      chainId: CHAIN_ID,
      blockNumber: 18547000,
      createdAt: daysAgo(6),
    },
    {
      type: 'BUDGET_SPEND',
      txHash: '0xbud004abc004bud004abc004bud004abc004bud004abc004bud004abc004bu04',
      fromAddress: TREASURY_WALLET,
      toAddress: OPERATIONS_HEAD,
      amount: new Prisma.Decimal('30000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { budgetId: 3, department: 'Operations', reference: 'Office lease + utilities' },
      chainId: CHAIN_ID,
      blockNumber: 18549000,
      createdAt: daysAgo(3),
    },
  ];

  await prisma.transaction.createMany({ data: transactions });
  console.log(`  Created ${transactions.length} Transactions`);
}

async function seedPayouts() {
  console.log('Seeding Payouts...');

  const now = new Date();
  const daysAgo = (d: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    return date;
  };

  const payouts: Prisma.PayoutCreateManyInput[] = [
    // 3 COMPLETED
    {
      onChainId: 1,
      recipient: RECIPIENT_1,
      amount: new Prisma.Decimal('25000.00'),
      sourceCurrency: 'USDC',
      targetCurrency: 'USDC',
      reference: 'INV-2025-001',
      status: 'COMPLETED',
      txHash: '0xpay001def001pay001def001pay001def001pay001def001pay001def001pa01',
      createdAt: daysAgo(12),
    },
    {
      onChainId: 2,
      recipient: RECIPIENT_2,
      amount: new Prisma.Decimal('20000.00'),
      sourceCurrency: 'USDC',
      targetCurrency: 'EURC',
      reference: 'INV-2025-002',
      status: 'COMPLETED',
      cpnPaymentId: 'cpn_pay_abc123',
      txHash: '0xpay002def002pay002def002pay002def002pay002def002pay002def002pa02',
      createdAt: daysAgo(11),
    },
    {
      onChainId: 3,
      recipient: RECIPIENT_3,
      amount: new Prisma.Decimal('42000.00'),
      sourceCurrency: 'USDC',
      targetCurrency: 'USDC',
      reference: 'PO-2025-015',
      status: 'COMPLETED',
      txHash: '0xpay003def003pay003def003pay003def003pay003def003pay003def003pa03',
      createdAt: daysAgo(8),
    },

    // 2 PENDING
    {
      onChainId: 4,
      recipient: RECIPIENT_4,
      amount: new Prisma.Decimal('15000.00'),
      sourceCurrency: 'USDC',
      targetCurrency: 'USDC',
      reference: 'INV-2025-003',
      status: 'PENDING',
      createdAt: daysAgo(2),
    },
    {
      onChainId: 5,
      recipient: RECIPIENT_5,
      amount: new Prisma.Decimal('35000.00'),
      sourceCurrency: 'USDC',
      targetCurrency: 'EURC',
      reference: 'INV-2025-005',
      status: 'PENDING',
      createdAt: daysAgo(1),
    },

    // 1 PROCESSING
    {
      onChainId: 6,
      recipient: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
      amount: new Prisma.Decimal('8750.00'),
      sourceCurrency: 'USDC',
      targetCurrency: 'EURC',
      reference: 'INV-2025-004',
      status: 'PROCESSING',
      createdAt: daysAgo(1),
    },

    // 1 CONVERTING
    {
      onChainId: 7,
      recipient: '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
      amount: new Prisma.Decimal('62000.00'),
      sourceCurrency: 'USDC',
      targetCurrency: 'EURC',
      reference: 'PO-2025-022',
      status: 'CONVERTING',
      cpnPaymentId: 'cpn_pay_def456',
      createdAt: daysAgo(1),
    },

    // 1 SETTLING
    {
      onChainId: 8,
      recipient: '0x14dC79964da2C08dda4C1086fB19a03801a4e0d5',
      amount: new Prisma.Decimal('28500.00'),
      sourceCurrency: 'USDC',
      targetCurrency: 'USDC',
      reference: 'INV-2025-006',
      status: 'SETTLING',
      txHash: '0xset001abc001set001abc001set001abc001set001abc001set001abc001se01',
      createdAt: daysAgo(1),
    },
  ];

  await prisma.payout.createMany({ data: payouts });
  console.log(`  Created ${payouts.length} Payouts`);
}

async function seedFXQuotes() {
  console.log('Seeding FXQuotes...');

  const now = new Date();
  const daysAgo = (d: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    return date;
  };

  const quotes: Prisma.FXQuoteCreateManyInput[] = [
    // 3 EXECUTED
    {
      fromCurrency: 'USDC',
      toCurrency: 'EURC',
      fromAmount: new Prisma.Decimal('50000.00'),
      toAmount: new Prisma.Decimal('46175.00'),
      rate: new Prisma.Decimal('0.9235'),
      spread: new Prisma.Decimal('15'),
      expiresAt: daysAgo(13),
      status: 'EXECUTED',
      txHash: '0xfx001abc001fx001abc001fx001abc001fx001abc001fx001abc001fx001fx01',
      createdAt: daysAgo(13),
    },
    {
      fromCurrency: 'USDC',
      toCurrency: 'EURC',
      fromAmount: new Prisma.Decimal('30000.00'),
      toAmount: new Prisma.Decimal('27720.00'),
      rate: new Prisma.Decimal('0.9240'),
      spread: new Prisma.Decimal('12'),
      expiresAt: daysAgo(9),
      status: 'EXECUTED',
      txHash: '0xfx002abc002fx002abc002fx002abc002fx002abc002fx002abc002fx002fx02',
      createdAt: daysAgo(9),
    },
    {
      fromCurrency: 'EURC',
      toCurrency: 'USDC',
      fromAmount: new Prisma.Decimal('20000.00'),
      toAmount: new Prisma.Decimal('21656.00'),
      rate: new Prisma.Decimal('1.0828'),
      spread: new Prisma.Decimal('18'),
      expiresAt: daysAgo(5),
      status: 'EXECUTED',
      txHash: '0xfx003abc003fx003abc003fx003abc003fx003abc003fx003abc003fx003fx03',
      createdAt: daysAgo(5),
    },

    // 1 PENDING (active, not yet expired)
    {
      fromCurrency: 'USDC',
      toCurrency: 'EURC',
      fromAmount: new Prisma.Decimal('75000.00'),
      toAmount: new Prisma.Decimal('69262.50'),
      rate: new Prisma.Decimal('0.9235'),
      spread: new Prisma.Decimal('15'),
      expiresAt: new Date(now.getTime() + 25 * 1000), // expires in 25 seconds
      status: 'PENDING',
      createdAt: now,
    },

    // 1 EXPIRED
    {
      fromCurrency: 'USDC',
      toCurrency: 'EURC',
      fromAmount: new Prisma.Decimal('100000.00'),
      toAmount: new Prisma.Decimal('92350.00'),
      rate: new Prisma.Decimal('0.9235'),
      spread: new Prisma.Decimal('15'),
      expiresAt: daysAgo(3),
      status: 'EXPIRED',
      createdAt: daysAgo(3),
    },
  ];

  await prisma.fXQuote.createMany({ data: quotes });
  console.log(`  Created ${quotes.length} FXQuotes`);
}

async function seedPipelines() {
  console.log('Seeding Pipelines...');

  // Pipeline 1: Monthly Payroll
  const monthlyPayroll = await prisma.pipeline.create({
    data: {
      name: 'Monthly Payroll',
      ownerWallet: CFO_WALLET,
      nodes: [
        {
          id: 'node-1',
          type: 'trigger',
          position: { x: 100, y: 200 },
          data: { label: 'Monthly Schedule', config: { cron: '0 9 1 * *' } },
        },
        {
          id: 'node-2',
          type: 'check-balance',
          position: { x: 350, y: 200 },
          data: { label: 'Check Vault Balance', config: { minBalance: 200000 } },
        },
        {
          id: 'node-3',
          type: 'redeem-usyc',
          position: { x: 600, y: 100 },
          data: { label: 'Redeem USYC if Needed', config: { amount: 'dynamic' } },
        },
        {
          id: 'node-4',
          type: 'batch-payout',
          position: { x: 850, y: 200 },
          data: {
            label: 'Execute Payroll',
            config: {
              recipients: [
                { address: RECIPIENT_1, amount: 12000, currency: 'USDC' },
                { address: RECIPIENT_2, amount: 10500, currency: 'EURC' },
                { address: RECIPIENT_3, amount: 15000, currency: 'USDC' },
                { address: RECIPIENT_4, amount: 8000, currency: 'USDC' },
              ],
            },
          },
        },
        {
          id: 'node-5',
          type: 'notification',
          position: { x: 1100, y: 200 },
          data: { label: 'Notify CFO', config: { channel: 'email', to: 'cfo@arcvault.io' } },
        },
      ],
      edges: [
        { id: 'e1-2', source: 'node-1', target: 'node-2' },
        { id: 'e2-3', source: 'node-2', target: 'node-3', label: 'Insufficient' },
        { id: 'e2-4', source: 'node-2', target: 'node-4', label: 'Sufficient' },
        { id: 'e3-4', source: 'node-3', target: 'node-4' },
        { id: 'e4-5', source: 'node-4', target: 'node-5' },
      ],
      metadata: {
        description: 'Automated monthly payroll disbursement',
        totalMonthly: 45500,
        lastRun: null,
      },
    },
  });

  // Pipeline 2: Q1 Contractors
  const q1Contractors = await prisma.pipeline.create({
    data: {
      name: 'Q1 Contractor Payments',
      ownerWallet: CFO_WALLET,
      nodes: [
        {
          id: 'node-1',
          type: 'trigger',
          position: { x: 100, y: 200 },
          data: { label: 'Manual Trigger', config: { type: 'manual' } },
        },
        {
          id: 'node-2',
          type: 'fx-convert',
          position: { x: 350, y: 150 },
          data: { label: 'Convert USDC->EURC', config: { amount: 30000, slippageBps: 50 } },
        },
        {
          id: 'node-3',
          type: 'batch-payout',
          position: { x: 600, y: 200 },
          data: {
            label: 'Pay Contractors',
            config: {
              recipients: [
                { address: RECIPIENT_5, amount: 18000, currency: 'EURC' },
                { address: RECIPIENT_2, amount: 12000, currency: 'EURC' },
              ],
            },
          },
        },
      ],
      edges: [
        { id: 'e1-2', source: 'node-1', target: 'node-2' },
        { id: 'e2-3', source: 'node-2', target: 'node-3' },
      ],
      metadata: {
        description: 'Quarterly contractor payment pipeline with FX conversion',
        totalQuarterly: 30000,
      },
    },
  });

  // Pipeline 3: Weekly Yield Sweep
  await prisma.pipeline.create({
    data: {
      name: 'Weekly Yield Sweep',
      ownerWallet: TREASURY_WALLET,
      nodes: [
        {
          id: 'node-1',
          type: 'trigger',
          position: { x: 100, y: 200 },
          data: { label: 'Weekly Schedule', config: { cron: '0 0 * * 1' } },
        },
        {
          id: 'node-2',
          type: 'check-balance',
          position: { x: 350, y: 200 },
          data: { label: 'Check Idle USDC', config: { threshold: 100000 } },
        },
        {
          id: 'node-3',
          type: 'sweep-to-yield',
          position: { x: 600, y: 200 },
          data: { label: 'Sweep to USYC', config: { keepLiquid: 100000 } },
        },
      ],
      edges: [
        { id: 'e1-2', source: 'node-1', target: 'node-2' },
        { id: 'e2-3', source: 'node-2', target: 'node-3', label: 'Above threshold' },
      ],
      metadata: {
        description: 'Automatically sweep excess USDC into USYC yield position',
      },
    },
  });

  console.log('  Created 3 Pipelines');

  // ── Pipeline Executions ──

  const now = new Date();
  const daysAgo = (d: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    return date;
  };

  await prisma.pipelineExecution.createMany({
    data: [
      {
        pipelineId: monthlyPayroll.id,
        status: 'COMPLETED',
        totalCost: new Prisma.Decimal('45500.00'),
        fxCost: new Prisma.Decimal('48.25'),
        results: {
          nodes: {
            'node-1': { status: 'success', output: 'Triggered on schedule' },
            'node-2': { status: 'success', output: 'Balance: $380,000 (sufficient)' },
            'node-4': { status: 'success', output: '4 payouts executed', txHashes: ['0xaaa...', '0xbbb...', '0xccc...', '0xddd...'] },
            'node-5': { status: 'success', output: 'Email sent to cfo@arcvault.io' },
          },
        },
        triggeredBy: 'CRON',
        startedAt: daysAgo(30),
        completedAt: daysAgo(30),
      },
      {
        pipelineId: q1Contractors.id,
        status: 'COMPLETED',
        totalCost: new Prisma.Decimal('30000.00'),
        fxCost: new Prisma.Decimal('135.00'),
        results: {
          nodes: {
            'node-1': { status: 'success', output: 'Manually triggered by CFO' },
            'node-2': { status: 'success', output: 'Converted 30000 USDC to 27720 EURC' },
            'node-3': { status: 'success', output: '2 payouts executed' },
          },
        },
        triggeredBy: CFO_WALLET,
        startedAt: daysAgo(7),
        completedAt: daysAgo(7),
      },
    ],
  });

  console.log('  Created 2 PipelineExecutions');
}

async function seedBudgets() {
  console.log('Seeding Budgets...');

  const now = new Date();
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0, 23, 59, 59);

  const budgets: Prisma.BudgetCreateManyInput[] = [
    {
      onChainId: 1,
      name: 'Engineering',
      departmentHead: ENGINEERING_HEAD,
      totalAllocation: new Prisma.Decimal('500000.00'),
      spent: new Prisma.Decimal('195000.00'),  // 39% utilized
      periodStart: quarterStart,
      periodEnd: quarterEnd,
      active: true,
    },
    {
      onChainId: 2,
      name: 'Marketing',
      departmentHead: MARKETING_HEAD,
      totalAllocation: new Prisma.Decimal('200000.00'),
      spent: new Prisma.Decimal('45000.00'),  // 22.5% utilized
      periodStart: quarterStart,
      periodEnd: quarterEnd,
      active: true,
    },
    {
      onChainId: 3,
      name: 'Operations',
      departmentHead: OPERATIONS_HEAD,
      totalAllocation: new Prisma.Decimal('150000.00'),
      spent: new Prisma.Decimal('30000.00'),  // 20% utilized
      periodStart: quarterStart,
      periodEnd: quarterEnd,
      active: true,
    },
    {
      onChainId: 4,
      name: 'Human Resources',
      departmentHead: HR_HEAD,
      totalAllocation: new Prisma.Decimal('100000.00'),
      spent: new Prisma.Decimal('62000.00'),  // 62% utilized
      periodStart: quarterStart,
      periodEnd: quarterEnd,
      active: true,
    },
  ];

  await prisma.budget.createMany({ data: budgets });
  console.log(`  Created ${budgets.length} Budgets`);
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('Starting ArcVault seed...\n');

  // Clear existing data (order matters due to relations)
  await prisma.pipelineExecution.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.vaultSnapshot.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.fXQuote.deleteMany();
  await prisma.budget.deleteMany();

  console.log('Cleared existing data.\n');

  await seedVaultSnapshots();
  await seedTransactions();
  await seedPayouts();
  await seedFXQuotes();
  await seedPipelines();
  await seedBudgets();

  console.log('\nSeed complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## TypeScript Types

**File:** `packages/frontend/src/types/index.ts`

These types mirror the Prisma models for use in frontend components, API responses, and prop typing. They use plain TypeScript types (not Prisma-generated types) so components are decoupled from the ORM.

```typescript
// ── Transaction ───────────────────────────────────────────────

export type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAW'
  | 'SWEEP'
  | 'REDEEM'
  | 'PAYOUT'
  | 'FX_SWAP'
  | 'BUDGET_SPEND';

export type TransactionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Transaction {
  id: string;
  type: TransactionType;
  txHash: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  amount: number;       // Converted from Decimal for frontend use
  currency: string;
  status: TransactionStatus;
  metadata: Record<string, unknown> | null;
  chainId: number;
  blockNumber: number | null;
  createdAt: string;    // ISO date string
  updatedAt: string;
}

// ── Payout ────────────────────────────────────────────────────

export type PayoutStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'CONVERTING'
  | 'SETTLING'
  | 'COMPLETED'
  | 'FAILED';

export interface Payout {
  id: string;
  onChainId: number;
  recipient: string;
  amount: number;
  sourceCurrency: string;
  targetCurrency: string;
  reference: string | null;
  status: PayoutStatus;
  cpnPaymentId: string | null;
  txHash: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── FX Quote ──────────────────────────────────────────────────

export type FXQuoteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'EXECUTED';

export interface FXQuote {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  spread: number;
  expiresAt: string;
  status: FXQuoteStatus;
  txHash: string | null;
  createdAt: string;
}

// ── Pipeline ──────────────────────────────────────────────────

export interface PipelineNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    config: Record<string, unknown>;
  };
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface Pipeline {
  id: string;
  name: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  metadata: Record<string, unknown> | null;
  ownerWallet: string;
  createdAt: string;
  updatedAt: string;
  executions?: PipelineExecution[];
}

// ── Pipeline Execution ────────────────────────────────────────

export type PipelineExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'PARTIAL_FAILURE'
  | 'FAILED';

export interface PipelineExecution {
  id: string;
  pipelineId: string;
  status: PipelineExecutionStatus;
  totalCost: number;
  fxCost: number;
  results: Record<string, unknown>;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
}

// ── Budget ────────────────────────────────────────────────────

export interface Budget {
  id: string;
  onChainId: number;
  name: string;
  departmentHead: string;
  totalAllocation: number;
  spent: number;
  periodStart: string;
  periodEnd: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Vault Snapshot ────────────────────────────────────────────

export interface VaultSnapshot {
  id: string;
  liquidUSDC: number;
  usycBalance: number;
  totalValue: number;
  yieldAccrued: number;
  apy: number;
  timestamp: string;
}

// ── API Response Wrappers ─────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ── Dashboard Aggregates (computed on the server) ─────────────

export interface DashboardStats {
  totalTreasuryValue: number;
  liquidUSDC: number;
  usycBalance: number;
  currentAPY: number;
  yieldAccrued30d: number;
  pendingPayouts: number;
  pendingPayoutsValue: number;
  totalBudgetAllocated: number;
  totalBudgetSpent: number;
}

export interface TreasuryChartPoint {
  date: string;
  totalValue: number;
  liquidUSDC: number;
  usycBalance: number;
  apy: number;
}
```

### Type Conversion Utility

When converting Prisma query results (which use `Decimal`) to frontend types (which use `number`), use a helper:

```typescript
// packages/frontend/src/lib/transforms.ts

import { Decimal } from '@prisma/client/runtime/library';

export function decimalToNumber(value: Decimal | null): number {
  if (value === null) return 0;
  return Number(value);
}

export function transformTransaction(prismaTransaction: any): Transaction {
  return {
    ...prismaTransaction,
    amount: decimalToNumber(prismaTransaction.amount),
    createdAt: prismaTransaction.createdAt.toISOString(),
    updatedAt: prismaTransaction.updatedAt.toISOString(),
  };
}

// Similar transform functions for Payout, FXQuote, Budget, VaultSnapshot, etc.
```

---

## Files to Create / Modify

| File | Action |
|---|---|
| `packages/frontend/prisma/schema.prisma` | **Create** — full Prisma schema |
| `packages/frontend/prisma/seed.ts` | **Create** — seed script with demo data |
| `packages/frontend/src/lib/prisma.ts` | **Create** — Prisma client singleton |
| `packages/frontend/src/types/index.ts` | **Create** — TypeScript type definitions |
| `packages/frontend/src/lib/transforms.ts` | **Create** — Decimal-to-number conversion utilities |
| `packages/frontend/package.json` | **Modify** — add `prisma.seed` config and `ts-node` dev dependency |

---

## Cross-References

| Document | Relationship |
|---|---|
| `docs/technical/07-api-routes.md` | All API routes query these Prisma models. Route handlers import from `@/lib/prisma`. |
| `docs/technical/01-monorepo-setup.md` | `DATABASE_URL` environment variable configuration. Prisma is in `packages/frontend/`. |
| `docs/technical/09-deployment.md` | Migration deployment strategy for Railway and Vercel. Build command includes `prisma generate`. |
| `docs/technical/04-budget-manager-contract.md` | `Budget` model mirrors on-chain BudgetManager state via `onChainId`. |
| `docs/technical/03-payout-router-contract.md` | `Payout` model mirrors on-chain PayoutRouter state via `onChainId`. |
| `docs/technical/05-access-control-contract.md` | `FXQuote` model stores off-chain representation of MockStableFX quotes. |
| `docs/frontend/03-dashboard-page.md` | Dashboard components consume `VaultSnapshot`, `Budget`, and `DashboardStats` types. |
| `docs/frontend/04-payments-page.md` | Payments page components consume `Payout` and `FXQuote` types. |

---

## Implementation Notes

1. **String enums vs Prisma enums:** The schema uses plain `String` types rather than Prisma `enum` declarations. This allows rapid iteration without migration overhead when adding new status values. The TypeScript union types provide compile-time safety on the frontend.

2. **Decimal handling:** Prisma's `Decimal` type maps to PostgreSQL's `NUMERIC`. Always convert to `number` (via `Number()` or the transform utility) before sending to the frontend. Do not use `parseFloat()` as it can lose precision on very large values.

3. **JSON fields:** `metadata`, `nodes`, `edges`, and `results` are stored as `Json` (PostgreSQL `jsonb`). Prisma returns these as `unknown`; cast to the appropriate TypeScript interface in transform functions.

4. **Timestamps:** Prisma returns `Date` objects from queries. Convert to ISO strings (`.toISOString()`) before sending in API responses. The frontend types use `string` for dates.

5. **Indexes:** The schema includes indexes on frequently queried columns (`type`, `status`, `createdAt`, `recipient`, `ownerWallet`, `pipelineId`, `timestamp`, `active`). These are critical for dashboard performance where multiple aggregation queries run on page load.

6. **cuid() IDs:** All models use `@default(cuid())` for primary keys. CUIDs are collision-resistant, sortable by creation time, and URL-safe. The `onChainId` field on `Payout` and `Budget` provides the mapping to on-chain state.

7. **Railway connection:** The `DATABASE_URL` must include `?sslmode=require` for Railway. Example: `postgresql://postgres:password@host.railway.internal:5432/railway?sslmode=require`.
