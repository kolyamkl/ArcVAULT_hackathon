'use client';

import { clsx } from 'clsx';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/shared/Skeleton';
import { formatCurrency, formatPercentage } from '@/lib/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TimeRange = '1D' | '1W' | '1M' | '3M' | 'ALL';

interface YieldBreakdownProps {
  daily: number;
  weekly: number;
  monthly: number;
  projectedAnnual: number;
  currentAPY: number;
  apyChange: number;
  loading?: boolean;
  /** Currently selected time range. */
  timeRange?: TimeRange;
  /** Callback when the user selects a different time range. */
  onTimeRangeChange?: (range: TimeRange) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIME_RANGES: TimeRange[] = ['1D', '1W', '1M', '3M', 'ALL'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function YieldBreakdown({
  daily,
  weekly,
  monthly,
  projectedAnnual,
  currentAPY,
  apyChange,
  loading = false,
  timeRange = '1M',
  onTimeRangeChange,
}: YieldBreakdownProps) {
  if (loading) {
    return (
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <Skeleton variant="text" className="h-6 w-40" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" className="w-10 h-7 rounded-md" />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="text" className="h-10 w-28" />
          ))}
        </div>
      </div>
    );
  }

  const metrics = [
    { label: 'Daily', value: formatCurrency(daily, { decimals: 2 }) },
    { label: 'Weekly', value: formatCurrency(weekly, { decimals: 0 }) },
    { label: 'Monthly', value: formatCurrency(monthly, { decimals: 0 }) },
  ];

  return (
    <div className="space-y-4 mb-6">
      {/* Header + time range selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-display text-2xl font-medium text-foreground">Yield Performance</h3>

        <div className="flex items-center gap-1">
          {TIME_RANGES.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => onTimeRangeChange?.(range)}
              className={clsx(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                timeRange === range
                  ? 'bg-[#C9A962] text-[#0A0A0A]'
                  : 'bg-[#262420] text-[#A09D95] hover:text-foreground',
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Primary metrics row */}
      <div className="flex flex-wrap items-center gap-6 sm:gap-8">
        {metrics.map((m, i) => (
          <div key={m.label} className="flex items-center gap-6">
            <div>
              <p className="text-xs text-[#A09D95] uppercase tracking-wider">{m.label}</p>
              <p className="text-lg font-medium text-[#C9A962]">{m.value}</p>
            </div>
            {i < metrics.length - 1 && (
              <div className="hidden sm:block w-px h-8 bg-[#383430]" />
            )}
          </div>
        ))}
      </div>

      {/* Secondary metrics row */}
      <div className="flex flex-wrap items-center gap-6 sm:gap-8">
        <div>
          <p className="text-xs text-[#A09D95] uppercase tracking-wider">Projected Annual</p>
          <p className="text-lg font-medium text-[#C9A962]">
            {formatCurrency(projectedAnnual, { decimals: 0 })}
          </p>
        </div>

        <div className="hidden sm:block w-px h-8 bg-[#383430]" />

        <div>
          <p className="text-xs text-[#A09D95] uppercase tracking-wider">APY</p>
          <div className="flex items-center gap-2">
            <p className="text-lg font-medium text-[#C9A962]">
              {formatPercentage(currentAPY)}
            </p>
            {apyChange !== 0 && (
              <span
                className={clsx(
                  'inline-flex items-center gap-0.5 text-sm font-medium',
                  apyChange > 0 ? 'text-success' : 'text-error',
                )}
              >
                {apyChange > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {apyChange > 0 ? '+' : ''}
                {formatPercentage(apyChange)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
