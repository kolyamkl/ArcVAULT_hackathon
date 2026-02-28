
# ArcVault Frontend — Agent Team Playbook

> **Purpose:** This playbook defines a 5-member agent team that implements the entire ArcVault frontend. It is self-contained — the lead reads this file and spawns all teammates.
>
> **Mode:** `tmux` split-pane (one terminal per teammate)
>
> **Rule:** Every teammate must submit a plan to the lead for approval BEFORE writing any code.

---

## 1. Team Overview

### Goal

Implement the complete ArcVault frontend — a Web3 enterprise treasury management dashboard with real-time on-chain data, FX conversions, a visual pipeline builder, and quick-pay functionality.

### Scope

All files under `packages/frontend/src/` as defined by the 8 frontend specification docs in `docs/frontend/`.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS (dark-mode-first, CSS variables) |
| State (server) | TanStack Query v5 |
| State (client) | Zustand v4 |
| Blockchain | wagmi v2 + viem v2 |
| Wallet | RainbowKit |
| Charts | Recharts |
| Canvas | React Flow |
| Icons | Lucide React |

### Hackathon Constraints

- Prefer speed over perfection — working code > perfect abstractions.
- Use mock data or hardcoded values where APIs/contracts are not yet deployed.
- All components must support both dark and light mode via CSS variables.
- No external UI libraries (no shadcn, no MUI, no Chakra) — hand-built with Tailwind.

---

## 2. Team Structure

```
LAYER 1 (Foundation — parallel, no file conflicts):
  ├─ "Foundation Builder"   → 01-design-system + 02-app-shell
  └─ "Data Layer Engineer"  → 08-hooks-and-state

LAYER 2 (Pages — parallel, depends on Layer 1):
  ├─ "Core Pages Dev"       → 03-dashboard + 04-vault + 05-fx
  └─ "Pipeline Builder Dev" → 06-pipeline-builder + 07-quick-pay

ALWAYS ACTIVE:
  └─ "Devil's Advocate"     → Reviews all code, challenges decisions
```

---

## 3. Teammate Definitions

---

### 3.1 Foundation Builder

**Role:** Builds the design system primitives, app shell, layout, providers, and library utilities that every other teammate depends on.

**Assigned Docs:**
- `docs/frontend/01-design-system.md`
- `docs/frontend/02-app-shell.md`

**Owned Files (21 files):**

```
# Design System (doc 01)
packages/frontend/tailwind.config.ts
packages/frontend/src/app/globals.css
packages/frontend/src/components/shared/Card.tsx
packages/frontend/src/components/shared/StatCard.tsx
packages/frontend/src/components/shared/Button.tsx
packages/frontend/src/components/shared/StatusBadge.tsx
packages/frontend/src/components/shared/DataTable.tsx
packages/frontend/src/components/shared/Modal.tsx
packages/frontend/src/components/shared/Input.tsx
packages/frontend/src/components/shared/Select.tsx
packages/frontend/src/components/shared/Skeleton.tsx

# App Shell (doc 02)
packages/frontend/src/app/layout.tsx
packages/frontend/src/providers/index.tsx
packages/frontend/src/providers/wagmi.ts
packages/frontend/src/components/layout/Sidebar.tsx
packages/frontend/src/components/layout/Header.tsx
packages/frontend/src/components/layout/ThemeToggle.tsx
packages/frontend/src/lib/chains.ts
packages/frontend/src/lib/contracts.ts
packages/frontend/src/lib/api.ts
packages/frontend/src/types/api.ts
```

**Implementation Instructions:**

1. **Read** `docs/frontend/01-design-system.md` and `docs/frontend/02-app-shell.md` in full.
2. **Start with** `tailwind.config.ts` and `globals.css` — these define the design tokens every other file uses.
3. **Build shared components** in order: `Skeleton` (simplest) → `Card` → `Button` → `Input` → `Select` → `StatusBadge` → `StatCard` → `Modal` → `DataTable`.
4. **Build the app shell**: `layout.tsx` (root layout) → `Providers` (wagmi + RainbowKit + TanStack Query + ThemeProvider) → `Sidebar` → `Header` → `ThemeToggle`.
5. **Build lib files**: `chains.ts` (Arc testnet chain def) → `contracts.ts` (addresses + ABI re-exports) → `api.ts` (fetch wrapper).
6. **Create** `types/api.ts` with all API response type interfaces referenced by `api.ts`.
7. **Do NOT** build `QuickPayFAB.tsx` — that belongs to Pipeline Builder Dev. In `layout.tsx`, add a commented placeholder import: `// import { QuickPayFAB } from '@/components/quick-pay/QuickPayFAB';`

**Key Requirements:**
- All colors MUST use CSS variable tokens (`var(--color-*)`) — never hardcoded hex values in components.
- Dark mode is the default (`defaultTheme="dark"` in ThemeProvider).
- Every shared component MUST accept a `className` prop for composition.
- `StatCard` value must animate with a count-up effect on mount.
- `Modal` must lock body scroll, close on Escape, and close on backdrop click.
- `Select` must be a custom dropdown (not native `<select>`), close on outside click or Escape.
- `DataTable` must show `Skeleton` rows when `loading` is true.
- `Sidebar` must be collapsible on mobile with a hamburger toggle in the Header.

**Completion Criteria:**
- [ ] `tailwind.config.ts` extends colors, keyframes, animations, and fonts per doc 01 section 4
- [ ] `globals.css` has light/dark CSS variable definitions per doc 01 section 5
- [ ] All 9 shared components render correctly in isolation
- [ ] App shell renders: sidebar (with active route highlighting) + header + main content area
- [ ] Providers wrap correctly: ThemeProvider > WagmiProvider > QueryClientProvider > RainbowKitProvider
- [ ] `api.ts` exports a typed API client with all endpoint methods
- [ ] Dark mode toggle works (switches class on `<html>`, persists via localStorage)
- [ ] Responsive: sidebar collapses on mobile, cards stack, tables scroll horizontally

**Dependencies:** None (Layer 1 — starts immediately)

---

### 3.2 Data Layer Engineer

**Role:** Builds all data-fetching hooks, contract write hooks, Zustand stores, query configuration, and shared utilities that pages consume.

**Assigned Doc:**
- `docs/frontend/08-hooks-and-state.md`

**Owned Files (25 files):**

```
# TanStack Query Config
packages/frontend/src/providers/query.ts
packages/frontend/src/lib/queryKeys.ts

# Data-Fetching Hooks (11 hooks)
packages/frontend/src/hooks/useDashboardStats.ts
packages/frontend/src/hooks/useVaultBalances.ts
packages/frontend/src/hooks/useVaultHistory.ts
packages/frontend/src/hooks/useYieldBreakdown.ts
packages/frontend/src/hooks/useFXQuote.ts
packages/frontend/src/hooks/useFXHistory.ts
packages/frontend/src/hooks/usePayouts.ts
packages/frontend/src/hooks/usePayoutStatus.ts
packages/frontend/src/hooks/usePipelines.ts
packages/frontend/src/hooks/usePipeline.ts
packages/frontend/src/hooks/usePipelineExecution.ts

# Contract Write Hooks (9 hooks)
packages/frontend/src/hooks/useDeposit.ts
packages/frontend/src/hooks/useWithdraw.ts
packages/frontend/src/hooks/useSetThreshold.ts
packages/frontend/src/hooks/useExecutePayout.ts
packages/frontend/src/hooks/useBatchPayout.ts
packages/frontend/src/hooks/useExecuteSwap.ts
packages/frontend/src/hooks/useCreateBudget.ts
packages/frontend/src/hooks/useSpendBudget.ts
packages/frontend/src/hooks/useSavePipeline.ts

# Zustand Stores
packages/frontend/src/stores/ui.store.ts
packages/frontend/src/stores/pipeline.store.ts

# Utilities
packages/frontend/src/lib/utils.ts
```

**Implementation Instructions:**

1. **Read** `docs/frontend/08-hooks-and-state.md` in full. This is your single source of truth.
2. **Start with** `query.ts` (QueryClient config) and `queryKeys.ts` (centralized key factory).
3. **Build utilities** in `utils.ts`: `formatCurrency`, `formatCompact`, `shortenAddress`, `formatRelativeTime`, `formatAPY`, `useDebounce`.
4. **Build data-fetching hooks** — each one wraps a TanStack Query `useQuery` call with the appropriate query key from `queryKeys.ts` and API call from `api.ts`. Follow the exact patterns in doc 08.
5. **Build contract write hooks** — each one wraps `useMutation` with `useWriteContract` + `waitForTransactionReceipt` + query invalidation on success.
6. **Build Zustand stores**: `ui.store.ts` (sidebar, quickPayOpen, theme) → `pipeline.store.ts` (pipeline editor state, execution progress, execution log).
7. **Coordinate with Foundation Builder** — your `query.ts` exports `queryClient`, which `providers/index.tsx` (Foundation Builder) imports. Agree on the import path early.

**Key Requirements:**
- ALL query keys MUST go through the `queryKeys` factory — no inline key arrays.
- Data-fetching hooks: `staleTime: 10_000`, `refetchInterval: 10_000` by default. FX quotes use `staleTime: 25_000`.
- Contract write hooks: always call `publicClient.waitForTransactionReceipt` after `writeContractAsync`.
- Contract write hooks: always invalidate relevant query keys in `onSuccess`.
- `useVaultBalances` reads 5 contract functions in a single `useReadContracts` call with `refetchInterval: 10_000`.
- `usePipelineExecution` polls every 2s during execution, stops when COMPLETED or FAILED.
- `usePayoutStatus` polls every 5s while PENDING or PROCESSING.
- Pipeline store uses `Map<string, NodeStatus>` for execution progress tracking.
- `useDebounce` must be a proper React hook with cleanup.

**Completion Criteria:**
- [ ] `queryKeys.ts` covers all 5 domains: dashboard, vault, fx, payouts, pipelines
- [ ] All 11 data-fetching hooks compile and follow the documented patterns
- [ ] All 9 contract write hooks compile with proper mutation + receipt waiting + cache invalidation
- [ ] `ui.store.ts` manages sidebar toggle, quickPay modal, and theme state
- [ ] `pipeline.store.ts` manages pipeline ID/name/dirty state + execution progress map + execution log
- [ ] `utils.ts` exports all formatting functions with correct output formats
- [ ] No hooks import from page-specific component files (hooks are standalone)

**Dependencies:** None (Layer 1 — starts immediately)

**Coordination Note:** Foundation Builder owns `providers/index.tsx` which imports your `queryClient`. Ensure `query.ts` exports it as a named export. Foundation Builder should import it: `import { queryClient } from '@/providers/query';`

---

### 3.3 Core Pages Dev

**Role:** Builds the three main application pages — Dashboard, Treasury Vault, and FX Conversion — along with their page-specific components.

**Assigned Docs:**
- `docs/frontend/03-dashboard-page.md`
- `docs/frontend/04-vault-page.md`
- `docs/frontend/05-fx-page.md`

**Owned Files (18 files):**

```
# Dashboard (doc 03)
packages/frontend/src/app/page.tsx
packages/frontend/src/components/vault/YieldChart.tsx
packages/frontend/src/components/vault/AllocationPie.tsx
packages/frontend/src/components/shared/ActivityFeed.tsx
packages/frontend/src/components/shared/ActivityItem.tsx
packages/frontend/src/lib/format.ts

# Vault (doc 04)
packages/frontend/src/app/vault/page.tsx
packages/frontend/src/components/vault/YieldBreakdown.tsx
packages/frontend/src/components/vault/YieldHistoryTable.tsx
packages/frontend/src/components/vault/ThresholdSlider.tsx
packages/frontend/src/components/vault/DepositModal.tsx
packages/frontend/src/components/vault/WithdrawModal.tsx
packages/frontend/src/components/vault/VaultHistoryTable.tsx

# FX (doc 05)
packages/frontend/src/app/fx/page.tsx
packages/frontend/src/components/fx/FXSwapCard.tsx
packages/frontend/src/components/fx/CurrencySelector.tsx
packages/frontend/src/components/fx/QuoteDisplay.tsx
packages/frontend/src/components/fx/FXHistoryTable.tsx
```

**Implementation Instructions:**

1. **Read** docs 03, 04, and 05 in full.
2. **Wait for Layer 1** — you need Foundation Builder's shared components (`Card`, `StatCard`, `Button`, `Input`, `Select`, `Modal`, `DataTable`, `Skeleton`) and Data Layer Engineer's hooks.
3. **Build Dashboard first** (simplest page):
   - `page.tsx` — 6 StatCards in 2 rows, charts row, activity feed
   - `YieldChart.tsx` — Recharts `AreaChart` with gradient fill, time range selector, custom tooltip
   - `AllocationPie.tsx` — Recharts donut chart with center label and legend
   - `ActivityFeed.tsx` + `ActivityItem.tsx` — scrollable activity list with type-based icons and colors
   - `format.ts` — `formatCurrency`, `formatPercentage`, `formatRelativeTime`, `truncateAddress`
4. **Build Vault page** (most complex page):
   - `page.tsx` — 4 balance cards + yield section + threshold control + action buttons + history table + modals
   - `YieldBreakdown.tsx` — metric row with time range selector
   - `YieldHistoryTable.tsx` — uses `DataTable` from design system
   - `ThresholdSlider.tsx` — visual allocation bar with draggable handle, input, and impact preview
   - `DepositModal.tsx` — 2-step flow (approve → deposit), uses `Modal` + `Input` + `Button`
   - `WithdrawModal.tsx` — similar, with role check for TREASURY_MANAGER_ROLE
   - `VaultHistoryTable.tsx` — filterable table using `DataTable` + `StatusBadge`
5. **Build FX page**:
   - `page.tsx` — centered swap card + full-width history table
   - `FXSwapCard.tsx` — from/to currency selectors, amount inputs, swap direction button, quote display, execute button
   - `CurrencySelector.tsx` — dropdown with flag emojis, `exclude` prop to prevent same-pair
   - `QuoteDisplay.tsx` — rate, spread, countdown timer (turns amber at 10s, auto-refreshes at 0)
   - `FXHistoryTable.tsx` — paginated table with `StatusBadge` for status

**Key Requirements:**
- Import shared components from `@/components/shared/*` — do NOT recreate them.
- Import hooks from `@/hooks/*` — do NOT redefine data-fetching logic.
- `YieldChart.tsx` is shared between Dashboard and Vault — accept `showTimeRangeSelector` prop to control whether the time range buttons render (Dashboard: true, Vault: false because `YieldBreakdown` controls it).
- `ThresholdSlider` drag handle must snap to $1,000 increments.
- `DepositModal` must check USDC allowance and show "Approve USDC" step if insufficient.
- `QuoteDisplay` countdown must warn at 10 seconds (amber text) and auto-refresh at 0.
- All pages must show loading skeletons during initial fetch.
- All pages must handle error states with retry buttons.
- All pages use `animate-fade-in` on mount.
- All amount displays use `formatCurrency` from `@/lib/format.ts`.

**Completion Criteria:**
- [ ] Dashboard renders 6 StatCards, YieldChart, AllocationPie, ActivityFeed
- [ ] Dashboard polls data every 10s and prefers on-chain balances over API data
- [ ] Vault page renders 4 balance cards with threshold-aware coloring
- [ ] Vault page YieldBreakdown shows daily/weekly/monthly metrics with time range control
- [ ] Vault page ThresholdSlider shows visual bar, draggable handle, input, and impact preview
- [ ] Vault page DepositModal handles approve → deposit 2-step flow
- [ ] Vault page VaultHistoryTable supports type filtering and pagination
- [ ] FX page FXSwapCard debounces amount input by 500ms before fetching quotes
- [ ] FX page QuoteDisplay shows countdown, turns amber at 10s, refreshes at 0
- [ ] FX page FXHistoryTable renders with pagination and status badges
- [ ] All pages show loading skeletons and error states

**Dependencies:**
- **Blocked by Foundation Builder** (T1–T6): needs shared components and app shell
- **Blocked by Data Layer Engineer** (T7–T9): needs hooks and utilities

---

### 3.4 Pipeline Builder Dev

**Role:** Builds the Pipeline Builder canvas (the signature feature) and the Quick Pay FAB + modal.

**Assigned Docs:**
- `docs/frontend/06-pipeline-builder.md`
- `docs/frontend/07-quick-pay.md`

**Owned Files (16 files):**

```
# Pipeline Builder (doc 06)
packages/frontend/src/app/pipeline/page.tsx
packages/frontend/src/components/pipeline/PipelineCanvas.tsx
packages/frontend/src/components/pipeline/BlockPalette.tsx
packages/frontend/src/components/pipeline/SavedConfigs.tsx
packages/frontend/src/components/pipeline/PipelineSummary.tsx
packages/frontend/src/components/pipeline/nodes/TreasurySourceNode.tsx
packages/frontend/src/components/pipeline/nodes/DepartmentNode.tsx
packages/frontend/src/components/pipeline/nodes/EmployeeNode.tsx
packages/frontend/src/components/pipeline/nodes/ContractorNode.tsx
packages/frontend/src/components/pipeline/nodes/FXConversionNode.tsx
packages/frontend/src/components/pipeline/ExecutionModal.tsx
packages/frontend/src/components/pipeline/ExecutionLog.tsx
packages/frontend/src/components/pipeline/ExecutionAnimation.tsx

# Quick Pay (doc 07)
packages/frontend/src/components/quick-pay/QuickPayFAB.tsx
packages/frontend/src/components/quick-pay/QuickPayModal.tsx
packages/frontend/src/components/quick-pay/PaymentSummary.tsx
```

**Implementation Instructions:**

1. **Read** docs 06 and 07 in full.
2. **Wait for Layer 1** — you need Foundation Builder's shared components and Data Layer Engineer's hooks + stores.
3. **Build Quick Pay first** (smaller, simpler):
   - `QuickPayFAB.tsx` — fixed-position gradient FAB button, opens modal via `useUIStore.openQuickPay`
   - `QuickPayModal.tsx` — form with recipient, amount, currency, memo fields; FX quote when currency != USDC; send payment flow
   - `PaymentSummary.tsx` — cost breakdown display (with/without FX)
   - After completion, coordinate with Foundation Builder to add `<QuickPayFAB />` to `layout.tsx`
4. **Build Pipeline Builder** (most complex feature):
   - **Phase A — Canvas + Nodes:**
     - `PipelineCanvas.tsx` — React Flow wrapper with background, controls, minimap, drag-and-drop handler
     - `TreasurySourceNode.tsx` — read-only node showing vault balances (source handle only)
     - `DepartmentNode.tsx` — editable name + budget cap, utilization bar, expand on click
     - `EmployeeNode.tsx` — editable name/wallet/amount/currency/schedule, currency badge
     - `ContractorNode.tsx` — like Employee + paymentType and milestoneDescription fields
     - `FXConversionNode.tsx` — auto-inserted pill node showing conversion rate
   - **Phase B — Left Panel:**
     - `BlockPalette.tsx` — draggable node templates (Department, Employee, Contractor)
     - `SavedConfigs.tsx` — pipeline list with New/Save/Save As/Delete; uses `usePipelines` + `useSavePipeline`
     - `PipelineSummary.tsx` — computed total cost, FX count, USYC redemption needed; "Execute Pipeline" button
   - **Phase C — Execution:**
     - `ExecutionModal.tsx` — pre-execution summary (dept breakdown, FX conversions, recipient table, confirm button)
     - `ExecutionAnimation.tsx` — orchestrates node status transitions (pending → processing → completed/failed) via pipeline store
     - `ExecutionLog.tsx` — right-side panel with progressive log entries, auto-scroll, collapsible

**Key Requirements:**
- React Flow canvas must validate connections: Treasury → Department allowed, Department → Employee/Contractor allowed, leaf nodes cannot have outgoing connections.
- Auto-insert `FXConversionNode` when connecting to a non-USDC recipient.
- TreasurySourceNode cannot be deleted and always starts at position `{ x: 100, y: 300 }`.
- Node expansion: clicking an editable node toggles `data.expanded`, showing inline form fields.
- Edge styles: gray dashed (default), yellow animated (processing), green solid (completed), red solid (failed).
- Pipeline store's `executionProgress` Map drives node and edge visual states.
- Execution animation cascades from source → departments → recipients with ~1-2s per stage.
- Quick Pay modal resets form state on close.
- Quick Pay handles 2-step FX+Payout when currency != USDC.
- QuickPayFAB must have `aria-label="Quick Pay"`.

**Completion Criteria:**
- [ ] Quick Pay FAB renders on all pages (fixed bottom-right, gradient, hover scale effect)
- [ ] Quick Pay modal validates recipient (hex address or ENS format) and amount (> 0)
- [ ] Quick Pay PaymentSummary shows FX breakdown when currency != USDC
- [ ] Quick Pay successfully executes payment flow (FX swap if needed → payout → API record)
- [ ] Pipeline canvas supports drag-and-drop from palette
- [ ] All 5 node types render correctly with proper handles and styling
- [ ] Connection rules enforced (invalid connections rejected)
- [ ] FXConversionNode auto-inserts on cross-currency connections
- [ ] Node expansion shows inline edit form
- [ ] Department utilization bar changes color at 80%/100% thresholds
- [ ] Save/Load pipeline works via API
- [ ] Execution animation cascades through the graph with correct timing
- [ ] ExecutionLog shows progressive entries with status icons
- [ ] ExecutionModal shows pre-execution summary with department breakdown

**Dependencies:**
- **Blocked by Foundation Builder** (T1–T6): needs shared components, app shell, and lib files
- **Blocked by Data Layer Engineer** (T7–T10): needs hooks AND Zustand stores (pipeline store is critical)

---

### 3.5 Devil's Advocate

**Role:** Read-only reviewer. Does NOT write implementation code. Challenges all decisions, reviews all plans before lead approves them, and performs post-implementation review of every file.

**Assigned Docs:**
- ALL docs in `docs/frontend/` (for reference)
- ALL files created by other teammates (for review)

**Owned Files:** None. This teammate does not create or modify any implementation files.

**Review Instructions:**

#### Pre-Implementation Plan Review

When any teammate submits their plan to the lead, the Devil's Advocate MUST review it and provide feedback BEFORE the lead approves. Check for:

1. **Spec compliance** — Does the plan match the doc exactly? Missing components? Missing props? Wrong file paths?
2. **Over-engineering** — Is the teammate adding unnecessary abstraction, extra config, or features not in the spec?
3. **Missing edge cases** — Loading states? Error states? Empty states? Wallet not connected? Insufficient role?
4. **File ownership conflicts** — Is the teammate planning to create/modify files owned by another teammate?
5. **Import path correctness** — Are imports using the `@/` alias correctly?
6. **Dependency ordering** — Is the teammate trying to build something before its dependencies exist?

#### Post-Implementation Code Review

After a teammate finishes their work, review every file they created. Check:

**Design System Compliance:**
- [ ] No hardcoded color values (hex/rgb) — must use CSS variable tokens via Tailwind classes (`bg-surface`, `text-foreground`, `border-card-border`, etc.)
- [ ] Correct Tailwind classes from the spec (not approximate — exact classes)
- [ ] Components accept `className` prop where documented
- [ ] Gradient primary uses `bg-gradient-primary` not a custom gradient

**Responsive Design:**
- [ ] Cards stack vertically on mobile (`grid-cols-1`)
- [ ] Tables have `overflow-x-auto` wrapper
- [ ] Sidebar collapses on mobile (< 768px)
- [ ] 2-column layouts at tablet (768px–1024px)
- [ ] Full layouts at desktop (> 1024px)

**Loading States:**
- [ ] Every data-dependent component shows Skeleton shimmer when loading
- [ ] StatCards show skeleton cards
- [ ] Tables show skeleton rows
- [ ] Charts show skeleton rectangles/circles

**Error States:**
- [ ] API failure shows error card with retry button
- [ ] Transaction failure shows toast notification
- [ ] Wallet not connected shows disabled state with tooltip
- [ ] Insufficient role shows disabled state with role requirement message

**TypeScript Safety:**
- [ ] No `any` types (except where explicitly documented, like query key invalidation)
- [ ] Props interfaces match documented interfaces exactly
- [ ] Proper null/undefined handling with optional chaining and nullish coalescing

**Accessibility:**
- [ ] All interactive elements have `aria-label` where text is not visible
- [ ] Modals trap focus and close on Escape
- [ ] Buttons have clear disabled state feedback
- [ ] Color is not the only indicator of state (text labels accompany color changes)
- [ ] Keyboard navigation works for custom dropdowns (Select component)

**Dark/Light Mode:**
- [ ] Both themes render correctly
- [ ] No elements that only look correct in one theme
- [ ] Borders, backgrounds, and text use the CSS variable tokens

**Common Issues to Challenge:**
- Using `useEffect` where a derived value would suffice
- Creating wrapper components that add no value
- Putting client-side logic in server components (missing `'use client'`)
- Forgetting to invalidate queries after mutations
- Not debouncing user input before API calls
- Hardcoded strings that should be computed (e.g., explorer URLs)
- Missing `key` props on list items
- useCallback/useMemo where it doesn't matter (premature optimization)

#### Final Cross-Cutting Review (T17)

After ALL pages are built, perform a comprehensive review across the entire frontend:

1. **Consistency audit** — Are similar patterns implemented the same way across pages? (e.g., do all tables use DataTable? Do all modals use Modal?)
2. **Import audit** — Are all imports resolving to the correct shared files? No duplicate implementations?
3. **State management audit** — Is server state in TanStack Query and client state in Zustand? No mixing?
4. **Navigation audit** — Do all sidebar links work? Do activity feed items navigate correctly?
5. **Theme audit** — Switch between dark/light mode on every page. Check for visual bugs.
6. **Mobile audit** — Check every page at mobile width. Sidebar collapses? Cards stack? Tables scroll?

**Communication:**
- Message specific teammates with concrete issues and suggested fixes.
- Format issues as: `[ISSUE] <file>:<line> — <problem>. Fix: <suggestion>.`
- Prioritize: blocking issues first, then UX issues, then style nits.

---

## 4. Dependency Graph

```
LAYER 1 (start immediately, parallel):
┌─────────────────────────┐    ┌─────────────────────────┐
│   Foundation Builder     │    │   Data Layer Engineer    │
│                         │    │                         │
│ T1: Tailwind + globals  │    │ T7:  QueryClient config │
│ T2: Card,StatCard,      │    │      + queryKeys        │
│     Button,StatusBadge  │    │      + utils.ts         │
│ T3: DataTable,Modal,    │    │ T8:  Data-fetching      │
│     Input,Select,       │    │      hooks (11)         │
│     Skeleton            │    │ T9:  Contract write     │
│ T4: layout.tsx,Sidebar, │    │      hooks (9)          │
│     Header,ThemeToggle  │    │ T10: Zustand stores     │
│ T5: Providers (wagmi,   │    │      (UI + Pipeline)    │
│     RainbowKit,Query,   │    │                         │
│     Theme)              │    │                         │
│ T6: api.ts,contracts.ts │    │                         │
│     chains.ts           │    │                         │
└────────────┬────────────┘    └────────────┬────────────┘
             │                              │
             ▼                              ▼
─────────────────── LAYER 1 COMPLETE ────────────────────
             │                              │
             ▼                              ▼
LAYER 2 (start after Layer 1, parallel):
┌─────────────────────────┐    ┌─────────────────────────┐
│   Core Pages Dev         │    │   Pipeline Builder Dev   │
│                         │    │                         │
│ T11: Dashboard          │    │ T14: Canvas + 5 node   │
│      page.tsx,          │    │      types + BlockPal   │
│      YieldChart,        │    │      + SavedConfigs     │
│      AllocationPie,     │    │ T15: ExecutionAnimation │
│      ActivityFeed       │    │      + ExecutionLog     │
│ T12: Vault              │    │      + ExecutionModal   │
│      page.tsx,          │    │ T16: QuickPayFAB +     │
│      ThresholdSlider,   │    │      QuickPayModal +   │
│      modals, history    │    │      PaymentSummary    │
│ T13: FX                 │    │                         │
│      page.tsx,          │    │                         │
│      FXSwapCard,        │    │                         │
│      QuoteDisplay,      │    │                         │
│      history            │    │                         │
└────────────┬────────────┘    └────────────┬────────────┘
             │                              │
             ▼                              ▼
─────────────────── LAYER 2 COMPLETE ────────────────────
             │
             ▼
┌─────────────────────────┐
│   Devil's Advocate       │
│                         │
│ T17: Final cross-       │
│      cutting review     │
└─────────────────────────┘
```

---

## 5. Task List

| ID | Layer | Owner | Task | Files | Depends On |
|----|-------|-------|------|-------|------------|
| T1 | 1 | Foundation Builder | Tailwind config + globals.css + CSS variables | `tailwind.config.ts`, `globals.css` | — |
| T2 | 1 | Foundation Builder | Shared components: Card, StatCard, Button, StatusBadge | 4 files in `components/shared/` | T1 |
| T3 | 1 | Foundation Builder | Shared components: DataTable, Modal, Input, Select, Skeleton | 5 files in `components/shared/` | T1 |
| T4 | 1 | Foundation Builder | App shell: layout.tsx, Sidebar, Header, ThemeToggle | 4 files in `components/layout/` + `layout.tsx` | T1, T2, T3 |
| T5 | 1 | Foundation Builder | Providers: Wagmi, RainbowKit, TanStack Query, Theme | `providers/index.tsx`, `providers/wagmi.ts` | T1 |
| T6 | 1 | Foundation Builder | Lib: api.ts, contracts.ts, chains.ts, types/api.ts | 4 files in `lib/` + `types/` | — |
| T7 | 1 | Data Layer Engineer | QueryClient config + queryKeys + utils.ts | `providers/query.ts`, `lib/queryKeys.ts`, `lib/utils.ts` | — |
| T8 | 1 | Data Layer Engineer | Data-fetching hooks (11 hooks) | 11 files in `hooks/` | T7 |
| T9 | 1 | Data Layer Engineer | Contract write hooks (9 hooks) | 9 files in `hooks/` | T7 |
| T10 | 1 | Data Layer Engineer | Zustand stores (UI + Pipeline) | `stores/ui.store.ts`, `stores/pipeline.store.ts` | — |
| T11 | 2 | Core Pages Dev | Dashboard: page.tsx + YieldChart + AllocationPie + ActivityFeed + format.ts | 6 files | T1–T6, T7–T8 |
| T12 | 2 | Core Pages Dev | Vault: page.tsx + ThresholdSlider + modals + history tables + YieldBreakdown | 7 files | T1–T6, T7–T9 |
| T13 | 2 | Core Pages Dev | FX: page.tsx + FXSwapCard + CurrencySelector + QuoteDisplay + FXHistoryTable | 5 files | T1–T6, T7–T9 |
| T14 | 2 | Pipeline Builder Dev | Canvas + 5 node types + BlockPalette + SavedConfigs + PipelineSummary | 10 files | T1–T6, T7–T10 |
| T15 | 2 | Pipeline Builder Dev | ExecutionAnimation + ExecutionLog + ExecutionModal | 3 files | T14 |
| T16 | 2 | Pipeline Builder Dev | QuickPayFAB + QuickPayModal + PaymentSummary | 3 files | T1–T6, T7–T9 |
| T17 | Final | Devil's Advocate | Final cross-cutting review of all pages | 0 files (review only) | T11–T16 |

---

## 6. Shared Conventions

All teammates MUST follow these conventions. The Devil's Advocate will check for violations.

### Import Aliases

```typescript
// Use the @/ alias for all imports within packages/frontend/src/
import { Card } from '@/components/shared/Card';
import { useVaultBalances } from '@/hooks/useVaultBalances';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useUIStore } from '@/stores/ui.store';
import { formatCurrency } from '@/lib/utils';
```

### File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase `.tsx` | `StatCard.tsx`, `YieldChart.tsx` |
| Hooks | camelCase with `use` prefix `.ts` | `useVaultBalances.ts` |
| Stores | kebab-case with `.store.ts` suffix | `ui.store.ts` |
| Utilities | camelCase `.ts` | `queryKeys.ts`, `utils.ts` |
| Pages | `page.tsx` in route directory | `app/vault/page.tsx` |

### Component Pattern

```tsx
// Client components (with hooks/state):
'use client';

interface MyComponentProps {
  data: SomeType;
  loading?: boolean;
  className?: string;
}

export function MyComponent({ data, loading, className }: MyComponentProps) {
  // ...
}
```

### Styling Rules

- **Always** use Tailwind utility classes — no inline styles, no CSS modules.
- **Always** use design token classes: `bg-surface`, `text-foreground`, `border-card-border`, etc.
- **Never** use hardcoded hex colors in components.
- **Always** include dark mode variants where needed (most are handled by CSS variables).
- **Spacing:** Use `space-y-6` for page-level section gaps, `gap-4` for grid gaps.
- **Animations:** Use the custom animations from `tailwind.config.ts`: `animate-fade-in`, `animate-slide-up`, `animate-shimmer`, `animate-pulse-status`.

### State Management Rules

| What | Where |
|------|-------|
| Server data (API responses, on-chain reads) | TanStack Query hooks |
| Global UI state (sidebar, modals, theme) | Zustand `ui.store` |
| Pipeline editor state (execution, progress) | Zustand `pipeline.store` |
| Component-local state (form fields, expanded) | React `useState` |
| Derived/computed values | Calculate inline, do NOT store |

### Error Handling Pattern

```tsx
// API/query errors:
if (error) {
  return (
    <Card className="border-error/20 bg-error/5">
      <p className="text-error">Failed to load data</p>
      <Button variant="ghost" onClick={() => refetch()}>Retry</Button>
    </Card>
  );
}

// Transaction errors: use toast
toast.error(`Transaction failed: ${error.message}`);

// Transaction success: use toast
toast.success('Transaction confirmed');
```

---

## 7. Lead Instructions

### Spawning the Team

1. Read this file in full.
2. Spawn all 5 teammates in tmux split-pane mode.
3. Give each teammate their section from this playbook (section 3.X) plus the assigned docs.

### Requiring Plan Approval

**CRITICAL:** Every teammate MUST submit their implementation plan BEFORE writing any code. The approval flow is:

```
Teammate submits plan
    → Devil's Advocate reviews plan
    → Devil's Advocate provides feedback to lead
    → Lead approves (or requests changes)
    → Teammate begins implementation
```

### Managing Dependencies

1. **Start Layer 1 immediately:** Foundation Builder and Data Layer Engineer work in parallel.
2. **Wait for Layer 1 completion:** Do NOT unblock Layer 2 teammates until both Layer 1 teammates confirm their work is done.
3. **Coordinate shared interfaces:** Foundation Builder's `providers/index.tsx` imports Data Layer Engineer's `queryClient`. Ensure this import path is agreed before either starts.
4. **Start Layer 2:** Core Pages Dev and Pipeline Builder Dev work in parallel.
5. **Final review:** Once all Layer 2 tasks are complete, trigger Devil's Advocate T17.

### Handling Conflicts

If two teammates need to modify the same file:
1. Assign clear ownership — one teammate owns the file.
2. The other teammate requests changes through the lead.
3. The file owner makes the change.

**Known shared touch point:** `layout.tsx` is owned by Foundation Builder. After Pipeline Builder Dev completes `QuickPayFAB.tsx`, the Foundation Builder (or lead) adds the `<QuickPayFAB />` import and component to `layout.tsx`.

### Monitoring Progress

Track task completion against the task list in section 5. Mark tasks as:
- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked

---

## 8. Quick Reference — All Owned Files

### Foundation Builder (21 files)

```
packages/frontend/tailwind.config.ts
packages/frontend/src/app/globals.css
packages/frontend/src/app/layout.tsx
packages/frontend/src/providers/index.tsx
packages/frontend/src/providers/wagmi.ts
packages/frontend/src/components/shared/Card.tsx
packages/frontend/src/components/shared/StatCard.tsx
packages/frontend/src/components/shared/Button.tsx
packages/frontend/src/components/shared/StatusBadge.tsx
packages/frontend/src/components/shared/DataTable.tsx
packages/frontend/src/components/shared/Modal.tsx
packages/frontend/src/components/shared/Input.tsx
packages/frontend/src/components/shared/Select.tsx
packages/frontend/src/components/shared/Skeleton.tsx
packages/frontend/src/components/layout/Sidebar.tsx
packages/frontend/src/components/layout/Header.tsx
packages/frontend/src/components/layout/ThemeToggle.tsx
packages/frontend/src/lib/chains.ts
packages/frontend/src/lib/contracts.ts
packages/frontend/src/lib/api.ts
packages/frontend/src/types/api.ts
```

### Data Layer Engineer (25 files)

```
packages/frontend/src/providers/query.ts
packages/frontend/src/lib/queryKeys.ts
packages/frontend/src/lib/utils.ts
packages/frontend/src/hooks/useDashboardStats.ts
packages/frontend/src/hooks/useVaultBalances.ts
packages/frontend/src/hooks/useVaultHistory.ts
packages/frontend/src/hooks/useYieldBreakdown.ts
packages/frontend/src/hooks/useFXQuote.ts
packages/frontend/src/hooks/useFXHistory.ts
packages/frontend/src/hooks/usePayouts.ts
packages/frontend/src/hooks/usePayoutStatus.ts
packages/frontend/src/hooks/usePipelines.ts
packages/frontend/src/hooks/usePipeline.ts
packages/frontend/src/hooks/usePipelineExecution.ts
packages/frontend/src/hooks/useDeposit.ts
packages/frontend/src/hooks/useWithdraw.ts
packages/frontend/src/hooks/useSetThreshold.ts
packages/frontend/src/hooks/useExecutePayout.ts
packages/frontend/src/hooks/useBatchPayout.ts
packages/frontend/src/hooks/useExecuteSwap.ts
packages/frontend/src/hooks/useCreateBudget.ts
packages/frontend/src/hooks/useSpendBudget.ts
packages/frontend/src/hooks/useSavePipeline.ts
packages/frontend/src/stores/ui.store.ts
packages/frontend/src/stores/pipeline.store.ts
```

### Core Pages Dev (18 files)

```
packages/frontend/src/app/page.tsx
packages/frontend/src/app/vault/page.tsx
packages/frontend/src/app/fx/page.tsx
packages/frontend/src/components/vault/YieldChart.tsx
packages/frontend/src/components/vault/AllocationPie.tsx
packages/frontend/src/components/vault/YieldBreakdown.tsx
packages/frontend/src/components/vault/YieldHistoryTable.tsx
packages/frontend/src/components/vault/ThresholdSlider.tsx
packages/frontend/src/components/vault/DepositModal.tsx
packages/frontend/src/components/vault/WithdrawModal.tsx
packages/frontend/src/components/vault/VaultHistoryTable.tsx
packages/frontend/src/components/shared/ActivityFeed.tsx
packages/frontend/src/components/shared/ActivityItem.tsx
packages/frontend/src/components/fx/FXSwapCard.tsx
packages/frontend/src/components/fx/CurrencySelector.tsx
packages/frontend/src/components/fx/QuoteDisplay.tsx
packages/frontend/src/components/fx/FXHistoryTable.tsx
packages/frontend/src/lib/format.ts
```

### Pipeline Builder Dev (16 files)

```
packages/frontend/src/app/pipeline/page.tsx
packages/frontend/src/components/pipeline/PipelineCanvas.tsx
packages/frontend/src/components/pipeline/BlockPalette.tsx
packages/frontend/src/components/pipeline/SavedConfigs.tsx
packages/frontend/src/components/pipeline/PipelineSummary.tsx
packages/frontend/src/components/pipeline/nodes/TreasurySourceNode.tsx
packages/frontend/src/components/pipeline/nodes/DepartmentNode.tsx
packages/frontend/src/components/pipeline/nodes/EmployeeNode.tsx
packages/frontend/src/components/pipeline/nodes/ContractorNode.tsx
packages/frontend/src/components/pipeline/nodes/FXConversionNode.tsx
packages/frontend/src/components/pipeline/ExecutionModal.tsx
packages/frontend/src/components/pipeline/ExecutionLog.tsx
packages/frontend/src/components/pipeline/ExecutionAnimation.tsx
packages/frontend/src/components/quick-pay/QuickPayFAB.tsx
packages/frontend/src/components/quick-pay/QuickPayModal.tsx
packages/frontend/src/components/quick-pay/PaymentSummary.tsx
```

### Devil's Advocate (0 files)

No files owned. Review-only role.

**Total: 80 files across 4 implementing teammates.**

---

## 9. How to Launch

```bash
# Prerequisites
brew install tmux  # if not installed

# Start Claude Code in the ArcVault project directory
cd /path/to/ArcVault

# Then prompt Claude Code:
# "Read docs/AGENT_TEAM_FRONTEND.md and create the agent team it describes.
#  Require plan approval for all teammates. Use split-pane mode."
```
