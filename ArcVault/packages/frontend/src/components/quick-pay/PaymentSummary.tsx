'use client';

import { Skeleton } from '@/components/shared/Skeleton';
import { formatCurrency } from '@/lib/utils';
import type { FXQuote } from '@/types/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaymentSummaryProps {
  /** Target currency amount the user wants to send */
  amount: number;
  /** Target currency code (e.g. EURC, GBPC) */
  currency: string;
  /** FX quote data; null when currency is USDC (no conversion needed) */
  quote: FXQuote | null;
  /** Whether the FX quote is currently loading */
  quoteLoading: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Payment cost breakdown displayed below the Quick Pay form fields.
 *
 * Shows a simple line-item summary when paying in USDC, or a full
 * FX breakdown (estimated USDC cost, rate, spread, network fee) when
 * paying in a non-USDC currency.
 */
export function PaymentSummary({
  amount,
  currency,
  quote,
  quoteLoading,
}: PaymentSummaryProps) {
  const isUSDC = currency === 'USDC';
  const networkFee = 0.01;

  // For USDC payments, no FX conversion is needed
  if (isUSDC) {
    return (
      <div className="rounded-lg border border-[#383430] bg-[#C9A96208] p-4 space-y-2">
        <h4 className="text-sm font-semibold text-[#C9A962]">Payment Summary</h4>
        <SummaryRow
          label="Cost"
          value={formatCurrency(amount, 'USDC')}
          suffix="USDC"
        />
        <SummaryRow
          label="Network fee"
          value={`~${formatCurrency(networkFee, 'USDC')}`}
          muted
        />
      </div>
    );
  }

  // For non-USDC payments, show FX breakdown
  if (quoteLoading) {
    return (
      <div className="rounded-lg border border-[#383430] bg-[#C9A96208] p-4 space-y-3">
        <h4 className="text-sm font-semibold text-[#C9A962]">Payment Summary</h4>
        <Skeleton variant="text" className="h-4 w-3/4" />
        <Skeleton variant="text" className="h-4 w-1/2" />
        <Skeleton variant="text" className="h-4 w-2/3" />
        <Skeleton variant="text" className="h-4 w-1/3" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="rounded-lg border border-[#383430] bg-[#C9A96208] p-4">
        <h4 className="text-sm font-semibold text-[#C9A962]">Payment Summary</h4>
        <p className="text-xs text-muted mt-2">Enter an amount to see the cost breakdown.</p>
      </div>
    );
  }

  // The user enters the target currency amount.
  // Estimated USDC cost = amount / rate (rate = how much target currency per 1 USDC).
  const estimatedUSDCCost = amount / quote.rate;
  const spread = 0.05; // 0.05% spread

  return (
    <div className="rounded-lg border border-[#383430] bg-[#C9A96208] p-4 space-y-2">
      <h4 className="text-sm font-semibold text-[#C9A962]">Payment Summary</h4>
      <SummaryRow
        label="Est. cost"
        value={formatCurrency(estimatedUSDCCost, 'USDC')}
        suffix="USDC"
        highlight
      />
      <SummaryRow
        label="FX rate"
        value={`1 USDC = ${quote.rate.toFixed(4)} ${currency}`}
      />
      <SummaryRow
        label="FX spread"
        value={`${spread}%`}
        muted
      />
      <SummaryRow
        label="Network fee"
        value={`~${formatCurrency(networkFee, 'USDC')}`}
        muted
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal sub-component
// ---------------------------------------------------------------------------

interface SummaryRowProps {
  label: string;
  value: string;
  suffix?: string;
  muted?: boolean;
  highlight?: boolean;
}

function SummaryRow({ label, value, suffix, muted, highlight }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span
        className={
          highlight
            ? 'font-semibold text-[#C9A962]'
            : muted
              ? 'text-muted'
              : 'text-foreground'
        }
      >
        {value}
        {suffix && <span className="ml-1 text-xs text-muted">{suffix}</span>}
      </span>
    </div>
  );
}
