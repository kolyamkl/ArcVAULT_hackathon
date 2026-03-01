# ArcVault

Enterprise Treasury & FX Operations Platform on Arc blockchain. ArcVault lets finance teams deposit idle USDC into a yield-bearing vault (via USYC), execute instant cross-currency payouts (via Circle StableFX), and orchestrate complex fund flows through a visual drag-and-drop pipeline builder — all enforced by on-chain smart contracts.

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                         │
│   Dashboard  ·  Vault  ·  FX Swap  ·  Pipeline Builder       │
└───────┬──────────┬──────────┬──────────────┬──────────────────┘
        │ read     │ write    │ write        │ write
        │          │          │              │
┌───────▼──────────▼──────────▼──────────────▼──────────────────┐
│               ARC TESTNET  (Chain 5042002)                    │
│                                                               │
│   USDC ◄────────► TreasuryVault ◄────────► USYC              │
│   EURC              │    │                 (yield)            │
│                     │    └──────────────────────┐             │
│                     ▼                           ▼             │
│              PayoutRouter ◄──────────► StableFX               │
│                     │                  (USDC ↔ EURC)          │
│                     ▼                                         │
│              BudgetManager                                    │
│              (spending caps)                                  │
│                                                               │
└───────────────────────┬───────────────────────────────────────┘
                        │ indexed
                        ▼
                   PostgreSQL
                (audit trail + UI)
```

**Connections to Arc Testnet:**

| Frontend Feature | Contract Calls |
|-----------------|----------------|
| **Dashboard** | Reads `TreasuryVault.getLiquidBalance()`, `getTotalValue()`, `getYieldAccrued()` via multicall |
| **Vault Page** | User signs `USDC.approve()` + `TreasuryVault.depositFunds()`; CFO calls `setLiquidityThreshold()` |
| **FX Swap** | Calls `StableFX.requestQuote()` then `executeSwap()` — atomic on-chain USDC/EURC swap |
| **Pipeline Engine** | Server-side viem client calls `PayoutRouter.executePayout()` per recipient; uses `StableFX` for FX nodes |
| **PostgreSQL** | Mirrors every on-chain write so the frontend never scans the chain for history |

---

## Smart Contracts

All contracts are deployed on Arc Testnet (chain ID `5042002`) using Foundry.

### TreasuryVault

Core vault holding USDC liquidity and USYC yield positions.

| Function | Access | Purpose |
|----------|--------|---------|
| `depositFunds(amount)` | Public | Accept USDC; auto-sweep to USYC if balance exceeds threshold |
| `withdrawFunds(amount)` | TREASURY_MANAGER | Withdraw USDC; auto-redeem USYC if liquid balance is insufficient |
| `setLiquidityThreshold(amount)` | CFO | Update the sweep threshold and rebalance |
| `sweepToUSYC()` | Public | Manually convert excess USDC to USYC |
| `redeemFromUSYC(amount)` | Public | Manually convert USYC back to USDC |
| `rebalance()` | Public | Sweep or redeem to match the target threshold |
| `getLiquidBalance()` | View | USDC held in the vault |
| `getTotalValue()` | View | Liquid USDC + USYC valued at current exchange rate |
| `getYieldAccrued()` | View | Total value minus net deposits (i.e. profit from yield) |

### PayoutRouter

Orchestrates the full payout lifecycle: withdraw from vault, optionally convert currency, settle to recipient.

| Function | Access | Purpose |
|----------|--------|---------|
| `executePayout(recipient, amount, currency, ref)` | AP_MANAGER | Single payout with optional FX conversion |
| `batchPayout(recipients[], amounts[], currencies[], refs[])` | AP_MANAGER | Multiple payouts in one transaction |

**Payout lifecycle:** `Pending → Processing → Converting (if FX needed) → Settling → Completed`

Each payout emits a `PayoutCreated` event with an on-chain ID used for DB tracking.

### BudgetManager

On-chain department spending limits.

| Function | Access | Purpose |
|----------|--------|---------|
| `createBudget(name, head, allocation, end)` | CFO | Create a time-bound budget for a department |
| `spendFromBudget(budgetId, amount, ref)` | Department Head | Debit the budget (reverts if over-allocated) |
| `reallocate(fromId, toId, amount)` | CFO | Move unspent funds between departments |

### Roles (AccessControl)

| Role | Granted To | Can Do |
|------|-----------|--------|
| `DEFAULT_ADMIN_ROLE` | Deployer | Pause/unpause, grant roles |
| `CFO_ROLE` | Deployer | Set threshold, create/reallocate budgets |
| `TREASURY_MANAGER_ROLE` | PayoutRouter, BudgetManager | Withdraw from vault |
| `AP_MANAGER_ROLE` | Deployer | Execute payouts |

---

## USYC & StableFX

### USYC — Yield on Idle Treasury

USYC is a yield-bearing token that wraps USDC. Depositing USDC mints USYC at the current exchange rate; as yield accrues the rate increases, so redeeming later returns more USDC than was deposited.

**How ArcVault uses it:**

```
Deposit $150k USDC → Vault balance = $150k
Threshold = $100k  → Excess = $50k
Auto-sweep         → $50k USDC converted to ~48 USYC (rate 1.048)
                     Vault now: $100k liquid + 48 USYC earning ~5% APY

Later: withdrawal of $120k requested
  Liquid = $100k (not enough)
  Redeem $20k worth of USYC → receive $20k USDC (rate may have grown)
  Transfer $120k to recipient
```

The vault's `getTotalValue()` and `getYieldAccrued()` views let the dashboard show real-time AUM and earned yield without any off-chain calculation.

**Interface (`IUSYC`):**

| Function | Purpose |
|----------|---------|
| `deposit(usdcAmount)` | Mint USYC at current rate |
| `redeem(usycAmount)` | Burn USYC, receive USDC at current rate |
| `exchangeRate()` | Current USYC/USDC rate (starts at 1e18, grows over time) |
| `balanceOf(account)` | USYC token balance |

### StableFX — Foreign Exchange

StableFX provides instant stablecoin conversions using a Request-for-Quote (RFQ) model. ArcVault uses it when a payout's target currency differs from USDC.

**How ArcVault uses it:**

```
Pipeline payout: send €5,000 to contractor in Berlin
  1. StableFX.requestQuote(USDC, EURC, $5,415)
     → quoteId, outputAmount = €5,000, rate = 0.9235, expires in 30s
  2. StableFX.executeSwap(quoteId)
     → Atomic swap: pull USDC, send EURC
  3. Transfer €5,000 EURC to contractor wallet
```

**Interface (`IStableFX`):**

| Function | Purpose |
|----------|---------|
| `requestQuote(from, to, amount)` | Get a quote with rate, output amount, and 30s expiry |
| `executeSwap(quoteId)` | Execute the quoted swap atomically |
| `setRate(from, to, rate)` | (Admin) Configure pair rates |

**Configured rates:** USDC→EURC = 0.9235, EURC→USDC = 1.0828

---

## Pipeline Engine

The pipeline builder lets users visually wire up complex fund flows as a directed acyclic graph. The engine topologically sorts the nodes and executes them in dependency order, persisting progress to the database after each step.

```
[Treasury] ──→ [Engineering Dept] ──→ [Alice: $5k USDC]
                                  ──→ [FX: USDC→EURC] ──→ [Bob: €4k EURC]
           ──→ [Approval Gate] ──→ [Marketing Dept] ──→ [Carol: $3k USDC]
```

### Node Types

| Node | Purpose | Key Behavior |
|------|---------|-------------|
| **Treasury Source** | Entry point — verifies vault has sufficient liquidity | Reads `TreasuryVault.getLiquidBalance()` on-chain; outputs the current liquid USDC balance |
| **Department** | Routing/grouping node representing a cost center (e.g. "Engineering") | Pass-through — no on-chain action; organizes downstream recipients under a label |
| **FX Conversion** | Currency conversion for non-USDC payouts | Sums all downstream recipient amounts, requests a StableFX quote, executes the swap, and persists the FX record to the database |
| **Employee / Contractor** | Individual payout to a wallet address | Calls `PayoutRouter.executePayout()` on-chain, waits for confirmation, decodes the `PayoutCreated` event, and records the payout + transaction in the database. Supports optional gift/bonus amounts |
| **Approval** | Multi-signature gate — pauses execution until M-of-N approvers sign off | Checks the database for existing approvals; if the threshold is met, continues; otherwise creates pending `ApprovalRequest` records and pauses the pipeline with status `AWAITING_APPROVAL` |
| **Condition** | Branching logic based on upstream data | Evaluates a rule (e.g. `amount > 50000`) against parent node values; marks the untaken branch's descendants as skipped |
| **Delay** | Timed pause — wait a duration or until a specific date/time | If the resume time has already passed, continues immediately; otherwise creates a `DelaySchedule` record and pauses the pipeline with status `PAUSED` |

### Execution Rules

- Nodes execute in **topological order** (dependencies first)
- If a node **fails**, all its downstream children are **skipped**
- If an **approval gate** is not satisfied, the pipeline **pauses** and can be resumed later via API
- If a **condition** evaluates to false, the false-branch descendants are **skipped**
- Progress is **persisted to the database** after every node so the frontend can poll and show real-time status
- Final status is `COMPLETED`, `PARTIAL_FAILURE`, or `FAILED` based on how many nodes succeeded
