# Treasury Vault Page Specification

> **ArcVault** — Enterprise Treasury & FX Operations Platform
> **Stack:** Next.js App Router, Tailwind CSS, Recharts, TanStack Query, wagmi/viem
> **Scope:** Treasury Vault management page at route `/vault` — balances, yield tracking, threshold control, deposit/withdraw, history

---

## 1. Overview

The Treasury Vault page is the primary interface for managing the protocol's treasury. It allows treasury managers and CFOs to monitor balances, track yield performance, adjust the liquidity threshold that governs the automatic USDC-to-USYC sweep strategy, execute manual deposits/withdrawals, and review historical vault events.

**Route:** `/vault`
**File:** `packages/frontend/src/app/vault/page.tsx`

---

## 2. Page Layout (Top to Bottom)

The page is a single scrollable column of sections:

```
[Section 1] Balance Cards (4 StatCards in a row)
[Section 2] Yield Tracking (full-width Card)
[Section 3] Liquidity Threshold Control (full-width Card)
[Section 4] Actions (row of action buttons)
[Section 5] History Table (full-width Card)
```

---

## 3. Section 1 — Balance Cards

**Layout:** `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`

Four `StatCard` components displaying real-time vault state:

| Card | Label | Value Source | Format | Notes |
|------|-------|-------------|--------|-------|
| 1 | Liquid USDC | `useVaultBalances().liquidUSDC` | `$XX,XXX` | Green tint if above threshold, yellow if near threshold, red if below |
| 2 | USYC Position | `useVaultBalances().usycPosition` | `$X,XXX,XXX` | Shows USD equivalent |
| 3 | Total Value | `liquidUSDC + usycPosition` | `$X,XXX,XXX` | Computed client-side |
| 4 | Accrued Yield | `useYieldBreakdown().totalYield` | `$XX,XXX` | Total yield earned since inception |

**Threshold-aware coloring for Liquid USDC card:**
- If liquid balance >= threshold: value text colored `text-success`
- If liquid balance >= threshold * 0.8 and < threshold: value text colored `text-warning`
- If liquid balance < threshold * 0.8: value text colored `text-error`

---

## 4. Section 2 — Yield Tracking

A full-width `Card` containing three sub-components stacked vertically.

### 4.1 YieldBreakdown Component

File: **`packages/frontend/src/components/vault/YieldBreakdown.tsx`**

```typescript
interface YieldBreakdownProps {
  daily: number;
  weekly: number;
  monthly: number;
  projectedAnnual: number;
  currentAPY: number;
  apyChange: number;   // vs previous period
  loading?: boolean;
}
```

**Layout:**
```
+-------------------------------------------------------+
|  Yield Performance                    [1D][1W][1M][3M] |
|                                                        |
|  Daily: $141  |  Weekly: $987  |  Monthly: $4,230      |
|  Projected Annual: $50,760  |  APY: 4.85% [arrow]     |
+-------------------------------------------------------+
```

**Implementation:**
- Title: "Yield Performance" (`text-lg font-semibold`)
- Time range selector buttons (top-right): `1D`, `1W`, `1M`, `3M` — these control both the breakdown numbers displayed AND the chart time range below
- Metric row: horizontal flex with dividers, each metric is label (caption) + value (body, font-medium)
  - Daily yield: `$XXX.XX`
  - Weekly yield: `$X,XXX`
  - Monthly yield: `$X,XXX`
- Second metric row:
  - Projected Annual: `$XX,XXX` (monthly * 12, or actual projection)
  - APY: `X.XX%` with trend arrow (green up if `apyChange > 0`, red down otherwise)
- On mobile: metrics wrap to 2x2 grid

### 4.2 YieldChart (Reused)

File: **`packages/frontend/src/components/vault/YieldChart.tsx`**

Same component as used on the Dashboard (see `docs/frontend/03-dashboard-page.md`), but here it is rendered full-width and includes an additional `ALL` time range option.

```typescript
interface YieldChartProps {
  data: Array<{
    date: string;
    cumulativeYield: number;
    dailyYield: number;
  }>;
  timeRange: '1D' | '1W' | '1M' | '3M' | 'ALL';
  onTimeRangeChange: (range: string) => void;
  loading?: boolean;
  showTimeRangeSelector?: boolean; // false here since YieldBreakdown controls it
}
```

**Notes:**
- The time range is controlled by the `YieldBreakdown` component's selector, passed down as a prop
- On this page, set `showTimeRangeSelector={false}` to avoid duplicate selectors
- Full width rendering inside the card

### 4.3 YieldHistoryTable

File: **`packages/frontend/src/components/vault/YieldHistoryTable.tsx`**

```typescript
interface YieldHistoryRow {
  date: string;        // ISO date
  dailyYield: number;
  cumulativeYield: number;
  apy: number;
}

interface YieldHistoryTableProps {
  data: YieldHistoryRow[];
  loading?: boolean;
}
```

**Uses the `DataTable` component** from the design system.

**Columns:**

| Column | Key | Sortable | Render |
|--------|-----|----------|--------|
| Date | `date` | Yes | Formatted as "Jan 15, 2024" |
| Daily Yield | `dailyYield` | Yes | `$XXX.XX` in green |
| Cumulative | `cumulativeYield` | Yes | `$X,XXX.XX` |
| APY | `apy` | Yes | `X.XX%` |

- Default sort: date descending (newest first)
- Paginated: 10 rows per page
- Compact variant: `text-sm` for denser data display

---

## 5. Section 3 — Liquidity Threshold Control

A full-width `Card` for managing the automatic sweep threshold.

### Visual Layout

```
+-------------------------------------------------------+
|  Liquidity Allocation                                  |
|                                                        |
|  [============================================]        |
|  [  USYC: $950K  ||||||||  Liquid: $50K      ]        |
|  [============================================]        |
|                       ^ drag handle                    |
|                                                        |
|  Threshold: $ [50,000    ]    [Update Threshold]       |
|                                                        |
|  Impact Preview:                                       |
|  > $25,000 would be redeemed from USYC                |
|  > New liquid balance: $75,000                         |
|  > New USYC position: $925,000                         |
+-------------------------------------------------------+
```

### ThresholdSlider Component

File: **`packages/frontend/src/components/vault/ThresholdSlider.tsx`**

```typescript
interface ThresholdSliderProps {
  currentThreshold: number;      // Current on-chain threshold
  liquidBalance: number;         // Current liquid USDC
  usycBalance: number;           // Current USYC position (USD)
  totalValue: number;            // Total vault value
  onUpdateThreshold: (newThreshold: number) => void;
  isUpdating: boolean;           // True while tx is pending
  canUpdate: boolean;            // False if user lacks CFO_ROLE
}
```

**Sub-components and behavior:**

#### Visual Bar
- A horizontal bar showing the allocation split between USYC and Liquid USDC
- USYC portion: `bg-secondary` (purple, `#8B5CF6`)
- Liquid USDC portion: `bg-primary` (blue, `#3B82F6`)
- Width proportions match actual balances
- A draggable handle at the threshold point
- Labels on each side showing amounts: `USYC: $950K` on left, `Liquid: $50K` on right

#### Drag Handle
- Circular handle (`w-5 h-5 rounded-full bg-white border-2 border-primary shadow-md`)
- Draggable horizontally along the bar
- Dragging updates the threshold value in real-time (local state)
- Snaps to reasonable increments ($1,000 steps)

#### Threshold Input
- `Input` component (from design system) with `$` prefix
- Value synced with the drag handle position
- Manual entry allowed — typing updates the handle position
- Validation: must be >= 0 and <= totalValue

#### Impact Preview
- Only shown when the proposed threshold differs from the current on-chain threshold
- Calculates and displays what would happen if the threshold is updated:
  - If new threshold > current liquid balance:
    - "X USYC would be redeemed to bring liquid balance to $Y"
  - If new threshold < current liquid balance:
    - "$X excess would be swept from liquid to USYC"
  - Shows: new projected liquid balance, new projected USYC position
- Styled: `bg-primary/5 rounded-lg p-4 text-sm space-y-1`

#### Update Button
- `Button` component, variant: `primary`
- Text: "Update Threshold"
- Disabled when:
  - Proposed threshold equals current threshold (no change)
  - User lacks `CFO_ROLE` (show tooltip: "Requires CFO role")
  - Transaction is pending (`isUpdating`)
- Loading state while transaction is in progress
- On click: calls `TreasuryVault.setLiquidityThreshold(newThreshold)` via wagmi `useWriteContract`

#### Role Check
- The component queries the user's roles from the contract (or a cached role check)
- If the connected wallet does not have `CFO_ROLE`, the slider and button are disabled with a message explaining the required permission

---

## 6. Section 4 — Actions

**Layout:** `flex flex-wrap gap-3`

A row of action buttons for manual vault operations:

| Action | Button Variant | Icon | Behavior |
|--------|---------------|------|----------|
| Deposit USDC | `primary` | ArrowDownLeft | Opens `DepositModal` |
| Withdraw USDC | `secondary` | ArrowUpRight | Opens `WithdrawModal` |
| Manual Sweep | `ghost` | ArrowRight | Executes `TreasuryVault.sweepToUSYC()` directly (no modal, but confirm dialog) |
| Manual Redeem | `ghost` | ArrowDown | Opens modal with amount input for `TreasuryVault.redeemFromUSYC(amount)` |

All buttons disabled when wallet is not connected, with tooltip "Connect wallet".

### DepositModal

File: **`packages/frontend/src/components/vault/DepositModal.tsx`**

```typescript
interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**Content:**
- Title: "Deposit USDC"
- Amount input with `$` prefix and `USDC` suffix
- Show current wallet USDC balance: "Available: $XX,XXX"
- "Max" button to fill with full available balance
- Two-step process:
  1. If USDC allowance insufficient: show "Approve USDC" button first (calls `USDC.approve(vaultAddress, amount)`)
  2. Once approved: show "Deposit" button (calls `TreasuryVault.depositFunds(amount)`)
- Transaction status: pending spinner -> success (green check + tx hash link) -> error (red message + retry)
- On success: close modal after 2s, refresh balances

### WithdrawModal

File: **`packages/frontend/src/components/vault/WithdrawModal.tsx`**

```typescript
interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**Content:**
- Title: "Withdraw USDC"
- Amount input with `$` prefix and `USDC` suffix
- Show current liquid USDC balance: "Available: $XX,XXX"
- Warning if withdrawal would bring liquid below threshold
- "Withdraw" button calls `TreasuryVault.withdrawFunds(amount)`
- Requires `TREASURY_MANAGER_ROLE` — disabled with message if user lacks role
- Same transaction status UX as DepositModal

### Manual Sweep

No modal. On click:
1. Show a confirmation dialog: "Sweep excess USDC to USYC? This will invest $X above the $Y threshold."
2. If confirmed: call `TreasuryVault.sweepToUSYC()`
3. Show toast notification with result (success/error)

### Manual Redeem Modal

Similar to WithdrawModal but:
- Title: "Redeem from USYC"
- Shows current USYC balance
- Amount input for how much to redeem
- Calls `TreasuryVault.redeemFromUSYC(amount)`

---

## 7. Section 5 — History Table

File: **`packages/frontend/src/components/vault/VaultHistoryTable.tsx`**

```typescript
interface VaultEvent {
  id: string;
  type: 'SWEEP' | 'REDEEM' | 'DEPOSIT' | 'WITHDRAW';
  amount: number;
  currency: string;
  txHash: string;
  timestamp: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
}

interface VaultHistoryTableProps {
  loading?: boolean;
}
```

**Uses the `DataTable` component** from the design system.

**Columns:**

| Column | Key | Sortable | Render |
|--------|-----|----------|--------|
| Type | `type` | No | `StatusBadge`-style colored label (SWEEP=primary, REDEEM=secondary, DEPOSIT=success, WITHDRAW=warning) |
| Amount | `amount` | Yes | `$XX,XXX USDC` formatted |
| TX Hash | `txHash` | No | Truncated hash as link to block explorer: `0x1234...5678` |
| Timestamp | `timestamp` | Yes | Formatted as "Jan 15, 2024 10:30 AM" |
| Status | `status` | No | `StatusBadge` component |

**Features:**
- Filter row above table: dropdown to filter by type (ALL, SWEEP, REDEEM, DEPOSIT, WITHDRAW)
- Default sort: timestamp descending
- Pagination: 20 items per page
- Data source: `GET /api/vault/history` via `useVaultHistory()` hook

**TX Hash link:** Opens in new tab, URL pattern: `{EXPLORER_URL}/tx/{txHash}` using the chain's block explorer URL from the chain definition.

---

## 8. Hooks Used

### 8.1 `useVaultBalances()`

On-chain reads from the TreasuryVault contract:

```typescript
// Reads:
// - USDC.balanceOf(vaultAddress) -> liquidUSDC
// - USYC.balanceOf(vaultAddress) -> usycBalance (then convert to USD)
// - TreasuryVault.liquidityThreshold() -> threshold
// - TreasuryVault.totalValue() -> total (if available)

// Returns:
interface VaultBalances {
  liquidUSDC: number;
  usycPosition: number;  // USD value
  totalValue: number;
  liquidityThreshold: number;
}
```

Uses wagmi `useReadContracts` with `watch: true` for auto-refresh.

### 8.2 `useVaultHistory(params)`

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useVaultHistory(params?: { type?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['vault', 'history', params],
    queryFn: () => api.vault.getHistory(params as Record<string, string>),
  });
}
```

### 8.3 `useYieldBreakdown()`

Computed from vault snapshot history data:

```typescript
interface YieldBreakdown {
  daily: number;
  weekly: number;
  monthly: number;
  totalYield: number;
  projectedAnnual: number;
  currentAPY: number;
  apyChange: number;
  history: Array<{ date: string; cumulativeYield: number; dailyYield: number; apy: number }>;
}
```

### 8.4 Contract Write Hooks

Each vault action uses wagmi's `useWriteContract`:

```typescript
// useDeposit() — calls TreasuryVault.depositFunds(uint256 amount)
// useWithdraw() — calls TreasuryVault.withdrawFunds(uint256 amount)
// useSetThreshold() — calls TreasuryVault.setLiquidityThreshold(uint256 threshold)
// useSweep() — calls TreasuryVault.sweepToUSYC()
// useRedeem() — calls TreasuryVault.redeemFromUSYC(uint256 amount)
// useApproveUSDC() — calls USDC.approve(address spender, uint256 amount)
```

Each write hook should:
1. Call `useWriteContract` from wagmi
2. Use `useWaitForTransactionReceipt` to track confirmation
3. Invalidate relevant TanStack Query caches on success (`queryClient.invalidateQueries`)
4. Return: `{ write, isPending, isConfirming, isSuccess, isError, error, txHash }`

See `docs/frontend/08-hooks-and-state.md` for complete implementations.

---

## 9. Page Component Structure

File: **`packages/frontend/src/app/vault/page.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useVaultBalances } from '@/hooks/useVaultBalances';
import { useYieldBreakdown } from '@/hooks/useYieldBreakdown';
import { StatCard } from '@/components/shared/StatCard';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { YieldBreakdown } from '@/components/vault/YieldBreakdown';
import { YieldChart } from '@/components/vault/YieldChart';
import { YieldHistoryTable } from '@/components/vault/YieldHistoryTable';
import { ThresholdSlider } from '@/components/vault/ThresholdSlider';
import { DepositModal } from '@/components/vault/DepositModal';
import { WithdrawModal } from '@/components/vault/WithdrawModal';
import { VaultHistoryTable } from '@/components/vault/VaultHistoryTable';
import { formatCurrency } from '@/lib/format';
import { ArrowDownLeft, ArrowUpRight, ArrowRight, ArrowDown } from 'lucide-react';

export default function VaultPage() {
  const { data: balances, isLoading: balancesLoading } = useVaultBalances();
  const { data: yieldData, isLoading: yieldLoading } = useYieldBreakdown();

  const [timeRange, setTimeRange] = useState<string>('1M');
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Section 1 — Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Liquid USDC" value={formatCurrency(balances?.liquidUSDC ?? 0)} loading={balancesLoading} />
        <StatCard label="USYC Position" value={formatCurrency(balances?.usycPosition ?? 0)} loading={balancesLoading} />
        <StatCard label="Total Value" value={formatCurrency(balances?.totalValue ?? 0)} loading={balancesLoading} />
        <StatCard label="Accrued Yield" value={formatCurrency(yieldData?.totalYield ?? 0)} loading={yieldLoading} />
      </div>

      {/* Section 2 — Yield Tracking */}
      <Card>
        <YieldBreakdown
          daily={yieldData?.daily ?? 0}
          weekly={yieldData?.weekly ?? 0}
          monthly={yieldData?.monthly ?? 0}
          projectedAnnual={yieldData?.projectedAnnual ?? 0}
          currentAPY={yieldData?.currentAPY ?? 0}
          apyChange={yieldData?.apyChange ?? 0}
          loading={yieldLoading}
        />
        <YieldChart
          data={yieldData?.history ?? []}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          showTimeRangeSelector={false}
          loading={yieldLoading}
        />
        <YieldHistoryTable
          data={yieldData?.history ?? []}
          loading={yieldLoading}
        />
      </Card>

      {/* Section 3 — Liquidity Threshold */}
      <Card>
        <ThresholdSlider
          currentThreshold={balances?.liquidityThreshold ?? 0}
          liquidBalance={balances?.liquidUSDC ?? 0}
          usycBalance={balances?.usycPosition ?? 0}
          totalValue={balances?.totalValue ?? 0}
          onUpdateThreshold={handleUpdateThreshold}
          isUpdating={false}
          canUpdate={true} // check CFO_ROLE
        />
      </Card>

      {/* Section 4 — Actions */}
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={() => setDepositOpen(true)}>
          <ArrowDownLeft className="w-4 h-4 mr-2" /> Deposit USDC
        </Button>
        <Button variant="secondary" onClick={() => setWithdrawOpen(true)}>
          <ArrowUpRight className="w-4 h-4 mr-2" /> Withdraw USDC
        </Button>
        <Button variant="ghost" onClick={handleSweep}>
          <ArrowRight className="w-4 h-4 mr-2" /> Manual Sweep
        </Button>
        <Button variant="ghost" onClick={handleRedeem}>
          <ArrowDown className="w-4 h-4 mr-2" /> Manual Redeem
        </Button>
      </div>

      {/* Section 5 — History */}
      <Card>
        <VaultHistoryTable loading={balancesLoading} />
      </Card>

      {/* Modals */}
      <DepositModal isOpen={depositOpen} onClose={() => setDepositOpen(false)} />
      <WithdrawModal isOpen={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </div>
  );
}
```

---

## 10. Loading States

| Component | Loading Behavior |
|-----------|-----------------|
| Balance StatCards (4) | Skeleton cards with shimmer animation |
| YieldBreakdown | Skeleton text blocks for each metric |
| YieldChart | Skeleton rectangle matching chart aspect ratio |
| YieldHistoryTable | 5 skeleton table rows |
| ThresholdSlider | Skeleton bar + disabled input |
| Action Buttons | Disabled when wallet not connected |
| VaultHistoryTable | 5 skeleton table rows |

---

## 11. Error States

| Scenario | Behavior |
|----------|----------|
| API failure | Error card with retry button in the relevant section |
| Wallet not connected | Action buttons disabled, tooltip "Connect wallet". Balance cards show API-sourced data as fallback. ThresholdSlider disabled. |
| Transaction failure | Error toast notification: red background, error message, "Try again" or dismiss. Toast appears bottom-right, auto-dismisses after 8 seconds. |
| Transaction success | Success toast: green background, "Transaction confirmed" + truncated tx hash as link to explorer. Auto-dismisses after 5 seconds. |
| Insufficient role | Disabled controls with tooltip explaining required role (e.g., "Requires CFO_ROLE") |
| Insufficient balance | Deposit: "Insufficient USDC balance" error below input. Withdraw: "Exceeds available liquid balance" error. |

---

## 12. Toast Notifications

For transaction feedback, use a toast notification system. Options:
- `react-hot-toast` (lightweight, recommended for hackathon)
- Or a custom toast using Zustand for state + a `<Toaster>` component in the root layout

```typescript
// Usage pattern
import toast from 'react-hot-toast';

// On success
toast.success(
  <div>
    <p>Transaction confirmed</p>
    <a href={`${explorerUrl}/tx/${txHash}`} target="_blank" className="text-xs text-primary underline">
      View on explorer
    </a>
  </div>,
  { duration: 5000 }
);

// On error
toast.error(`Transaction failed: ${error.message}`, { duration: 8000 });
```

---

## 13. Files to Create / Modify

| File Path | Purpose |
|-----------|---------|
| `packages/frontend/src/app/vault/page.tsx` | Vault page component |
| `packages/frontend/src/components/vault/YieldBreakdown.tsx` | Yield metrics display (daily/weekly/monthly/APY) |
| `packages/frontend/src/components/vault/YieldChart.tsx` | Area chart for yield over time (shared, extend with ALL range) |
| `packages/frontend/src/components/vault/YieldHistoryTable.tsx` | Table of daily yield snapshots |
| `packages/frontend/src/components/vault/ThresholdSlider.tsx` | Draggable threshold allocation control |
| `packages/frontend/src/components/vault/DepositModal.tsx` | Deposit USDC modal with approval flow |
| `packages/frontend/src/components/vault/WithdrawModal.tsx` | Withdraw USDC modal with role check |
| `packages/frontend/src/components/vault/VaultHistoryTable.tsx` | Filterable history table of vault events |
| `packages/frontend/src/hooks/useVaultBalances.ts` | On-chain vault balance reads |
| `packages/frontend/src/hooks/useYieldBreakdown.ts` | Computed yield metrics hook |
| `packages/frontend/src/hooks/useVaultHistory.ts` | API hook for vault event history |
| `packages/frontend/src/hooks/useDeposit.ts` | Contract write hook for deposits |
| `packages/frontend/src/hooks/useWithdraw.ts` | Contract write hook for withdrawals |
| `packages/frontend/src/hooks/useSetThreshold.ts` | Contract write hook for threshold updates |

---

## 14. Cross-References

| Document | Relevance |
|----------|-----------|
| `docs/frontend/01-design-system.md` | StatCard, Card, Button, DataTable, Modal, Input, StatusBadge component specs |
| `docs/frontend/02-app-shell.md` | Layout wrapper, API client (`api.vault.*`), contract config, chain definition |
| `docs/frontend/03-dashboard-page.md` | Shares `YieldChart` component and `useVaultBalances` hook |
| `docs/frontend/08-hooks-and-state.md` | Full implementations of all hooks listed in Section 8 |
| `docs/technical/02-treasury-vault-contract.md` | Contract function signatures: `depositFunds`, `withdrawFunds`, `setLiquidityThreshold`, `sweepToUSYC`, `redeemFromUSYC`, role constants |
| `docs/technical/07-api-routes.md` | `/api/vault/status` and `/api/vault/history` endpoint response shapes |
