# Dashboard Page Specification

> **ArcVault** — Enterprise Treasury & FX Operations Platform
> **Stack:** Next.js App Router, Tailwind CSS, Recharts, TanStack Query, wagmi/viem
> **Scope:** Dashboard overview page at route `/` — financial metrics, charts, and activity feed

---

## 1. Overview

The dashboard is the landing page of the application. It provides a finance-first overview of the treasury: total AUM, yield performance, asset allocation, and recent activity. It is designed for at-a-glance monitoring by treasury operators and CFOs.

**Route:** `/`
**File:** `packages/frontend/src/app/page.tsx`

---

## 2. Layout Wireframe

```
+--------------------------------------------------+
| Total AUM          | Yield Earned   | Current APY |
| $1,245,000         | $4,230/mo      | 4.85%       |
+--------------------------------------------------+
| Liquid USDC    | USYC Position  | Pending Payouts |
| $50,000        | $1,195,000     | 3 ($45,000)     |
+--------------------------------------------------+
|                              |                    |
|  [Yield Over Time -          | [Allocation       |
|   Area Chart]                |  Pie Chart]       |
|                              |                    |
+--------------------------------------------------+
| Recent Activity                                   |
| > Sweep $25K to USYC          2 min ago           |
| > Payout $5K EURC to 0xAB...  15 min ago          |
| > FX Swap $10K USDC->EURC     1 hr ago            |
+--------------------------------------------------+
```

**Grid layout:**
- Top row: 3 StatCards in a responsive grid (`grid grid-cols-1 md:grid-cols-3 gap-4`)
- Second row: 3 StatCards in the same grid
- Charts row: 2 columns, 60/40 split (`grid grid-cols-1 lg:grid-cols-5 gap-4` with chart spanning 3 cols, pie spanning 2 cols)
- Activity feed: full width Card at the bottom

---

## 3. Data Sources

### 3.1 API Endpoint

**`GET /api/dashboard`** returns aggregated stats:

```typescript
interface DashboardStats {
  totalAUM: number;            // Total assets under management in USD
  liquidUSDC: number;          // Current liquid USDC balance
  usycPosition: number;        // USYC position value in USD terms
  accruedYield: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  currentAPY: number;          // Current APY percentage (e.g., 4.85)
  apyChange: number;           // APY change vs last period (e.g., +0.12)
  pendingPayouts: {
    count: number;
    totalAmount: number;
  };
  yieldHistory: Array<{        // For the area chart
    date: string;              // ISO date
    cumulativeYield: number;
    dailyYield: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: 'DEPOSIT' | 'SWEEP' | 'PAYOUT' | 'FX_SWAP' | 'REDEEM' | 'WITHDRAW';
    description: string;
    amount: number;
    currency: string;
    timestamp: string;         // ISO datetime
    txHash?: string;
  }>;
}
```

### 3.2 On-Chain Data

**`useVaultBalances()`** hook provides real-time on-chain balance data directly from the TreasuryVault contract. This supplements the API data with live values that may be more current.

### 3.3 Polling

- TanStack Query with `refetchInterval: 10_000` (10 seconds) on the dashboard stats query
- On-chain balance hook also polls at a similar interval via wagmi's built-in watch mechanism

---

## 4. Component Breakdown

### 4.1 Top Row — Key Metrics (3 StatCards)

Uses the `StatCard` component from the design system.

**Card 1: Total AUM**
- Label: "Total AUM"
- Value: formatted as `$X,XXX,XXX` (e.g., "$1,245,000")
- Change: percentage change vs previous period (daily)
- Icon: dollar sign or vault icon

**Card 2: Yield Earned**
- Label: "Yield Earned"
- Value: formatted as `$X,XXX/mo` (default to monthly view)
- Sub-feature: small toggle or text showing daily/weekly/monthly
  - Default: monthly
  - Toggle is inline within the card (small pill buttons or text links)
- Change: percentage change vs same period last month

**Card 3: Current APY**
- Label: "Current APY"
- Value: formatted as `X.XX%` (e.g., "4.85%")
- Change: the `apyChange` value (positive = green up arrow, negative = red down arrow)
- Icon: trending-up or chart icon

### 4.2 Second Row — Balance Breakdown (3 StatCards)

**Card 4: Liquid USDC**
- Label: "Liquid USDC"
- Value: formatted as `$XX,XXX`
- No change indicator
- Icon: circle-dollar-sign icon

**Card 5: USYC Position**
- Label: "USYC Position"
- Value: formatted as `$X,XXX,XXX` (USD equivalent)
- No change indicator
- Icon: lock or shield icon

**Card 6: Pending Payouts**
- Label: "Pending Payouts"
- Value: formatted as `count ($XX,XXX)` — e.g., "3 ($45,000)"
- Icon: clock or send icon
- If count is 0: show "None" in muted text

### 4.3 Charts Row

#### YieldChart Component

File: **`packages/frontend/src/components/vault/YieldChart.tsx`**

```typescript
interface YieldChartProps {
  data: Array<{
    date: string;
    cumulativeYield: number;
    dailyYield: number;
  }>;
  loading?: boolean;
}
```

**Implementation:**
- Recharts `<AreaChart>` wrapped in a `<ResponsiveContainer>`
- Gradient fill under the area line: from `#3B82F6` (blue) at top to transparent at bottom
- Line color: `#3B82F6` (primary)
- X axis: formatted dates (e.g., "Jan 15"), tick color `text-muted`
- Y axis: formatted USD values (e.g., "$4K"), tick color `text-muted`
- Grid lines: subtle, `rgba(255,255,255,0.05)` in dark mode
- Tooltip: custom styled tooltip matching design system
  - Background: `bg-surface border border-card-border shadow-lg rounded-lg p-3`
  - Shows: date (full format), cumulative yield (formatted $), daily yield (formatted $)

**Time Range Selector:**
- Row of small pill buttons above the chart: `1D`, `1W`, `1M`, `3M`
- Active button: `bg-primary/20 text-primary`
- Inactive: `text-muted hover:text-foreground`
- Changing range filters the `data` array or triggers a new API call with time range params
- Default selection: `1M`

**Loading state:** Skeleton rectangle matching chart dimensions with shimmer animation.

#### AllocationPie Component

File: **`packages/frontend/src/components/vault/AllocationPie.tsx`**

```typescript
interface AllocationPieProps {
  liquidUSDC: number;
  usycPosition: number;
  loading?: boolean;
}
```

**Implementation:**
- Recharts `<PieChart>` with `<Pie>` component
- Two segments:
  - Liquid USDC: `#3B82F6` (blue / primary)
  - USYC: `#8B5CF6` (purple / secondary)
- Inner radius: 60% (donut chart)
- Center label: total value formatted as `$X.XXM` — use a custom `<text>` element positioned at the center of the SVG
- Hover on segment: shows tooltip with percentage + USD value
- Legend below the chart:
  - Two rows: colored dot + label + amount
  - e.g., `[blue dot] Liquid USDC — $50,000`
  - e.g., `[purple dot] USYC — $1,195,000`

**Loading state:** Skeleton circle with shimmer.

### 4.4 Recent Activity Feed

File: **`packages/frontend/src/components/shared/ActivityFeed.tsx`**

```typescript
interface ActivityFeedProps {
  activities: Array<{
    id: string;
    type: 'DEPOSIT' | 'SWEEP' | 'PAYOUT' | 'FX_SWAP' | 'REDEEM' | 'WITHDRAW';
    description: string;
    amount: number;
    currency: string;
    timestamp: string;
    txHash?: string;
  }>;
  loading?: boolean;
  maxItems?: number; // default 10
}
```

**Renders inside a Card** with header "Recent Activity" and optional "View All" link.

#### ActivityItem Component

File: **`packages/frontend/src/components/shared/ActivityItem.tsx`**

```typescript
interface ActivityItemProps {
  type: string;
  description: string;
  amount: number;
  currency: string;
  timestamp: string;
  txHash?: string;
  onClick?: () => void;
}
```

**Each row displays:**
- **Type icon** (left): color-coded circle with icon inside

  | Type | Icon | Color |
  |------|------|-------|
  | DEPOSIT | ArrowDownLeft | `text-success bg-success/10` |
  | SWEEP | ArrowRight | `text-primary bg-primary/10` |
  | PAYOUT | ArrowUpRight | `text-warning bg-warning/10` |
  | FX_SWAP | ArrowRightLeft | `text-secondary bg-secondary/10` |
  | REDEEM | ArrowDown | `text-primary bg-primary/10` |
  | WITHDRAW | ArrowUpLeft | `text-error bg-error/10` |

- **Description** (center): text description, `text-sm text-foreground`
- **Amount** (right-center): formatted with currency, `text-sm font-medium`
- **Relative time** (far right): e.g., "2 min ago", "1 hr ago", `text-xs text-muted`

**Row style:**
- `flex items-center gap-4 px-4 py-3 hover:bg-primary/5 cursor-pointer rounded-lg transition-colors`
- Divider between rows: `border-b border-card-border last:border-b-0`

**Click behavior:** Navigate to the relevant page:
- DEPOSIT, SWEEP, REDEEM, WITHDRAW -> `/vault`
- PAYOUT -> payout detail or `/vault`
- FX_SWAP -> `/fx`

**Relative time formatting:**
- Use a utility function (e.g., `formatRelativeTime`) or a library like `date-fns` `formatDistanceToNow`
- Examples: "just now", "2 min ago", "15 min ago", "1 hr ago", "3 hrs ago", "yesterday"

**Loading state:** 5 skeleton rows with shimmer (icon circle skeleton + text line skeletons + time skeleton).

**Empty state:** Centered text "No recent activity" with a muted icon.

---

## 5. Page Component Structure

File: **`packages/frontend/src/app/page.tsx`**

```typescript
'use client';

import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useVaultBalances } from '@/hooks/useVaultBalances';
import { StatCard } from '@/components/shared/StatCard';
import { Card } from '@/components/shared/Card';
import { YieldChart } from '@/components/vault/YieldChart';
import { AllocationPie } from '@/components/vault/AllocationPie';
import { ActivityFeed } from '@/components/shared/ActivityFeed';
import { formatCurrency, formatPercentage } from '@/lib/format';

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useDashboardStats();
  const { data: balances } = useVaultBalances();

  // Prefer on-chain balances when available, fall back to API data
  const liquidUSDC = balances?.liquidUSDC ?? stats?.liquidUSDC ?? 0;
  const usycPosition = balances?.usycPosition ?? stats?.usycPosition ?? 0;
  const totalAUM = liquidUSDC + usycPosition;

  if (error) {
    return <ErrorState onRetry={() => {/* refetch */}} />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Row — Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total AUM"
          value={formatCurrency(totalAUM)}
          change={stats?.apyChange}
          loading={isLoading}
        />
        <StatCard
          label="Yield Earned"
          value={`${formatCurrency(stats?.accruedYield?.monthly ?? 0)}/mo`}
          loading={isLoading}
        />
        <StatCard
          label="Current APY"
          value={formatPercentage(stats?.currentAPY ?? 0)}
          change={stats?.apyChange}
          loading={isLoading}
        />
      </div>

      {/* Second Row — Balance Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Liquid USDC"
          value={formatCurrency(liquidUSDC)}
          loading={isLoading}
        />
        <StatCard
          label="USYC Position"
          value={formatCurrency(usycPosition)}
          loading={isLoading}
        />
        <StatCard
          label="Pending Payouts"
          value={
            stats?.pendingPayouts
              ? `${stats.pendingPayouts.count} (${formatCurrency(stats.pendingPayouts.totalAmount)})`
              : 'None'
          }
          loading={isLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <YieldChart
            data={stats?.yieldHistory ?? []}
            loading={isLoading}
          />
        </Card>
        <Card className="lg:col-span-2">
          <AllocationPie
            liquidUSDC={liquidUSDC}
            usycPosition={usycPosition}
            loading={isLoading}
          />
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <ActivityFeed
          activities={stats?.recentActivity ?? []}
          loading={isLoading}
        />
      </Card>
    </div>
  );
}
```

---

## 6. Hooks Used

### 6.1 `useDashboardStats()`

Defined in: `packages/frontend/src/hooks/useDashboardStats.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => api.dashboard.getStats(),
    refetchInterval: 10_000, // Poll every 10 seconds
  });
}
```

### 6.2 `useVaultBalances()`

Defined in: `packages/frontend/src/hooks/useVaultBalances.ts`

Reads on-chain data from the TreasuryVault contract using wagmi hooks:
- `liquidUSDC`: USDC balance of the vault contract
- `usycPosition`: USYC balance converted to USD value
- `totalValue`: sum of the above
- `liquidityThreshold`: current threshold setting

Uses `useReadContracts` from wagmi with `watch: true` for automatic polling.

See `docs/frontend/08-hooks-and-state.md` for full implementation.

### 6.3 `useVaultHistory()`

Defined in: `packages/frontend/src/hooks/useVaultHistory.ts`

Fetches historical vault snapshot data for the yield chart. Accepts a time range parameter.

---

## 7. Formatting Utilities

File: **`packages/frontend/src/lib/format.ts`**

```typescript
/**
 * Format a number as USD currency string.
 * formatCurrency(1245000) -> "$1,245,000"
 * formatCurrency(1245000, { compact: true }) -> "$1.25M"
 */
export function formatCurrency(
  amount: number,
  options?: { compact?: boolean; decimals?: number }
): string;

/**
 * Format a number as a percentage.
 * formatPercentage(4.85) -> "4.85%"
 */
export function formatPercentage(value: number, decimals?: number): string;

/**
 * Format an ISO timestamp as relative time.
 * formatRelativeTime('2024-01-15T10:30:00Z') -> "2 min ago"
 */
export function formatRelativeTime(timestamp: string): string;

/**
 * Truncate an Ethereum address for display.
 * truncateAddress('0x1234...5678') -> "0x1234...5678"
 */
export function truncateAddress(address: string, chars?: number): string;
```

---

## 8. Loading States

When `isLoading` is true (initial fetch):

| Component | Loading Behavior |
|-----------|-----------------|
| StatCards (all 6) | Show `Skeleton` with card dimensions, shimmer animation |
| YieldChart | Show skeleton rectangle (aspect ratio ~16:9) with shimmer |
| AllocationPie | Show skeleton circle with shimmer |
| ActivityFeed | Show 5 skeleton rows: circle + two text blocks + small text block |

Use the `Skeleton` component from the design system (`docs/frontend/01-design-system.md`).

---

## 9. Error States

### API Failure
- If `useDashboardStats` returns an error:
  - Show an error Card: red-tinted background, error icon, error message, "Retry" button
  - Retry button calls `refetch()` from the TanStack Query hook

### Wallet Not Connected
- If the user has not connected their wallet:
  - On-chain balance data (`useVaultBalances`) will be unavailable
  - The API-sourced data still displays (API reads from indexed DB, not wallet)
  - Balance StatCards that rely on on-chain data: show a subtle "Connect wallet for live data" message or use API fallback values
  - Do NOT block the entire dashboard — always show what data is available

---

## 10. Files to Create / Modify

| File Path | Purpose |
|-----------|---------|
| `packages/frontend/src/app/page.tsx` | Dashboard page component |
| `packages/frontend/src/components/vault/YieldChart.tsx` | Area chart for yield over time (shared with vault page) |
| `packages/frontend/src/components/vault/AllocationPie.tsx` | Donut chart for asset allocation |
| `packages/frontend/src/components/shared/ActivityFeed.tsx` | Recent activity list component |
| `packages/frontend/src/components/shared/ActivityItem.tsx` | Individual activity row component |
| `packages/frontend/src/hooks/useDashboardStats.ts` | TanStack Query hook for dashboard API |
| `packages/frontend/src/hooks/useVaultBalances.ts` | wagmi hook for on-chain vault balances |
| `packages/frontend/src/hooks/useVaultHistory.ts` | TanStack Query hook for vault history |
| `packages/frontend/src/lib/format.ts` | Currency, percentage, time formatting utilities |

---

## 11. Cross-References

| Document | Relevance |
|----------|-----------|
| `docs/frontend/01-design-system.md` | StatCard, Card, Skeleton component specs |
| `docs/frontend/02-app-shell.md` | Layout wrapper, API client (`api.dashboard.getStats()`), contract config |
| `docs/frontend/04-vault-page.md` | Reuses `YieldChart` component, `useVaultBalances` hook |
| `docs/frontend/08-hooks-and-state.md` | Full hook implementations for `useDashboardStats`, `useVaultBalances`, `useVaultHistory` |
| `docs/technical/07-api-routes.md` | `GET /api/dashboard` response shape and behavior |
| `docs/technical/02-treasury-vault-contract.md` | Contract read functions used by `useVaultBalances` |
