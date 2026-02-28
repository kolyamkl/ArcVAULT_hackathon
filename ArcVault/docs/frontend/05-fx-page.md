# FX Conversion Page Specification

> **Route:** `/fx` (`packages/frontend/src/app/fx/page.tsx`)
>
> **Purpose:** Uniswap-style FX swap interface for converting between stablecoins (USDC, EURC, GBPC, JPYC, CADC) with live quotes, countdown timers, and transaction history.
>
> **Tech stack:** Next.js App Router, React, Tailwind CSS, TanStack Query, wagmi/viem, Zustand

---

## Table of Contents

1. [Page Overview](#page-overview)
2. [Layout](#layout)
3. [Components](#components)
4. [Hooks & Data Flow](#hooks--data-flow)
5. [Loading, Error & Edge-Case States](#loading-error--edge-case-states)
6. [Files to Create](#files-to-create)
7. [Cross-references](#cross-references)

---

## Page Overview

The FX page provides a single-page swap experience for treasury operators to convert between supported stablecoins. It is composed of two main sections:

1. **Centered Swap Card** (max-width 480 px) — currency pair selector, amount inputs, live quote, and execute button.
2. **Full-width History Table** below the card — paginated log of past FX conversions.

The page is wrapped in the standard app shell layout (sidebar + top bar) as described in `docs/frontend/02-app-shell.md`.

---

## Layout

```
          +-----------------------------+
          |  FX Conversion              |
          +-----------------------------+
          |  From                       |
          |  [USDC v]    [10,000.00]    |
          |  Balance: $50,000           |
          |                             |
          |        [ swap icon ]        |
          |                             |
          |  To                         |
          |  [EURC v]    [9,234.50]     |
          |                             |
          |  Rate: 1 USDC = 0.9235 EURC |
          |  Spread: 0.05%              |
          |  Quote expires: 0:28        |
          |                             |
          |  [    Execute Swap    ]     |
          +-----------------------------+

+-------------------------------------------------------+
|  Transaction History                                   |
|  Pair      | Rate    | From     | To       | Status   |
|  USDC/EURC | 0.9235  | $10,000  | EUR9,235 | Done     |
|  USDC/GBPC | 0.7890  | $25,000  | GBP19725 | Done     |
|  USDC/JPYC | 149.50  | $5,000   | JPY747500| Pending  |
+-------------------------------------------------------+
```

**Tailwind structure (page.tsx):**

```tsx
export default function FXPage() {
  return (
    <div className="flex flex-col items-center gap-8 py-8 px-4">
      {/* Swap Card — centered, constrained width */}
      <div className="w-full max-w-[480px]">
        <FXSwapCard />
      </div>

      {/* History Table — full width */}
      <div className="w-full max-w-5xl">
        <FXHistoryTable />
      </div>
    </div>
  );
}
```

---

## Components

### 1. FXSwapCard

**File:** `packages/frontend/src/components/fx/FXSwapCard.tsx`

The primary swap interface. Uses the design-system `Card` wrapper.

**Internal state:**

| State             | Type     | Default  | Notes                                  |
| ----------------- | -------- | -------- | -------------------------------------- |
| `fromCurrency`    | `string` | `"USDC"` | Selected source currency               |
| `toCurrency`      | `string` | `"EURC"` | Selected target currency               |
| `fromAmount`      | `string` | `""`     | User-typed amount (string for decimals)|
| `toAmount`        | `string` | computed | Derived from quote response            |

**Behavior:**

- Two `CurrencySelector` + `Input` pairs, one for "From" and one for "To".
- The "From" amount is user-editable; the "To" amount is **read-only** and auto-calculated from the quote.
- A "From" balance label sits below the From input, sourced from `useVaultBalances()`.
- A **swap direction button** (vertical arrows icon) sits between the two sections. Clicking it swaps `fromCurrency` and `toCurrency` (and clears amounts).
- The `QuoteDisplay` component renders below the "To" section.
- The `ExecuteSwapButton` renders at the bottom.

**Quote fetching:**

```typescript
const debouncedAmount = useDebounce(fromAmount, 500);
const pair = `${fromCurrency}/${toCurrency}`;

const { data: quote, isLoading: quoteLoading } = useFXQuote(
  pair,
  debouncedAmount
);
```

When `quote` arrives, compute `toAmount = quote.toAmount` and display in the "To" input.

---

### 2. CurrencySelector

**File:** `packages/frontend/src/components/fx/CurrencySelector.tsx`

A dropdown built on the design-system `Select` component.

**Props:**

```typescript
interface CurrencySelectorProps {
  value: string;                        // current currency code
  onChange: (currency: string) => void;  // callback
  exclude?: string;                     // currency to hide (prevents same-pair)
}
```

**Supported currencies:**

| Code  | Flag | Name              |
| ----- | ---- | ----------------- |
| USDC  | US flag  | US Dollar Coin    |
| EURC  | EU flag  | Euro Coin         |
| GBPC  | GB flag  | British Pound Coin|
| JPYC  | JP flag  | Japanese Yen Coin |
| CADC  | CA flag  | Canadian Dollar Coin |

Each option renders: `[flag emoji] [code] — [name]`.

The `exclude` prop removes the currently selected opposite currency from the list (you cannot swap USDC to USDC).

Currency list is ideally fetched from `StableFX.getSupportedPairs()` at build time or on mount, but can be hardcoded for the hackathon.

---

### 3. QuoteDisplay

**File:** `packages/frontend/src/components/fx/QuoteDisplay.tsx`

Shows the live conversion rate, spread, and expiry countdown.

**Props:**

```typescript
interface QuoteDisplayProps {
  quote: FXQuote | null;
  isLoading: boolean;
}
```

**Rendered fields:**

| Field            | Format                        | Example                   |
| ---------------- | ----------------------------- | ------------------------- |
| Rate             | `1 {from} = {rate} {to}`     | `1 USDC = 0.9235 EURC`   |
| Spread           | `{spread}%`                  | `0.05%`                   |
| Quote expires    | `0:{seconds}` countdown      | `0:28`                    |

**Countdown logic:**

- `expiresAt` comes from the quote response (ISO timestamp or epoch).
- A `useEffect` with `setInterval(1000)` decrements the remaining seconds each tick.
- When seconds <= 10: text turns `text-amber-500` as a warning.
- When seconds <= 0: display "Quote expired, refreshing..." and TanStack Query auto-refetches.
- The countdown resets whenever a new quote arrives.

**Loading state:** Shimmer / skeleton placeholders on rate and spread lines.

---

### 4. ExecuteSwapButton

**File:** Inline within `FXSwapCard.tsx` (or extract if complex).

A gradient primary `Button` from the design system.

**Disabled conditions (all must be false to enable):**

| Condition                | Check                             |
| ------------------------ | --------------------------------- |
| No quote available       | `!quote`                          |
| Quote expired            | `countdown <= 0`                  |
| Amount is zero or empty  | `!fromAmount || Number(fromAmount) <= 0` |
| Wallet not connected     | `!isConnected` (from wagmi)       |

**Click handler:**

```typescript
const executeSwap = useExecuteSwap();

async function handleExecute() {
  try {
    const result = await executeSwap.mutateAsync({
      quoteId: quote.quoteId,
      fromCurrency,
      toCurrency,
      fromAmount,
    });
    toast.success(`Swap executed! TX: ${shortenAddress(result.txHash)}`);
    // Quote and history queries auto-invalidate via the hook
  } catch (err) {
    toast.error(`Swap failed: ${err.message}`);
  }
}
```

**Loading state:** Spinner inside button + "Processing..." text.

---

### 5. FXHistoryTable

**File:** `packages/frontend/src/components/fx/FXHistoryTable.tsx`

A paginated data table of past FX conversions.

**Columns:**

| Column       | Source field   | Render                                          |
| ------------ | -------------- | ----------------------------------------------- |
| Pair         | `pair`         | e.g., `USDC/EURC`                               |
| Rate         | `rate`         | Formatted number                                 |
| From Amount  | `fromAmount`   | `formatCurrency(fromAmount, fromCurrency)`       |
| To Amount    | `toAmount`     | `formatCurrency(toAmount, toCurrency)`           |
| Timestamp    | `createdAt`    | `formatRelativeTime(createdAt)`                  |
| Status       | `status`       | `StatusBadge` component (COMPLETED, PENDING, FAILED) |
| TX Hash      | `txHash`       | Shortened hash linking to Arc block explorer     |

**Pagination:**

- 10 rows per page.
- Previous / Next buttons below table.
- Page state managed locally; passed to `useFXHistory({ page, limit: 10 })`.

**Loading state:** Skeleton rows (3-5 rows of gray shimmer blocks matching column widths).

**Empty state:** "No FX conversions yet" centered text with a subtle icon.

---

## Hooks & Data Flow

All hooks referenced here are defined in `docs/frontend/08-hooks-and-state.md`. Brief summary of usage on this page:

### `useFXQuote(pair, amount)`

- **Endpoint:** `GET /api/fx/quote?pair={pair}&amount={amount}`
- **Behavior:** Enabled only when both `pair` and `amount` are truthy. Uses `staleTime: 25_000` so the quote auto-refreshes before the 30-second expiry.
- **Returns:** `{ quoteId, rate, spread, fromAmount, toAmount, expiresAt }`

### `useExecuteSwap()`

- **Endpoint:** `POST /api/fx/execute` with body `{ quoteId, fromCurrency, toCurrency, fromAmount }`
- **Type:** TanStack `useMutation`.
- **On success:** Invalidates `queryKeys.fx.history` and `queryKeys.vault.balances`.

### `useFXHistory(params)`

- **Endpoint:** `GET /api/fx/history?page={page}&limit={limit}`
- **Returns:** `{ quotes, total, page, limit }`

### `useVaultBalances()`

- **Source:** On-chain reads via wagmi (`TreasuryVault` contract).
- **Used for:** Displaying the "Balance: $X" label under the From currency input.

---

## Loading, Error & Edge-Case States

| Scenario                  | UI Behavior                                                                 |
| ------------------------- | --------------------------------------------------------------------------- |
| Quote loading             | Shimmer placeholders on rate, spread, and "To" amount fields                |
| Quote expired             | "Quote expired, refreshing..." text; Execute button disabled                |
| Quote countdown < 10s     | Countdown text turns `text-amber-500`                                       |
| History loading           | 3-5 skeleton table rows                                                     |
| History empty             | "No FX conversions yet" message                                             |
| Wallet not connected      | Execute button shows "Connect wallet to swap"; button disabled              |
| Swap in progress          | Button shows spinner + "Processing..."; form inputs disabled                |
| Swap success              | Toast notification with shortened TX hash; history table refetches           |
| Swap error                | Toast notification with error message; modal/form stays open for retry       |
| Amount = 0 or empty       | Execute button disabled; quote not fetched                                  |
| Same currency selected    | Prevented by `exclude` prop on CurrencySelector; cannot select same pair    |
| Network error on quote    | Show inline error "Failed to fetch quote. Retrying..." with retry logic     |

---

## Files to Create

| File                                                           | Type        | Purpose                        |
| -------------------------------------------------------------- | ----------- | ------------------------------ |
| `packages/frontend/src/app/fx/page.tsx`                        | Page        | Route entry point              |
| `packages/frontend/src/components/fx/FXSwapCard.tsx`           | Component   | Main swap card                 |
| `packages/frontend/src/components/fx/CurrencySelector.tsx`     | Component   | Currency dropdown              |
| `packages/frontend/src/components/fx/QuoteDisplay.tsx`         | Component   | Rate, spread, countdown        |
| `packages/frontend/src/components/fx/FXHistoryTable.tsx`       | Component   | Past conversions table         |

---

## Cross-references

| Document                                      | Relevance                                                |
| --------------------------------------------- | -------------------------------------------------------- |
| `docs/frontend/01-design-system.md`           | Card, Input, Select, Button, StatusBadge, DataTable      |
| `docs/frontend/08-hooks-and-state.md`         | useFXQuote, useExecuteSwap, useFXHistory, useVaultBalances |
| `docs/technical/07-api-routes.md`             | `/api/fx/quote`, `/api/fx/execute`, `/api/fx/history`    |
| `docs/technical/08-external-integrations.md`  | StableFX adapter (getSupportedPairs, getQuote, executeSwap) |
