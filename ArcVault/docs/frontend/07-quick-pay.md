# Quick Pay Modal Specification

> **Purpose:** Floating action button (FAB) available on every page for ad-hoc one-off payments. Allows treasury operators to send stablecoin payments to any address without building a pipeline.
>
> **Tech stack:** Next.js App Router, React, Tailwind CSS, wagmi/viem, TanStack Query, Zustand

---

## Table of Contents

1. [Overview](#overview)
2. [FAB Button](#fab-button)
3. [QuickPayModal](#quickpaymodal)
4. [Form Fields](#form-fields)
5. [Payment Summary Section](#payment-summary-section)
6. [Send Payment Flow](#send-payment-flow)
7. [State Management](#state-management)
8. [Loading, Error & Edge-Case States](#loading-error--edge-case-states)
9. [Files to Create](#files-to-create)
10. [Cross-references](#cross-references)

---

## Overview

The Quick Pay feature consists of two parts:

1. **QuickPayFAB** -- A floating action button rendered in the root layout, visible on every page.
2. **QuickPayModal** -- A modal form for entering recipient, amount, currency, and memo, then executing the payment.

The FAB is always visible. Clicking it opens the modal. The modal handles FX quotes when a non-USDC currency is selected, executes the on-chain payout via the PayoutRouter contract, and records the transaction via the API.

---

## FAB Button

**File:** `packages/frontend/src/components/quick-pay/QuickPayFAB.tsx`

**Placement:** Rendered inside the root layout (`packages/frontend/src/app/layout.tsx`) so it appears on every page.

**Visual specification:**

| Property     | Value                                               |
| ------------ | --------------------------------------------------- |
| Position     | `fixed`, `bottom-6`, `right-6`                      |
| Size         | `w-14 h-14` (56 px)                                 |
| Shape        | Fully rounded (`rounded-full`)                      |
| Background   | Gradient primary: `bg-gradient-to-r from-blue-600 to-purple-600` |
| Icon         | Plus icon or paper-plane icon, white, 24 px          |
| Hover        | `hover:scale-105` + `hover:shadow-xl` transition     |
| Active       | `active:scale-95`                                    |
| z-index      | `z-40` (above page content, below modal overlay)     |
| Shadow       | `shadow-lg` default                                  |

**Implementation:**

```tsx
'use client';

import { useUIStore } from '@/stores/ui.store';
import { Plus } from 'lucide-react'; // or equivalent icon

export function QuickPayFAB() {
  const openQuickPay = useUIStore((s) => s.openQuickPay);

  return (
    <>
      <button
        onClick={openQuickPay}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center
                   justify-center rounded-full bg-gradient-to-r from-blue-600
                   to-purple-600 text-white shadow-lg transition-all
                   hover:scale-105 hover:shadow-xl active:scale-95"
        aria-label="Quick Pay"
      >
        <Plus className="h-6 w-6" />
      </button>
      <QuickPayModal />
    </>
  );
}
```

**Root layout integration:**

```tsx
// packages/frontend/src/app/layout.tsx
import { QuickPayFAB } from '@/components/quick-pay/QuickPayFAB';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>
          {/* App shell with sidebar, topbar, etc. */}
          {children}
          <QuickPayFAB />
        </Providers>
      </body>
    </html>
  );
}
```

---

## QuickPayModal

**File:** `packages/frontend/src/components/quick-pay/QuickPayModal.tsx`

A centered overlay modal using the design-system `Modal` component.

**Layout:**

```
+-------------------------------+
|  Quick Pay                 X  |
+-------------------------------+
|  Recipient                    |
|  [0x... or ENS name      ]   |
|                               |
|  Amount                       |
|  [$5,000                  ]   |
|                               |
|  Currency                     |
|  [EURC                   v]   |
|                               |
|  Memo (optional)              |
|  [Invoice #42             ]   |
|                               |
+-------------------------------+
|  Payment Summary              |
|  Est. cost: $5,024 USDC      |
|  FX rate: 1 USDC = 0.9235 EU |
|  FX spread: 0.05%            |
|  Network fee: ~$0.01         |
+-------------------------------+
|  [Cancel]    [Send Payment]   |
+-------------------------------+
```

**Open/close control:**

- Opened via `useUIStore().quickPayOpen`.
- Closed by: clicking X, clicking Cancel, clicking outside modal, pressing Escape, or after successful payment.
- On close, form state resets to defaults.

---

## Form Fields

All fields use local React state within the modal component.

### 1. Recipient

| Property     | Value                                                  |
| ------------ | ------------------------------------------------------ |
| Type         | Text input                                              |
| Placeholder  | `"0x... or ENS name"`                                  |
| Accepts      | Ethereum address (0x + 40 hex chars) or ENS name (*.eth) |
| Validation   | Valid hex address OR valid ENS format                   |
| Error message| `"Invalid address or ENS name"`                        |

**Validation logic:**

```typescript
function isValidRecipient(value: string): boolean {
  // Check Ethereum address
  if (/^0x[a-fA-F0-9]{40}$/.test(value)) return true;
  // Check ENS name (basic)
  if (/^[a-zA-Z0-9-]+\.eth$/.test(value)) return true;
  return false;
}
```

### 2. Amount

| Property     | Value                                                  |
| ------------ | ------------------------------------------------------ |
| Type         | Number input (rendered as text for formatting)          |
| Prefix       | `$` sign (visual only, not part of value)              |
| Placeholder  | `"0.00"`                                               |
| Validation   | Must be > 0, max 2 decimal places                      |
| Hint         | Shows remaining vault balance below input               |
| Error message| `"Amount must be greater than 0"`                      |

**Balance hint:** `"Available: $50,000 USDC"` sourced from `useVaultBalances().liquidUSDC`.

### 3. Currency

| Property     | Value                                                  |
| ------------ | ------------------------------------------------------ |
| Type         | Select dropdown (design-system `Select`)               |
| Options      | USDC, EURC, GBPC, JPYC, CADC                          |
| Default      | USDC                                                    |
| Behavior     | When non-USDC selected, triggers FX quote fetch         |

Each option displays: `[flag emoji] [code]` (same CurrencySelector pattern as the FX page).

### 4. Memo (optional)

| Property     | Value                                                  |
| ------------ | ------------------------------------------------------ |
| Type         | Text input                                              |
| Placeholder  | `"Invoice #, description, etc."`                       |
| Max length   | 100 characters                                          |
| Validation   | Optional; no validation beyond max length               |
| Purpose      | Stored as payout reference in the transaction record    |

---

## Payment Summary Section

**File:** `packages/frontend/src/components/quick-pay/PaymentSummary.tsx`

This section appears below the form fields when `amount > 0` and a currency is selected.

**Props:**

```typescript
interface PaymentSummaryProps {
  amount: number;
  currency: string;
  quote: FXQuote | null;     // null when currency === 'USDC'
  quoteLoading: boolean;
}
```

### When currency = USDC (no FX)

```
Payment Summary
Cost: $5,000.00 USDC
Network fee: ~$0.01
```

### When currency != USDC (FX required)

```
Payment Summary
Est. cost: $5,024.00 USDC
FX rate: 1 USDC = 0.9235 EURC
FX spread: 0.05%
Network fee: ~$0.01
```

**Computation:**

- Estimated USDC cost = `amount / quote.rate` (the user enters the target currency amount).
- FX rate and spread come from the `useFXQuote` response.
- Network fee is a static estimate (`~$0.01` on Arc testnet).

**Live updates:** The summary recalculates whenever `amount` or `currency` changes. When `currency` changes to a non-USDC value, `useFXQuote` fires and the summary shows a shimmer until the quote arrives.

---

## Send Payment Flow

### Button specification

| Property     | Value                                                  |
| ------------ | ------------------------------------------------------ |
| Style        | Gradient primary button (design-system `Button`)       |
| Text         | "Send Payment"                                          |
| Loading text | "Processing..."                                         |
| Loading icon | Spinner                                                 |

### Disabled conditions

The button is disabled when ANY of these conditions is true:

| Condition                    | Check                                    |
| ---------------------------- | ---------------------------------------- |
| Form invalid                 | Recipient invalid or amount <= 0          |
| Wallet not connected         | `!isConnected` (from wagmi)              |
| Quote expired (FX payments)  | `countdown <= 0` when currency != USDC   |
| Quote loading (FX payments)  | `quoteLoading` when currency != USDC     |
| Transaction in progress      | `executePayout.isPending`                |

### Execution sequence

```typescript
async function handleSendPayment() {
  try {
    // Step 1: If non-USDC, execute FX swap first
    if (currency !== 'USDC') {
      await executeSwap.mutateAsync({
        quoteId: quote.quoteId,
        fromCurrency: 'USDC',
        toCurrency: currency,
        fromAmount: estimatedUSDCCost,
      });
    }

    // Step 2: Execute payout via PayoutRouter contract
    const txReceipt = await executePayout.mutateAsync({
      recipient: resolvedAddress,  // ENS resolved if needed
      amount: amountInSmallestUnit,
      targetCurrency: currency,
      reference: memo || '',
    });

    // Step 3: Record payout via API
    await fetch('/api/payouts', {
      method: 'POST',
      body: JSON.stringify({
        recipient,
        amount,
        currency,
        memo,
        txHash: txReceipt.transactionHash,
      }),
    });

    // Step 4: Success
    toast.success(`Payment sent! TX: ${shortenAddress(txReceipt.transactionHash)}`);
    closeQuickPay();  // close modal + reset form

  } catch (err) {
    // Step 5: Error — keep modal open for retry
    toast.error(`Payment failed: ${err.message}`);
  }
}
```

### Post-execution

- **Success:** Modal closes. Success toast appears with shortened TX hash. Vault balances and payout list queries are invalidated (handled by the hooks' `onSuccess` callbacks).
- **Error:** Modal stays open. Error toast appears. User can retry or cancel.

---

## State Management

### Local form state

All form fields are managed with `useState` inside `QuickPayModal`:

```typescript
const [recipient, setRecipient] = useState('');
const [amount, setAmount] = useState('');
const [currency, setCurrency] = useState('USDC');
const [memo, setMemo] = useState('');
```

State resets when the modal closes.

### Modal open/close

Controlled by the UI Zustand store:

```typescript
// In useUIStore
quickPayOpen: boolean;
openQuickPay: () => void;
closeQuickPay: () => void;
```

### Hooks used

| Hook                 | Purpose                                           |
| -------------------- | ------------------------------------------------- |
| `useFXQuote(pair, amount)` | Live FX quote when currency != USDC          |
| `useExecutePayout()` | Contract write to PayoutRouter                    |
| `useExecuteSwap()`   | FX swap execution (when currency != USDC)         |
| `useVaultBalances()`  | Display available balance hint                   |

All hooks are defined in `docs/frontend/08-hooks-and-state.md`.

---

## Loading, Error & Edge-Case States

| Scenario                      | UI Behavior                                                       |
| ----------------------------- | ----------------------------------------------------------------- |
| Modal opening                 | Fade-in animation; form fields empty                              |
| Wallet not connected          | "Send Payment" shows "Connect wallet"; button disabled            |
| FX quote loading              | Shimmer on Payment Summary; button disabled                       |
| FX quote expired              | "Quote expired, refreshing..." in summary; button disabled        |
| Invalid recipient             | Red border on input + error message below                         |
| Amount = 0                    | Button disabled; no summary shown                                 |
| Amount exceeds vault balance  | Warning text: "Insufficient balance" below amount input           |
| Transaction in progress       | Button shows spinner + "Processing..."; form inputs disabled      |
| Transaction success           | Modal closes; success toast with TX hash                          |
| Transaction error             | Error toast; modal stays open; form re-enabled for retry          |
| ENS resolution                | If ENS name entered, resolve to address before sending            |
| Network error                 | Toast with network error; retry available                         |

---

## Files to Create

| File                                                                   | Type      | Purpose                    |
| ---------------------------------------------------------------------- | --------- | -------------------------- |
| `packages/frontend/src/components/quick-pay/QuickPayFAB.tsx`           | Component | Floating action button     |
| `packages/frontend/src/components/quick-pay/QuickPayModal.tsx`         | Component | Modal form                 |
| `packages/frontend/src/components/quick-pay/PaymentSummary.tsx`        | Component | Cost summary display       |

**Modification required:**

| File                                            | Change                                     |
| ----------------------------------------------- | ------------------------------------------ |
| `packages/frontend/src/app/layout.tsx`          | Add `<QuickPayFAB />` to root layout       |

---

## Cross-references

| Document                                       | Relevance                                                |
| ---------------------------------------------- | -------------------------------------------------------- |
| `docs/frontend/01-design-system.md`            | Modal, Button, Input, Select components                  |
| `docs/frontend/02-app-shell.md`                | Root layout where FAB is rendered                        |
| `docs/frontend/08-hooks-and-state.md`          | useExecutePayout, useFXQuote, useExecuteSwap, useVaultBalances, UI Zustand store |
| `docs/technical/03-payout-router-contract.md`  | `executePayout` contract function                        |
| `docs/technical/07-api-routes.md`              | `POST /api/payouts` endpoint                             |
