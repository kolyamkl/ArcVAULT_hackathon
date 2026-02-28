# ArcVault Technical PRD

## Context

ArcVault is an enterprise treasury & FX operations platform built on the Arc blockchain for a hackathon submission (< 1 week deadline, team of 2-3). It enables institutional finance teams to earn yield on idle cash via USYC, execute instant FX swaps via StableFX, process cross-border payouts via CPN, and enforce departmental budgets on-chain.

This document is the **implementation-focused** PRD covering architecture, contracts, APIs, frontend, and deployment.

---

## 1. Architecture Overview

```
                   +------------------+
                   |     Vercel       |
                   |  Next.js App     |
                   |  (Frontend +     |
                   |   API Routes)    |
                   +--------+---------+
                            |
              +-------------+-------------+
              |             |             |
        +-----+-----+ +----+----+ +------+------+
        | Railway    | |StableFX| |    CPN      |
        | PostgreSQL | | API/SDK| |   API/SDK   |
        +------------+ +--------+ +-------------+
              |
        +-----+-----+
        | Arc Testnet|
        | Contracts  |
        +------------+
```

**App (Vercel):** Next.js (App Router) + React + Tailwind CSS + API Routes, RainbowKit + wagmi
**Database (Railway):** PostgreSQL, accessed via Prisma ORM from Next.js API routes
**Contracts (Arc Testnet):** Solidity 0.8.x + OpenZeppelin, Foundry toolchain
**Charts:** Recharts
**Package Manager:** pnpm (monorepo)

---

## 2. Monorepo Structure

```
arcvault/
├── pnpm-workspace.yaml
├── package.json
├── .gitignore
├── .env.example
│
├── packages/
│   ├── contracts/                  # Foundry project
│   │   ├── foundry.toml
│   │   ├── src/
│   │   │   ├── TreasuryVault.sol
│   │   │   ├── PayoutRouter.sol
│   │   │   ├── BudgetManager.sol
│   │   │   ├── ArcVaultAccessControl.sol
│   │   │   ├── interfaces/
│   │   │   │   ├── IUSYC.sol
│   │   │   │   └── IStableFX.sol
│   │   │   └── mocks/
│   │   │       ├── MockERC20.sol
│   │   │       ├── MockUSYC.sol
│   │   │       └── MockStableFX.sol
│   │   ├── test/
│   │   ├── script/
│   │   │   └── Deploy.s.sol
│   │   └── deployments/            # Deployed addresses per network
│   │
│   └── frontend/                   # Next.js app
│       ├── next.config.js
│       ├── tailwind.config.ts
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts             # Demo seed data
│       └── src/
│           ├── app/                # App Router
│           │   ├── layout.tsx
│           │   ├── page.tsx                    # Dashboard overview
│           │   ├── vault/page.tsx              # Treasury Vault
│           │   ├── fx/page.tsx                 # FX Conversion
│           │   ├── pipeline/page.tsx           # Pipeline Builder (React Flow)
│           │   └── api/                        # Next.js API Routes (backend)
│           │       ├── payouts/
│           │       │   ├── route.ts            # POST (create), GET (list)
│           │       │   ├── batch/route.ts      # POST batch payout
│           │       │   └── [id]/route.ts       # GET payout details
│           │       ├── fx/
│           │       │   ├── quote/route.ts      # GET quote
│           │       │   ├── execute/route.ts    # POST execute swap
│           │       │   └── history/route.ts    # GET FX history
│           │       ├── vault/
│           │       │   ├── status/route.ts     # GET vault status
│           │       │   └── history/route.ts    # GET sweep/redeem history
│           │       ├── pipelines/
│           │       │   ├── route.ts            # GET list, POST create
│           │       │   └── [id]/
│           │       │       ├── route.ts        # GET, PUT, DELETE pipeline
│           │       │       ├── execute/route.ts # POST execute pipeline
│           │       │       └── history/route.ts # GET execution history
│           │       ├── dashboard/route.ts      # GET overview stats
│           │       └── transactions/route.ts   # GET audit trail
│           ├── components/
│           │   ├── layout/         # Sidebar, Header, ThemeToggle
│           │   ├── vault/          # Vault-specific components
│           │   ├── fx/             # FX-specific components
│           │   ├── pipeline/       # Pipeline Builder: nodes, edges, palette, execution
│           │   ├── quick-pay/      # Quick Pay modal
│           │   └── shared/         # Cards, Tables, Charts, StatusBadge
│           ├── hooks/              # Custom hooks (useVault, useFX, etc.)
│           ├── services/
│           │   ├── cpn.service.ts          # CPN integration (real + mock)
│           │   ├── stablefx.service.ts     # StableFX integration (real + mock)
│           │   ├── usyc.service.ts         # USYC yield integration (real + mock)
│           │   ├── chain.service.ts        # On-chain reads/event indexing
│           │   └── index.ts               # Service factory (selects real/mock via env)
│           ├── lib/
│           │   ├── prisma.ts       # Prisma client singleton
│           │   ├── api.ts          # Internal API client for frontend
│           │   ├── contracts.ts    # Contract addresses + ABI re-exports
│           │   ├── chains.ts       # Arc Testnet chain definition
│           │   ├── abis/           # Contract ABI JSON files
│           │   └── utils.ts
│           ├── providers/          # Wagmi, QueryClient, RainbowKit, Theme providers
│           ├── stores/             # Zustand stores (UI state only)
│           └── types/
│
└── README.md
```

---

## 3. Smart Contracts — Full Specification

### 3.1 TreasuryVault.sol

**Purpose:** Core vault managing USDC/USYC allocation with auto-sweep logic.

```solidity
// State
address public usdc;              // USDC token address
address public usyc;              // USYC token address
uint256 public liquidityThreshold; // Min USDC to keep liquid
uint256 public totalDeposited;    // Cumulative deposits for yield calculation
uint256 public totalWithdrawn;    // Cumulative withdrawals for yield calculation

// Core Functions
function depositFunds(uint256 amount) external nonReentrant whenNotPaused;
  // Transfer USDC from msg.sender to vault
  // If balance > threshold, auto-sweep excess to USYC

function withdrawFunds(uint256 amount) external onlyRole(TREASURY_MANAGER_ROLE) nonReentrant whenNotPaused;
  // If liquid USDC >= amount, transfer directly
  // If not, redeem from USYC to cover shortfall, then transfer

function setLiquidityThreshold(uint256 _threshold) external onlyRole(CFO_ROLE);
  // Update threshold, trigger rebalance if needed

function sweepToUSYC() external nonReentrant whenNotPaused;
  // Anyone can call — calculates excess = liquidUSDC - threshold
  // Calls USYC.deposit(excess)

function redeemFromUSYC(uint256 usdcAmount) external nonReentrant whenNotPaused;
  // Anyone can call — converts USYC back to USDC

function rebalance() external;
  // Public function anyone can call to trigger sweep/redeem
  // Ensures vault is at optimal allocation
  // Note: not guarded by whenNotPaused

// View Functions
function getLiquidBalance() external view returns (uint256);
function getUSYCBalance() external view returns (uint256);
function getTotalValue() external view returns (uint256);
function getYieldAccrued() external view returns (uint256);

// Admin Functions
function pause() external onlyRole(DEFAULT_ADMIN_ROLE);
function unpause() external onlyRole(DEFAULT_ADMIN_ROLE);

// Events
event Deposited(address indexed user, uint256 amount);
event Withdrawn(address indexed user, uint256 amount);
event SweptToUSYC(uint256 amount);
event RedeemedFromUSYC(uint256 amount);
event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
```

### 3.2 PayoutRouter.sol

**Purpose:** Orchestrates the payout pipeline — liquidity check, USYC redemption, FX conversion, settlement.

```solidity
// State
address public treasuryVault;
address public stableFX;
address public budgetManager;
address public usdc;

struct Payout {
    address recipient;
    uint256 amount;
    address targetCurrency;   // USDC, EURC, etc.
    bytes32 paymentRef;       // External reference (invoice ID, PO number, etc.)
    PayoutStatus status;
    uint256 timestamp;
    uint256 outputAmount;     // Final amount in target currency (set after FX)
}

enum PayoutStatus { Pending, Processing, Converting, Settling, Completed, Failed }

mapping(uint256 => Payout) public payouts;
uint256 public payoutCounter;

// Core Functions
function executePayout(
    address recipient,
    uint256 amount,
    address targetCurrency,
    bytes32 paymentRef
) external onlyRole(AP_MANAGER_ROLE) nonReentrant whenNotPaused returns (uint256 payoutId);
  // 1. Check/pull from TreasuryVault (auto-redeems USYC if needed)
  // 2. If targetCurrency != USDC, execute FX swap via StableFX
  // 3. Transfer to recipient (CPN routing handled off-chain by backend)
  // 4. Emit event for backend to pick up CPN settlement

function batchPayout(
    address[] calldata recipients,
    uint256[] calldata amounts,
    address[] calldata targetCurrencies,
    bytes32[] calldata paymentRefs
) external onlyRole(AP_MANAGER_ROLE) nonReentrant whenNotPaused returns (uint256[] memory payoutIds);

function updatePayoutStatus(uint256 payoutId, PayoutStatus newStatus) external onlyRole(OPERATOR_ROLE);

// View Functions
function getPayoutStatus(uint256 payoutId) external view returns (Payout memory);
function getPayoutsByStatus(PayoutStatus status) external view returns (uint256[] memory);
function getPayoutCount() external view returns (uint256);

// Admin Functions
function pause() external onlyRole(DEFAULT_ADMIN_ROLE);
function unpause() external onlyRole(DEFAULT_ADMIN_ROLE);
function updateTreasuryVault(address newVault) external onlyRole(DEFAULT_ADMIN_ROLE);
function updateStableFX(address newStableFX) external onlyRole(DEFAULT_ADMIN_ROLE);

// Events
event PayoutCreated(uint256 indexed payoutId, address indexed recipient, uint256 amount, address targetCurrency);
event PayoutStatusUpdated(uint256 indexed payoutId, PayoutStatus oldStatus, PayoutStatus newStatus);
event PayoutCompleted(uint256 indexed payoutId, uint256 outputAmount);
```

### 3.3 BudgetManager.sol

**Purpose:** On-chain departmental budget enforcement.

```solidity
struct Budget {
    string name;
    address departmentHead;
    uint256 totalAllocation;
    uint256 spent;
    uint256 periodStart;
    uint256 periodEnd;
    bool active;
}

mapping(uint256 => Budget) public budgets;
uint256 public budgetCounter;

// Core Functions
function createBudget(
    string calldata name,
    address departmentHead,
    uint256 allocation,
    uint256 periodEnd
) external onlyRole(CFO) returns (uint256 budgetId);

function spendFromBudget(uint256 budgetId, uint256 amount, bytes32 paymentRef)
    external nonReentrant whenNotPaused;
  // Only departmentHead can spend (msg.sender == budget.departmentHead)
  // Reverts if amount > remaining allocation
  // Pulls USDC from TreasuryVault

function reallocate(uint256 fromBudgetId, uint256 toBudgetId, uint256 amount)
    external onlyRole(CFO_ROLE);

function getBudgetStatus(uint256 budgetId) external view returns (Budget memory);

// Admin Functions
function pause() external onlyRole(CFO_ROLE);
function unpause() external onlyRole(CFO_ROLE);

// Events
event BudgetCreated(uint256 indexed budgetId, string name, uint256 allocation);
event BudgetSpent(uint256 indexed budgetId, uint256 amount, bytes32 paymentRef);
event BudgetReallocated(uint256 fromId, uint256 toId, uint256 amount);
```

### 3.4 ArcVaultAccessControl.sol

**Purpose:** Standalone role registry and reference implementation. Defines shared role constants and emergency pause/unpause. Each operational contract (TreasuryVault, PayoutRouter, BudgetManager) independently declares its own role constants rather than inheriting from this contract. This contract is **not deployed** by the deployment script — it exists as a reference.

```solidity
// Roles
bytes32 public constant CFO_ROLE = keccak256("CFO_ROLE");
bytes32 public constant TREASURY_MANAGER_ROLE = keccak256("TREASURY_MANAGER_ROLE");
bytes32 public constant AP_MANAGER_ROLE = keccak256("AP_MANAGER_ROLE");
bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

// Emergency (gated by CFO_ROLE in this contract)
function pause() external onlyRole(CFO_ROLE);
function unpause() external onlyRole(CFO_ROLE);
```

> **Note on pause role inconsistency:** BudgetManager gates `pause`/`unpause` with `CFO_ROLE`, while TreasuryVault and PayoutRouter gate them with `DEFAULT_ADMIN_ROLE`.

### 3.5 Mock Contracts (for dev/demo when real integrations unavailable)

**MockERC20.sol** — Generic ERC-20 with configurable decimals:
- `constructor(name, symbol, decimals)` → creates a mintable token
- `mint(address to, uint256 amount)` → permissionless mint (for testing)
- Used to create mock USDC (6 decimals) and EURC (6 decimals) in the deploy script

**MockUSYC.sol** — ERC-20 with simulated yield accrual (implements `IUSYC`):
- `deposit(uint256 usdcAmount)` → mints USYC tokens at current exchange rate
- `redeem(uint256 usycAmount)` → burns USYC, returns USDC at appreciated rate
- `setYieldRate(uint256 bps)` → owner sets simulated APY (default 500 = 5%)
- `getExchangeRate()` → view function returning projected rate including elapsed time
- `exchangeRate` public state variable (starts at `1e18`, accrues over time)
- Exchange rate increases linearly over time based on yield rate

**MockStableFX.sol** — Simulated RFQ + PvP swap (implements `IStableFX`):
- `requestQuote(address fromToken, address toToken, uint256 amount)` → returns a quote with simulated rate + 30s expiry
- `executeSwap(bytes32 quoteId)` → executes the swap atomically (pulls fromToken, sends toToken)
- `setRate(address from, address to, uint256 rate)` → owner configures FX rates (scaled to 1e18)
- Quote struct stores `fromToken`, `toToken`, `inputAmount`, `outputAmount`, `expiry`, `requester`, `executed`
- Contract must be pre-funded with destination tokens for swaps to succeed

---

## 4. API Routes (Next.js App Router)

All API routes live inside `packages/frontend/src/app/api/` and run as serverless functions on Vercel, connecting to Postgres on Railway via Prisma.

```
POST   /api/payouts              # Create single payout
POST   /api/payouts/batch        # Create batch payout (CSV upload or JSON)
GET    /api/payouts              # List payouts (with filters)
GET    /api/payouts/[id]         # Get payout details + status

GET    /api/fx/quote             # Request FX quote from StableFX
POST   /api/fx/execute           # Accept quote and trigger swap
GET    /api/fx/history           # FX transaction history

GET    /api/vault/status         # Current vault balances, yield, APY
GET    /api/vault/history        # Sweep/redeem event history

GET    /api/pipelines            # List saved pipeline configs
POST   /api/pipelines            # Create new pipeline config
GET    /api/pipelines/[id]       # Get pipeline with nodes + edges
PUT    /api/pipelines/[id]       # Update pipeline config
DELETE /api/pipelines/[id]       # Delete pipeline config
POST   /api/pipelines/[id]/execute  # Execute a pipeline (trigger batch payouts)
GET    /api/pipelines/[id]/history  # Execution history for a pipeline

GET    /api/dashboard            # Aggregated stats for dashboard overview
GET    /api/transactions         # Unified transaction log (audit trail)
```

### 4.1 Key Services (called from API routes)

All services use an adapter pattern with real and mock implementations, selected via `INTEGRATION_MODE` env var. A service factory in `services/index.ts` exports singleton instances.

**chain.service.ts** — On-chain data indexing:
- `indexContractEvents()` — No-op in mock mode; production indexes vault events
- `takeVaultSnapshot()` — Creates VaultSnapshot records (mock: derives from previous + random growth)
- `syncPayoutStatuses()` — No-op in mock mode

**cpn.service.ts** — CPN integration (adapter pattern):
- Interface: `sendPayment()`, `getPaymentStatus()`, `verifyCompliance()`
- Real implementation: Calls CPN API with credentials
- Mock implementation: Time-based status simulation (initiated → processing → settled over 30s)

**stablefx.service.ts** — StableFX integration (adapter pattern):
- Interface: `getQuote()`, `executeSwap()`, `getSupportedPairs()`
- Real implementation: Calls StableFX RFQ API
- Mock implementation: Returns simulated quotes with mid-market rates and random spread 3-8 bps, 30s expiry

**usyc.service.ts** — USYC yield position (adapter pattern):
- Interface: `deposit()`, `redeem()`, `getBalance()`, `getCurrentRate()`, `getYieldHistory()`
- Real implementation: Stubs that throw (requires on-chain client); `getYieldHistory()` reads VaultSnapshot table
- Mock implementation: Simulates $450K USYC balance at 4.85% APY

---

## 5. Database Schema (Prisma)

```prisma
model Transaction {
  id            String   @id @default(cuid())
  type          String   // DEPOSIT, WITHDRAW, SWEEP, REDEEM, PAYOUT, FX_SWAP, BUDGET_SPEND
  txHash        String?  @unique
  fromAddress   String?
  toAddress     String?
  amount        Decimal
  currency      String   // USDC, EURC, USYC
  status        String   // PENDING, PROCESSING, COMPLETED, FAILED
  metadata      Json?    // Flexible field for type-specific data
  chainId       Int
  blockNumber   Int?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Payout {
  id              String   @id @default(cuid())
  onChainId       Int      @unique   // payoutId from contract
  recipient       String
  amount          Decimal
  sourceCurrency  String
  targetCurrency  String
  reference       String?
  status          String   // Maps to PayoutStatus enum
  cpnPaymentId    String?  // CPN tracking ID
  txHash          String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model FXQuote {
  id            String   @id @default(cuid())
  fromCurrency  String
  toCurrency    String
  fromAmount    Decimal
  toAmount      Decimal
  rate          Decimal
  spread        Decimal
  expiresAt     DateTime
  status        String   // PENDING, ACCEPTED, EXPIRED, EXECUTED
  txHash        String?
  createdAt     DateTime @default(now())
}

model Pipeline {
  id          String   @id @default(cuid())
  name        String                        // "Monthly Payroll", "Q1 Contractors"
  nodes       Json                          // React Flow nodes array
  edges       Json                          // React Flow edges array
  metadata    Json?                         // Total cost, department summaries
  ownerWallet String                        // CFO wallet address
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  executions  PipelineExecution[]
}

model PipelineExecution {
  id          String   @id @default(cuid())
  pipelineId  String
  pipeline    Pipeline @relation(fields: [pipelineId], references: [id])
  status      String                        // PENDING, RUNNING, COMPLETED, PARTIAL_FAILURE, FAILED
  totalCost   Decimal
  fxCost      Decimal  @default(0)
  results     Json                          // Per-node execution results
  triggeredBy String                        // Wallet address
  startedAt   DateTime @default(now())
  completedAt DateTime?
}

model VaultSnapshot {
  id              String   @id @default(cuid())
  liquidUSDC      Decimal
  usycBalance     Decimal
  totalValue      Decimal
  yieldAccrued    Decimal
  apy             Decimal
  timestamp       DateTime @default(now())
}
```

---

## 6. Frontend — UX, Pages & Components

### 6.1 Design System

**Vibe:** Luxury fintech meets enterprise SaaS — gold accent, dark-first

**Color Palette:**

All colors use CSS custom properties (`var(--color-*)`) defined in `globals.css`, enabling seamless dark/light mode switching.

| Token | Purpose |
|-------|---------|
| `background` | Page background |
| `surface` | Card/panel background |
| `card-border` | Card border color |
| `primary` | Primary actions, links |
| `secondary` | Secondary text, borders |
| `success` | Positive states |
| `warning` | Warning states |
| `error` | Error states |
| `foreground` | Primary text |
| `muted` | Subdued text |
| `gold` | Brand accent (`#C9A962`) |

**Primary Gradient:** `linear-gradient(135deg, #D4A853, #B08D3E)` (gold)

**Typography:**
- Body: Inter (sans-serif) via `--font-inter`
- Display headings: Cormorant Garamond (serif, weights 500/600) via `--font-display`

**Theme:** Dark mode default (`next-themes`, `attribute="class"`, `enableSystem={false}`), dark/light toggle in header
**RainbowKit Accent:** `#C9A962` (gold) for both dark and light themes
**Cards:** Subtle ambient gold glow radial gradients on dark mode
**Animations:** `shimmer`, `fade-in`, `slide-up`, `pulse-status`, `slide-in-left`, `slide-in-right`, `flow-dash` (pipeline execution)
**Data density:** Enterprise-readable — well-spaced but information-rich

### 6.2 App Shell Layout

```
+-------+------------------------------------------+
| LOGO  |  Header: Search  |  Wallet  |  Theme     |
+-------+------------------------------------------+
|       |                                          |
| Dash  |                                          |
| Vault |            Page Content                  |
| FX    |                                          |
| Pipe  |                                          |
|       |                                          |
+-------+------------------------------------------+
                                          [+ Quick Pay FAB]
```

- **Fixed left sidebar:** Logo at top, navigation links (Dashboard, Vault, FX, Pipeline)
- **Top header:** Search, wallet connect (RainbowKit), dark/light theme toggle
- **Content area:** Takes remaining space
- **Floating Action Button (FAB):** "Quick Pay" button in bottom-right corner, available on every page, opens a modal for ad-hoc one-off payments

### 6.3 Pages

#### Dashboard Overview (`/`)

Finance-first layout — money metrics at a glance.

```
+--------------------------------------------------+
| Total AUM          | Yield Earned   | Current APY |
| $1,245,000         | $4,230/mo      | 4.85%       |
+--------------------------------------------------+
| Liquid USDC    | USYC Position  | Pending Payouts |
| $50,000        | $1,195,000     | 3 ($45,000)     |
+--------------------------------------------------+
|  [Yield Over Time - Line Chart]  | [Allocation  ] |
|  ________________________________| [  Pie Chart ] |
+--------------------------------------------------+
| Recent Activity                                   |
| > Sweep $25K to USYC          2 min ago           |
| > Payout $5K EURC to 0xAB...  15 min ago          |
| > FX Swap $10K USDC→EURC      1 hr ago            |
+--------------------------------------------------+
```

**Components:**
- `StatCard` — large number + label + trend indicator
- `YieldChart` — Recharts line chart with time-range selector (1D, 1W, 1M, 3M)
- `AllocationPie` — Recharts pie chart (liquid USDC vs USYC)
- `ActivityFeed` — scrollable list of recent transactions with type icon, amount, time

#### Treasury Vault (`/vault`)

**Top section — Balances:**
- Liquid USDC balance
- USYC position value
- Total vault value
- Accrued yield

**Yield tracking — Detailed breakdown:**
- Daily/weekly/monthly yield toggle
- Projected annual earnings
- Current APY with trend indicator
- Yield-over-time line chart (Recharts, time-range selector: 1D, 1W, 1M, 3M, ALL)
- Yield accrual history table

**Liquidity threshold — Visual slider + input:**
```
Total: $1,000,000

[========================================]
[  USYC: $950K  |||||  Liquid: $50K     ]
[========================================]
                 ^ drag threshold

Threshold: $ [50,000]    [Update]

If changed to $75,000:
  > $25,000 would be redeemed from USYC
  > New liquid balance: $75,000
  > New USYC position: $925,000
```

**Actions:** Deposit USDC, Withdraw USDC, Manual sweep/redeem buttons
**History:** Sweep & redemption event log table with timestamps, amounts, tx hashes

#### FX Conversion (`/fx`)

Uniswap-style centered swap card:

```
          +-----------------------------+
          |  From                       |
          |  [USDC v]    [10,000.00]    |
          |  Balance: $50,000           |
          |                             |
          |        [ ⇅ swap icon ]      |
          |                             |
          |  To                         |
          |  [EURC v]    [9,234.50]     |
          |                             |
          |  Rate: 1 USDC = 0.9235 EURC |
          |  Spread: 0.05%              |
          |  Quote expires: 0:28        |
          |                             |
          |  [    Execute Swap    ]      |
          +-----------------------------+
```

**Below the swap card:**
- FX transaction history table (pair, rate, amounts, timestamp, status, tx hash)

#### Pipeline Builder (`/pipeline`) — **Core Feature**

Visual payment orchestration canvas powered by **React Flow**.

```
+----------+--------------------------------------+
| Blocks   |                                      |
|          |         Canvas                       |
| [Dept]   |                                      |
| [Empl]   |   [Treasury] ---+--- [Engineering]  |
| [Contr]  |                 |    $120K/mo        |
|          |                 |     |               |
| -------- |                 |   [Dev1] [Dev2]    |
| Saved    |                 |   $5K    $5K       |
| Configs  |                 |   USDC   EURC      |
| [Payroll]|                 |                     |
| [Contrs] |                 +--- [Marketing]     |
|          |                      $80K/mo         |
| -------- |                                      |
| [Execute |   [Contractors] ---+--- [Vendor1]    |
|  Pipeline]|                   +--- [Vendor2]    |
+----------+--------------------------------------+
```

**Left panel — Block palette:**
- Draggable block types: Department, Employee, Contractor
- Saved pipeline configurations (e.g., "Monthly Payroll", "Q1 Contractors")
- "Execute Pipeline" button
- Pipeline cost summary (total USDC needed, FX costs, USYC redemptions)

**Canvas area:**
- React Flow node-based editor with zoom/pan
- Drag blocks from palette onto canvas
- Connect nodes by dragging edges
- Treasury Source node is always at the root

**Node types:**

| Node | Visual | Data |
|------|--------|------|
| Treasury Source | Large blue node | Shows available USDC + USYC balance |
| Department | Medium card with budget bar | Name, budget cap, total cost, spent/remaining |
| Employee | Small card | Name, wallet, monthly amount, currency preference (USDC/EURC) |
| Contractor | Small card (different accent) | Name, wallet, amount, currency, payment type (recurring/milestone) |
| FX Conversion | Auto-inserted orange node | Appears when currency != USDC, shows conversion rate |

**Inline node expansion:**
Clicking any employee/contractor node expands it in-place to show editable fields:
- Name, wallet address, payment amount, currency selector, payment schedule
- Last payment date, total paid history
- Other nodes shift to accommodate

**Pipeline execution animation:**
1. CFO clicks "Execute Pipeline"
2. Pre-execution summary modal: total cost, FX conversions needed, USYC redemptions, per-department breakdown
3. On confirm:
   - Flowing animated dots travel along connection lines from Treasury → Departments → Employees
   - Each node transitions: gray (pending) → yellow (processing) → green (completed) / red (failed)
   - Collapsible step-by-step log panel on the right shows detailed status per payment
4. Final summary: X payments completed, Y failed, total cost, FX fees

**Save & load:**
- Multiple pipeline configurations stored in Postgres
- CFO can create, rename, duplicate, and delete pipeline configs
- Each config stores: node positions, connections, all recipient data, department budgets
- Execution history per pipeline config

#### Quick Pay Modal (Floating Action Button)

Available on every page via the floating `+` button in the bottom-right.

```
+-------------------------------+
|  Quick Pay                 X  |
+-------------------------------+
|  Recipient: [0x... or ENS]    |
|  Amount:    [$5,000]          |
|  Currency:  [EURC v]          |
|  Memo:      [Invoice #42]    |
|                               |
|  Est. cost: $5,024 USDC      |
|  FX rate: 0.9235              |
|                               |
|  [Cancel]    [Send Payment]   |
+-------------------------------+
```

### 6.4 Key Frontend Hooks

```typescript
// On-chain reads via wagmi + TanStack Query (polling every 30s)
useVaultBalances()        // multicall: liquid USDC, USYC balance, total value, yield
useVaultHistory()         // sweep/redeem events from backend
useYieldBreakdown()       // daily/weekly/monthly yield data
usePayoutStatus(id)       // single payout tracking
usePayouts(filters)       // payout list from backend
useFXQuote(pair, amount)  // live quote from backend → StableFX (polls 25s)
useFXHistory()            // FX swap history
useDashboardStats()       // aggregated dashboard data

// Pipeline-specific hooks
usePipelines()            // list saved pipeline configs
usePipeline(id)           // single pipeline with nodes + edges
usePipelineExecution(id)  // execution status + animation state (polls 2s during execution)
useSavePipeline()         // save/update pipeline config

// Contract writes via wagmi
useDeposit()              // TreasuryVault.depositFunds()
useWithdraw()             // TreasuryVault.withdrawFunds()
useSetThreshold()         // TreasuryVault.setLiquidityThreshold()
useExecutePayout()        // PayoutRouter.executePayout()
useBatchPayout()          // PayoutRouter.batchPayout()
useExecuteSwap()          // Accept FX quote
useCreateBudget()         // BudgetManager.createBudget()
useSpendBudget()          // BudgetManager.spendFromBudget()

// Utility
useDebounce(value, delay) // debounced value (500ms default)
```

---

## 7. External Integration Adapter Pattern

All external integrations use an adapter interface so real and mock implementations are swappable via env var.

```typescript
// ENV: INTEGRATION_MODE=real|mock

interface IUSYCAdapter {
  deposit(amount: bigint): Promise<TxResult>;
  redeem(amount: bigint): Promise<TxResult>;
  getBalance(address: string): Promise<bigint>;
  getCurrentRate(): Promise<number>;
  getYieldHistory(days: number): Promise<YieldDataPoint[]>;
}

interface IStableFXAdapter {
  getQuote(from: string, to: string, amount: bigint): Promise<FXQuote>;
  executeSwap(quoteId: string): Promise<TxResult>;
  getSupportedPairs(): Promise<string[]>;
}

interface ICPNAdapter {
  sendPayment(params: CPNPaymentParams): Promise<CPNPaymentResult>;
  getPaymentStatus(paymentId: string): Promise<CPNStatus>;
  verifyCompliance(address: string): Promise<ComplianceResult>;
}
```

---

## 8. Arc Testnet Configuration

```typescript
// lib/chains.ts
import { defineChain } from 'viem';

export const arcTestnet = defineChain({
  id: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID) || 1397,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'ARC',
    symbol: 'ARC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://testnet-rpc.arc.io'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arc Explorer',
      url: process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || 'https://testnet-explorer.arc.io',
    },
  },
  testnet: true,
});
```

| Setting | Value |
|---------|-------|
| Chain ID | `1397` (env: `NEXT_PUBLIC_ARC_CHAIN_ID`) |
| RPC URL | `https://testnet-rpc.arc.io` (env: `NEXT_PUBLIC_ARC_RPC_URL`) |
| Explorer | `https://testnet-explorer.arc.io` (env: `NEXT_PUBLIC_ARC_EXPLORER_URL`) |
| Native Currency | ARC (18 decimals) |

---

## 9. Seed Data & Demo Mode

For hackathon demo, the system starts with pre-populated data:

**On-chain (deployment script `Deploy.s.sol`):**
- Deploy MockERC20 (USDC, 6 decimals) and MockERC20 (EURC, 6 decimals)
- Deploy MockUSYC (wraps USDC) and MockStableFX
- Set FX rates: USDC→EURC `0.9235e18`, EURC→USDC `1.0828e18`
- Deploy TreasuryVault (threshold: 100k USDC), PayoutRouter, BudgetManager
- Grant `TREASURY_MANAGER_ROLE` on vault to PayoutRouter and BudgetManager
- Mint 10M USDC to deployer, 1M USDC to vault, 10M USDC to MockUSYC, 10M EURC to MockStableFX

**Off-chain (Prisma seed script):**
- Transaction history spanning past 30 days
- Vault snapshots showing yield growth over time
- Completed payouts to various recipients in different currencies
- FX swap history with various pairs

---

## 10. Deployment Pipeline

**Contracts:**
1. `forge build` → compile
2. `forge test` → run tests
3. `forge script script/Deploy.s.sol --rpc-url $ARC_RPC --broadcast` → deploy to Arc testnet
4. Save deployed addresses to `packages/contracts/deployments/arc-testnet.json`

**Next.js App (Vercel):**
1. Push to main → Vercel auto-deploys
2. Env vars: `DATABASE_URL` (Railway Postgres), `NEXT_PUBLIC_ARC_RPC_URL`, `NEXT_PUBLIC_ARC_CHAIN_ID`, contract addresses, `CPN_API_KEY`, `STABLEFX_API_KEY`, `INTEGRATION_MODE`
3. Prisma generates client at build time

**Database (Railway):**
1. Postgres instance on Railway
2. `prisma migrate deploy` runs as part of Vercel build or via CLI
3. Seed script populates demo data

---

## 11. Development Order (< 1 week)

Given the tight timeline and team of 2-3:

**Day 1-2: Foundation**
- [ ] Monorepo setup (pnpm workspace, configs, tooling)
- [ ] Smart contracts: TreasuryVault + AccessControl + MockUSYC + BudgetManager
- [ ] Next.js scaffold, Prisma schema (incl. Pipeline models), DB migrations
- [ ] Frontend: Tailwind config, design tokens, layout shell (sidebar + header), wallet connect, dark/light theme toggle

**Day 3-4: Core Modules**
- [ ] Smart contracts: PayoutRouter + MockStableFX
- [ ] API routes: vault, FX, dashboard, transactions, pipelines CRUD
- [ ] Frontend: Dashboard overview page, Treasury Vault page (with threshold slider), FX swap card
- [ ] Frontend: Pipeline Builder canvas foundation (React Flow setup, node types, drag-from-palette)

**Day 5: Pipeline Builder + Integration**
- [ ] Pipeline Builder: inline node expansion, save/load configs, execution flow
- [ ] Pipeline execution: animation (flowing dots + step log), batch payout trigger via PayoutRouter
- [ ] Quick Pay floating action button + modal
- [ ] End-to-end flow: deposit → sweep → pipeline execute → FX → settlement
- [ ] Deploy contracts to Arc testnet

**Day 6: Polish & Demo**
- [ ] Seed data scripts (on-chain + off-chain, including demo pipeline configs)
- [ ] UI polish: animations, micro-interactions, responsive checks
- [ ] Pipeline execution animation fine-tuning
- [ ] Deploy frontend (Vercel) + DB (Railway)
- [ ] Demo run-through, fix bugs

**Day 7: Buffer / Demo Day**
- [ ] Final bug fixes
- [ ] Demo prep

---

## 12. Verification

- **Contracts:** `forge test` — unit tests for all vault logic, payout flows, budget enforcement
- **API:** Tests via Vitest for each API route
- **Frontend:** Component renders correctly, wallet connects, contract interactions work on testnet
- **E2E:** Full flow — connect wallet → deposit USDC → see auto-sweep → request FX quote → execute payout → track status → check budget spending
- **Demo:** Seed data populates dashboard, live transactions work on Arc testnet
