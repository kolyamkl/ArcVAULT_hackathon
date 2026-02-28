# 07 — API Routes Specification

> **Scope:** Every HTTP endpoint the ArcVault frontend (and potential external consumers) can call.
> All routes live under `packages/frontend/src/app/api/` and execute as Vercel serverless functions via the Next.js App Router.

---

## Table of Contents

1. [Shared Patterns](#shared-patterns)
2. [Zod Validation Schemas](#zod-validation-schemas)
3. [Payouts](#payouts)
4. [FX (Foreign Exchange)](#fx-foreign-exchange)
5. [Vault](#vault)
6. [Pipelines](#pipelines)
7. [Dashboard & Transactions](#dashboard--transactions)
8. [Files to Create / Modify](#files-to-create--modify)
9. [Cross-references](#cross-references)

---

## Shared Patterns

### Route Handler Convention

Every file exports one or more named async functions corresponding to the HTTP method:

```typescript
// packages/frontend/src/app/api/example/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // ...
  return NextResponse.json(payload, { status: 200 });
}
```

### JSON Contract

- **Request bodies** are always `application/json`.
- **Response bodies** are always `application/json`.
- **Error shape:**
  ```typescript
  {
    error: string;       // Human-readable message
    details?: string;    // Optional technical detail (omit in production)
  }
  ```
  Returned with the appropriate HTTP status code (400, 404, 500, etc.).

### Common Imports

```typescript
import { prisma } from "@/lib/prisma";           // Prisma client singleton
import { publicClient, walletClient } from "@/lib/contracts"; // viem clients
import { z } from "zod";
```

### Pagination Defaults

Unless otherwise stated, list endpoints accept the following query parameters:

| Param   | Type   | Default  | Description            |
|---------|--------|----------|------------------------|
| page    | number | 1        | 1-indexed page number  |
| limit   | number | 20       | Items per page (max 100) |
| sort    | string | "createdAt" | Sort field          |
| order   | string | "desc"   | "asc" or "desc"        |

Helper to extract pagination:

```typescript
function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const sort = searchParams.get("sort") ?? "createdAt";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  return { page, limit, sort, order, skip: (page - 1) * limit };
}
```

### On-Chain Interaction Pattern

Routes that write to the blockchain follow this sequence:

1. Validate request with Zod.
2. Prepare the contract call (encode function data via viem).
3. Submit the transaction via `walletClient`.
4. Wait for the transaction receipt.
5. Persist the result in Postgres via Prisma.
6. Return the combined result to the caller.

If the on-chain call fails, the route must return a `500` with the revert reason in `details`.

---

## Zod Validation Schemas

All schemas live in `packages/frontend/src/lib/validations/api.ts` so they can be shared between route handlers and (optionally) client-side forms.

```typescript
import { z } from "zod";

// ── Payouts ──────────────────────────────────────────────────────────

export const createPayoutSchema = z.object({
  recipient: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  amount: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Amount must be a numeric string"),
  sourceCurrency: z.string().min(1),
  targetCurrency: z.string().min(1),
  reference: z.string().max(256).optional(),
});

export const batchPayoutSchema = z.object({
  payouts: z
    .array(createPayoutSchema)
    .min(1, "At least one payout required")
    .max(50, "Max 50 payouts per batch"),
});

// ── FX ───────────────────────────────────────────────────────────────

export const fxQuoteQuerySchema = z.object({
  from: z.string().min(1, "from currency required"),
  to: z.string().min(1, "to currency required"),
  amount: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Amount must be a numeric string"),
});

export const fxExecuteSchema = z.object({
  quoteId: z.string().uuid("Invalid quote ID"),
});

// ── Pipelines ────────────────────────────────────────────────────────

const reactFlowNodeSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.unknown()),
});

const reactFlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: z.string().optional(),
});

export const createPipelineSchema = z.object({
  name: z.string().min(1).max(128),
  nodes: z.array(reactFlowNodeSchema).min(1),
  edges: z.array(reactFlowEdgeSchema),
  metadata: z.record(z.unknown()).optional(),
  ownerWallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
});

export const updatePipelineSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  nodes: z.array(reactFlowNodeSchema).optional(),
  edges: z.array(reactFlowEdgeSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const executePipelineSchema = z.object({
  triggeredBy: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
});

// ── Transactions ─────────────────────────────────────────────────────

export const transactionsQuerySchema = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
```

---

## Payouts

### 1. `POST /api/payouts` — Create Single Payout

**File:** `packages/frontend/src/app/api/payouts/route.ts`

| Aspect | Detail |
|--------|--------|
| Method | POST |
| Auth   | Wallet-connected (address from session / header) |

**Request body:**

```json
{
  "recipient": "0xAbC...123",
  "amount": "5000.00",
  "sourceCurrency": "USDC",
  "targetCurrency": "EURC",
  "reference": "INV-2024-0042"
}
```

**Response `201`:**

```json
{
  "id": "clxyz...",
  "onChainId": 17,
  "status": "PENDING",
  "txHash": "0xabc..."
}
```

**Logic:**

1. Parse & validate body with `createPayoutSchema`.
2. Convert `amount` to on-chain units (6 decimals for USDC).
3. Call `PayoutRouter.executePayout(recipient, amount, sourceCurrency, targetCurrency)` via `walletClient`.
4. Wait for `TransactionReceipt`; extract `PayoutCreated` event → `onChainId`.
5. Create `Payout` record in Prisma:
   ```typescript
   await prisma.payout.create({
     data: {
       recipient,
       amount,
       sourceCurrency,
       targetCurrency,
       reference,
       status: "PENDING",
       onChainId,
       txHash: receipt.transactionHash,
     },
   });
   ```
6. Create corresponding `Transaction` record with `type: "PAYOUT"`.
7. Return the created payout.

**Errors:**

| Code | Condition |
|------|-----------|
| 400  | Zod validation fails |
| 500  | On-chain call reverts or network error |

---

### 2. `POST /api/payouts/batch` — Create Batch Payout

**File:** `packages/frontend/src/app/api/payouts/batch/route.ts`

| Aspect | Detail |
|--------|--------|
| Method | POST |

**Request body:**

```json
{
  "payouts": [
    { "recipient": "0x...", "amount": "1000", "sourceCurrency": "USDC", "targetCurrency": "USDC", "reference": "SALARY-001" },
    { "recipient": "0x...", "amount": "2500", "sourceCurrency": "USDC", "targetCurrency": "EURC", "reference": "SALARY-002" }
  ]
}
```

**Response `201`:**

```json
{
  "payouts": [
    { "id": "clx...", "onChainId": 18, "status": "PENDING", "txHash": "0x..." },
    { "id": "clx...", "onChainId": 19, "status": "PENDING", "txHash": "0x..." }
  ],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0
  }
}
```

**Logic:**

1. Validate with `batchPayoutSchema`.
2. Build arrays: `recipients[]`, `amounts[]`, `sourceCurrencies[]`, `targetCurrencies[]`.
3. Call `PayoutRouter.batchPayout(recipients, amounts, sourceCurrencies, targetCurrencies)`.
4. Parse emitted events to map each payout to its `onChainId`.
5. Bulk-create `Payout` records and `Transaction` records via `prisma.$transaction`.
6. Return array of results plus summary.

**Errors:**

| Code | Condition |
|------|-----------|
| 400  | Zod validation fails for any entry |
| 500  | On-chain batch call reverts |

---

### 3. `GET /api/payouts` — List Payouts

**File:** `packages/frontend/src/app/api/payouts/route.ts` (same file, GET export)

| Aspect | Detail |
|--------|--------|
| Method | GET |
| Query  | `?status=PENDING&page=1&limit=20&sort=createdAt&order=desc` |

**Response `200`:**

```json
{
  "payouts": [ /* Payout[] */ ],
  "total": 142,
  "page": 1,
  "limit": 20
}
```

**Logic:**

1. Extract query params; parse pagination.
2. Build Prisma `where` clause (optional `status` filter).
3. Run `prisma.payout.findMany(...)` with pagination + ordering.
4. Run `prisma.payout.count(...)` for total.
5. Return paginated result.

---

### 4. `GET /api/payouts/[id]` — Get Payout Details

**File:** `packages/frontend/src/app/api/payouts/[id]/route.ts`

| Aspect | Detail |
|--------|--------|
| Method | GET |
| Params | `id` (path param, Prisma CUID) |

**Response `200`:**

```json
{
  "payout": {
    "id": "clx...",
    "recipient": "0x...",
    "amount": "5000.00",
    "sourceCurrency": "USDC",
    "targetCurrency": "EURC",
    "status": "COMPLETED",
    "txHash": "0x...",
    "onChainId": 17,
    "reference": "INV-2024-0042",
    "createdAt": "2024-...",
    "updatedAt": "2024-...",
    "transactions": [ /* Transaction[] */ ]
  }
}
```

**Logic:**

1. Extract `id` from route params.
2. `prisma.payout.findUnique({ where: { id }, include: { transactions: true } })`.
3. If null, return 404.

**Errors:**

| Code | Condition |
|------|-----------|
| 404  | Payout not found |

---

## FX (Foreign Exchange)

### 5. `GET /api/fx/quote` — Request FX Quote

**File:** `packages/frontend/src/app/api/fx/quote/route.ts`

| Aspect | Detail |
|--------|--------|
| Method | GET |
| Query  | `?from=USDC&to=EURC&amount=10000` |

**Response `200`:**

```json
{
  "id": "550e8400-e29b-...",
  "fromCurrency": "USDC",
  "toCurrency": "EURC",
  "fromAmount": "10000.00",
  "toAmount": "9235.00",
  "rate": 0.9235,
  "spread": 0.0005,
  "expiresAt": "2024-01-15T12:01:30Z"
}
```

**Logic:**

1. Validate query params against `fxQuoteQuerySchema`.
2. Call `getStableFXAdapter().getQuote(from, to, amountBigInt)`.
3. Persist the quote in `FXQuote` table via Prisma (status: `QUOTED`).
4. Return the quote with its DB id.

**Errors:**

| Code | Condition |
|------|-----------|
| 400  | Missing or invalid query params |
| 500  | StableFX adapter error |

---

### 6. `POST /api/fx/execute` — Execute FX Swap

**File:** `packages/frontend/src/app/api/fx/execute/route.ts`

| Aspect | Detail |
|--------|--------|
| Method | POST |

**Request body:**

```json
{
  "quoteId": "550e8400-e29b-..."
}
```

**Response `200`:**

```json
{
  "id": "550e8400-e29b-...",
  "status": "COMPLETED",
  "txHash": "0xdef...",
  "fromAmount": "10000.00",
  "toAmount": "9235.00",
  "rate": 0.9235
}
```

**Logic:**

1. Validate with `fxExecuteSchema`.
2. Fetch `FXQuote` from DB by `quoteId`.
3. Verify quote exists and has not expired (`expiresAt > now`).
4. Call `getStableFXAdapter().executeSwap(quoteId)`.
5. Update the `FXQuote` record: `status = "EXECUTED"`.
6. Create a `Transaction` record with `type: "FX_SWAP"`.
7. Return result.

**Errors:**

| Code | Condition |
|------|-----------|
| 400  | Invalid quoteId format |
| 404  | Quote not found |
| 410  | Quote has expired |
| 500  | Swap execution failure |

---

### 7. `GET /api/fx/history` — FX History

**File:** `packages/frontend/src/app/api/fx/history/route.ts`

| Aspect | Detail |
|--------|--------|
| Method | GET |
| Query  | `?page=1&limit=20` |

**Response `200`:**

```json
{
  "quotes": [ /* FXQuote[] */ ],
  "total": 38,
  "page": 1,
  "limit": 20
}
```

**Logic:**

1. Parse pagination from query params.
2. `prisma.fxQuote.findMany(...)` ordered by `createdAt` desc.
3. Return paginated list.

---

## Vault

### 8. `GET /api/vault/status` — Current Vault Status

**File:** `packages/frontend/src/app/api/vault/status/route.ts`

| Aspect | Detail |
|--------|--------|
| Method | GET |

**Response `200`:**

```json
{
  "liquidUSDC": "50000.000000",
  "usycBalance": "450000.000000",
  "totalValue": "500000.000000",
  "yieldAccrued": "1234.560000",
  "apy": 4.85,
  "threshold": "50000.000000"
}
```

**Logic:**

1. Read on-chain via `publicClient`:
   - `TreasuryVault.getUSDCBalance()` → `liquidUSDC`
   - `TreasuryVault.getUSYCBalance()` → `usycBalance`
   - `TreasuryVault.getTotalValue()` → `totalValue`
   - `TreasuryVault.threshold()` → `threshold`
2. Query latest `VaultSnapshot` from Prisma for `yieldAccrued` and `apy`.
3. Combine and return.

**Errors:**

| Code | Condition |
|------|-----------|
| 500  | RPC call fails |

---

### 9. `GET /api/vault/history` — Vault Event History

**File:** `packages/frontend/src/app/api/vault/history/route.ts`

| Aspect | Detail |
|--------|--------|
| Method | GET |
| Query  | `?type=SWEEP&page=1&limit=20` |

**Response `200`:**

```json
{
  "events": [ /* Transaction[] */ ],
  "total": 24,
  "page": 1,
  "limit": 20
}
```

**Logic:**

1. Parse pagination; optional `type` filter.
2. Query `Transaction` where `type IN ('SWEEP', 'REDEEM', 'DEPOSIT', 'WITHDRAW')`.
3. If `type` query param is provided, further filter by that specific type.
4. Return paginated list.

---

## Pipelines

### 10. `GET /api/pipelines` — List Pipelines

**File:** `packages/frontend/src/app/api/pipelines/route.ts`

| Aspect | Detail |
|--------|--------|
| Method | GET |

**Response `200`:**

```json
{
  "pipelines": [ /* Pipeline[] */ ]
}
```

**Logic:**

1. `prisma.pipeline.findMany({ orderBy: { updatedAt: "desc" } })`.
2. Return all pipelines. (No pagination needed for MVP given low volume.)

---

### 11. `POST /api/pipelines` — Create Pipeline

**File:** `packages/frontend/src/app/api/pipelines/route.ts` (same file, POST export)

| Aspect | Detail |
|--------|--------|
| Method | POST |

**Request body:**

```json
{
  "name": "Monthly Engineering Payroll",
  "nodes": [
    { "id": "source-1", "type": "source", "position": { "x": 0, "y": 0 }, "data": { "currency": "USDC" } },
    { "id": "split-1", "type": "split", "position": { "x": 200, "y": 0 }, "data": { "ratios": [50, 50] } },
    { "id": "payout-1", "type": "payout", "position": { "x": 400, "y": -50 }, "data": { "recipient": "0x...", "amount": "5000" } },
    { "id": "payout-2", "type": "payout", "position": { "x": 400, "y": 50 }, "data": { "recipient": "0x...", "amount": "5000" } }
  ],
  "edges": [
    { "id": "e1", "source": "source-1", "target": "split-1" },
    { "id": "e2", "source": "split-1", "target": "payout-1" },
    { "id": "e3", "source": "split-1", "target": "payout-2" }
  ],
  "ownerWallet": "0xAbC...123"
}
```

**Response `201`:**

```json
{
  "pipeline": { /* Pipeline */ }
}
```

**Logic:**

1. Validate with `createPipelineSchema`.
2. `prisma.pipeline.create({ data: { name, nodes, edges, metadata, ownerWallet } })`.
   - `nodes` and `edges` stored as JSON columns.
3. Return created pipeline.

**Errors:**

| Code | Condition |
|------|-----------|
| 400  | Validation error |

---

### 12. `GET /api/pipelines/[id]` — Get Pipeline

**File:** `packages/frontend/src/app/api/pipelines/[id]/route.ts`

| Aspect | Detail |
|--------|--------|
| Method | GET |

**Response `200`:**

```json
{
  "pipeline": {
    "id": "clx...",
    "name": "Monthly Engineering Payroll",
    "nodes": [ /* ... */ ],
    "edges": [ /* ... */ ],
    "ownerWallet": "0x...",
    "createdAt": "...",
    "updatedAt": "...",
    "executions": [ /* PipelineExecution[] */ ]
  }
}
```

**Logic:**

1. `prisma.pipeline.findUnique({ where: { id }, include: { executions: { orderBy: { createdAt: "desc" }, take: 20 } } })`.
2. If null, return 404.

**Errors:**

| Code | Condition |
|------|-----------|
| 404  | Pipeline not found |

---

### 13. `PUT /api/pipelines/[id]` — Update Pipeline

**File:** `packages/frontend/src/app/api/pipelines/[id]/route.ts` (same file, PUT export)

| Aspect | Detail |
|--------|--------|
| Method | PUT |

**Request body (partial):**

```json
{
  "name": "Updated Payroll Pipeline",
  "nodes": [ /* ... */ ],
  "edges": [ /* ... */ ]
}
```

**Response `200`:**

```json
{
  "pipeline": { /* updated Pipeline */ }
}
```

**Logic:**

1. Validate with `updatePipelineSchema`.
2. Verify pipeline exists (404 if not).
3. `prisma.pipeline.update({ where: { id }, data: { ...validatedFields } })`.
4. Return updated pipeline.

**Errors:**

| Code | Condition |
|------|-----------|
| 400  | Validation error |
| 404  | Pipeline not found |

---

### 14. `DELETE /api/pipelines/[id]` — Delete Pipeline

**File:** `packages/frontend/src/app/api/pipelines/[id]/route.ts` (same file, DELETE export)

| Aspect | Detail |
|--------|--------|
| Method | DELETE |

**Response `200`:**

```json
{
  "success": true
}
```

**Logic:**

1. Verify pipeline exists (404 if not).
2. `prisma.pipeline.delete({ where: { id } })`.
3. Return success.

---

### 15. `POST /api/pipelines/[id]/execute` — Execute Pipeline

**File:** `packages/frontend/src/app/api/pipelines/[id]/execute/route.ts`

| Aspect | Detail |
|--------|--------|
| Method | POST |

**Request body:**

```json
{
  "triggeredBy": "0xAbC...123"
}
```

**Response `201`:**

```json
{
  "execution": {
    "id": "clx...",
    "pipelineId": "clx...",
    "status": "COMPLETED",
    "triggeredBy": "0x...",
    "totalAmount": "10000.00",
    "payoutCount": 4,
    "txHashes": ["0x..."],
    "createdAt": "..."
  }
}
```

**Logic:**

1. Validate with `executePipelineSchema`.
2. Fetch pipeline; ensure it exists (404).
3. Parse `nodes` and `edges` to extract all payout-type nodes.
4. For each payout node, extract `recipient`, `amount`, `sourceCurrency`, `targetCurrency`.
5. Calculate `totalAmount` by summing all amounts.
6. Build batch arrays and call `PayoutRouter.batchPayout(...)`.
7. Create `PipelineExecution` record:
   ```typescript
   await prisma.pipelineExecution.create({
     data: {
       pipelineId: id,
       status: "COMPLETED",
       triggeredBy,
       totalAmount,
       payoutCount: payoutNodes.length,
       txHashes: [receipt.transactionHash],
     },
   });
   ```
8. Create individual `Payout` and `Transaction` records for each payout node.
9. Return the execution.

**Errors:**

| Code | Condition |
|------|-----------|
| 400  | Validation error |
| 404  | Pipeline not found |
| 500  | On-chain batch call fails |

---

### 16. `GET /api/pipelines/[id]/history` — Pipeline Execution History

**File:** `packages/frontend/src/app/api/pipelines/[id]/history/route.ts`

| Aspect | Detail |
|--------|--------|
| Method | GET |

**Response `200`:**

```json
{
  "executions": [ /* PipelineExecution[] */ ]
}
```

**Logic:**

1. Verify pipeline exists (404).
2. `prisma.pipelineExecution.findMany({ where: { pipelineId: id }, orderBy: { createdAt: "desc" } })`.
3. Return executions.

---

## Dashboard & Transactions

### 17. `GET /api/dashboard` — Dashboard Overview Stats

**File:** `packages/frontend/src/app/api/dashboard/route.ts`

| Aspect | Detail |
|--------|--------|
| Method | GET |

**Response `200`:**

```typescript
{
  totalAUM: string;           // e.g. "500000.000000"
  liquidUSDC: string;         // e.g. "50000.000000"
  usycPosition: string;       // e.g. "450000.000000"
  yieldEarned: {
    daily: string;            // e.g. "66.44"
    weekly: string;           // e.g. "465.07"
    monthly: string;          // e.g. "1993.15"
  };
  currentAPY: number;         // e.g. 4.85
  pendingPayouts: {
    count: number;            // e.g. 3
    totalAmount: string;      // e.g. "15000.000000"
  };
  recentActivity: Transaction[]; // last 10
}
```

**Logic:**

1. **On-chain reads** (parallel via `Promise.all`):
   - `TreasuryVault.getUSDCBalance()` → `liquidUSDC`
   - `TreasuryVault.getUSYCBalance()` → `usycPosition`
   - `TreasuryVault.getTotalValue()` → `totalAUM`
2. **Latest VaultSnapshot** (Prisma):
   - `prisma.vaultSnapshot.findFirst({ orderBy: { timestamp: "desc" } })`
   - Extract `apy` → `currentAPY`, compute yield deltas for daily/weekly/monthly windows.
3. **Pending payouts** (Prisma):
   ```typescript
   const pendingPayouts = await prisma.payout.aggregate({
     where: { status: "PENDING" },
     _count: true,
     _sum: { amount: true },
   });
   ```
4. **Recent activity** (Prisma):
   ```typescript
   const recentActivity = await prisma.transaction.findMany({
     orderBy: { createdAt: "desc" },
     take: 10,
   });
   ```
5. Combine and return.

**Errors:**

| Code | Condition |
|------|-----------|
| 500  | RPC or DB error |

---

### 18. `GET /api/transactions` — Unified Audit Trail

**File:** `packages/frontend/src/app/api/transactions/route.ts`

| Aspect | Detail |
|--------|--------|
| Method | GET |
| Query  | `?type=DEPOSIT&status=COMPLETED&page=1&limit=50&from=2024-01-01&to=2024-12-31` |

**Response `200`:**

```json
{
  "transactions": [ /* Transaction[] */ ],
  "total": 312,
  "page": 1,
  "limit": 50
}
```

**Logic:**

1. Validate query params against `transactionsQuerySchema`.
2. Build Prisma `where`:
   ```typescript
   const where: Prisma.TransactionWhereInput = {};
   if (type) where.type = type;
   if (status) where.status = status;
   if (from || to) {
     where.createdAt = {};
     if (from) where.createdAt.gte = new Date(from);
     if (to) where.createdAt.lte = new Date(to);
   }
   ```
3. Run `findMany` + `count` with pagination.
4. Return paginated result.

---

## Mock / Development Catch-All Route

### `[...path]` — Mock API Handler

**File:** `packages/frontend/src/app/api/[...path]/route.ts`

| Aspect | Detail |
|--------|--------|
| Methods | GET, POST, PUT, DELETE |
| Purpose | Catches all API routes and returns deterministic mock data during development |

This catch-all route provides mock implementations for **all** the routes documented above, plus:

- `GET /api/vault/snapshots` — Returns mock vault snapshot time-series data.
- `GET /api/fx/quote` uses query param format `?pair=USDC/EURC&amount=1000` (instead of separate `from`/`to` params).

**How it works:** The route receives all unmatched paths under `/api/`, joins the path segments, and matches against known patterns. It imports static mock data from `@/lib/mock-data` and returns JSON responses.

> **Note:** When specific route files (e.g., `api/payouts/route.ts`) exist alongside the catch-all, Next.js will prefer the more specific match. The catch-all only handles routes that don't have their own `route.ts` file.

---

## Files to Create / Modify

| File | Methods | Routes |
|------|---------|--------|
| `packages/frontend/src/app/api/payouts/route.ts` | GET, POST | List payouts, Create payout |
| `packages/frontend/src/app/api/payouts/batch/route.ts` | POST | Batch payout |
| `packages/frontend/src/app/api/payouts/[id]/route.ts` | GET | Get payout |
| `packages/frontend/src/app/api/fx/quote/route.ts` | GET | FX quote |
| `packages/frontend/src/app/api/fx/execute/route.ts` | POST | Execute swap |
| `packages/frontend/src/app/api/fx/history/route.ts` | GET | FX history |
| `packages/frontend/src/app/api/vault/status/route.ts` | GET | Vault status |
| `packages/frontend/src/app/api/vault/history/route.ts` | GET | Vault event history |
| `packages/frontend/src/app/api/pipelines/route.ts` | GET, POST | List / Create pipeline |
| `packages/frontend/src/app/api/pipelines/[id]/route.ts` | GET, PUT, DELETE | CRUD single pipeline |
| `packages/frontend/src/app/api/pipelines/[id]/execute/route.ts` | POST | Execute pipeline |
| `packages/frontend/src/app/api/pipelines/[id]/history/route.ts` | GET | Pipeline execution history |
| `packages/frontend/src/app/api/dashboard/route.ts` | GET | Dashboard stats |
| `packages/frontend/src/app/api/transactions/route.ts` | GET | Audit trail |
| `packages/frontend/src/lib/validations/api.ts` | -- | Zod schemas (shared) |
| `packages/frontend/src/app/api/[...path]/route.ts` | GET, POST, PUT, DELETE | Mock catch-all for development |

---

## Cross-references

| Document | Relevance |
|----------|-----------|
| `docs/technical/06-database-schema.md` | Prisma models (`Payout`, `Transaction`, `FXQuote`, `Pipeline`, `PipelineExecution`, `VaultSnapshot`) |
| `docs/technical/08-external-integrations.md` | `getStableFXAdapter()`, `getCPNAdapter()`, `chain.service` functions used by routes |
| `docs/technical/02-treasury-vault-contract.md` | On-chain view functions called by `/api/vault/status` and `/api/dashboard` |
| `docs/technical/03-payout-router-contract.md` | `executePayout` / `batchPayout` called by payout routes and pipeline execution |
| `docs/technical/01-monorepo-setup.md` | Project structure, env vars, Prisma client setup |
