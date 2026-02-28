'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

type ThresholdMode = 'percent' | 'amount';

interface LiquidityAllocationProps {
  usycPercent?: number;
  liquidPercent?: number;
  threshold?: number;
  totalBalance?: number;
  onUpdateThreshold?: (value: number) => void;
  onRebalance?: (usycAmount: number, liquidAmount: number) => void;
  isUpdating?: boolean;
  canUpdate?: boolean;
}

export function LiquidityAllocation({
  usycPercent = 65,
  liquidPercent = 35,
  threshold = 20,
  totalBalance = 1_000_000,
  onUpdateThreshold,
  onRebalance,
  isUpdating = false,
  canUpdate = true,
}: LiquidityAllocationProps) {
  const [thresholdMode, setThresholdMode] = useState<ThresholdMode>('percent');
  const [thresholdInput, setThresholdInput] = useState(String(threshold));
  const [amountInput, setAmountInput] = useState('');
  useEffect(() => { setThresholdInput(String(threshold)); }, [threshold]);
  const isAboveThreshold = liquidPercent >= threshold;

  const usycAmount = (usycPercent / 100) * totalBalance;
  const liquidAmount = (liquidPercent / 100) * totalBalance;

  const formatAmount = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <div className="bg-transparent border border-[#2A2A2A] rounded-xl p-6 space-y-5">
      <h3 className="font-display text-xl font-medium text-foreground">Liquidity Allocation</h3>

      {/* Stacked bar */}
      <div className="h-8 rounded-lg overflow-hidden flex">
        <div
          className="bg-[var(--color-secondary,#C9A962)] transition-all"
          style={{ width: `${usycPercent}%` }}
        />
        <div
          className="bg-[var(--color-primary,#D4A853)] transition-all"
          style={{ width: `${liquidPercent}%` }}
        />
      </div>

      {/* Legend with amounts */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-[var(--color-secondary,#C9A962)]" />
          <span className="text-muted">USYC {usycPercent}% &middot; {formatAmount(usycAmount)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-[var(--color-primary,#D4A853)]" />
          <span className="text-muted">Liquid {liquidPercent}% &middot; {formatAmount(liquidAmount)}</span>
        </div>
      </div>

      {/* Threshold marker */}
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-[#C9A962]" />
        <span className="text-sm text-muted">Liquidity Threshold: {threshold}%</span>
        <span
          className={clsx(
            'ml-auto text-xs font-medium px-2 py-0.5 rounded-full',
            isAboveThreshold
              ? 'bg-[#4ADE8020] text-[#4ADE80]'
              : 'bg-[#EF444420] text-[#EF4444]',
          )}
        >
          {isAboveThreshold ? 'Healthy' : 'Below Threshold'}
        </span>
      </div>

      {/* Threshold controls */}
      <div className="space-y-3">
        {!canUpdate && (
          <p className="text-xs text-[#EF4444]">
            Your wallet does not have permission to update the threshold (requires CFO role).
          </p>
        )}
        {/* Mode toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Set threshold by:</span>
          <div className="flex rounded-lg overflow-hidden border border-[#2A2A2A]">
            <button
              onClick={() => setThresholdMode('percent')}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium transition-all',
                thresholdMode === 'percent'
                  ? 'bg-[#C9A96230] text-[#C9A962]'
                  : 'bg-transparent text-muted hover:text-foreground',
              )}
            >
              %
            </button>
            <button
              onClick={() => setThresholdMode('amount')}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium transition-all',
                thresholdMode === 'amount'
                  ? 'bg-[#C9A96230] text-[#C9A962]'
                  : 'bg-transparent text-muted hover:text-foreground',
              )}
            >
              $
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {thresholdMode === 'percent' ? (
            <div className="flex-1 relative">
              <input
                type="number"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                disabled={!canUpdate}
                className="w-full bg-[#0A0A0A60] border border-[#2A2A2A] rounded-lg px-3 py-2 pr-8 text-sm text-foreground outline-none focus:border-[#C9A96250] disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Threshold %"
                min={0}
                max={100}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">%</span>
            </div>
          ) : (
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">$</span>
              <input
                type="number"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                disabled={!canUpdate}
                className="w-full bg-[#0A0A0A60] border border-[#2A2A2A] rounded-lg pl-7 pr-3 py-2 text-sm text-foreground outline-none focus:border-[#C9A96250] disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Amount in USD"
                min={0}
              />
            </div>
          )}
          <button
            disabled={isUpdating || !canUpdate}
            onClick={() => {
              if (thresholdMode === 'percent') {
                const v = Number(thresholdInput);
                if (!Number.isFinite(v) || v < 0 || v > 100) return;
                onUpdateThreshold?.(v);
              } else {
                const amt = Number(amountInput);
                if (!Number.isFinite(amt) || amt < 0 || totalBalance <= 0) return;
                const pct = Math.min(100, (amt / totalBalance) * 100);
                onUpdateThreshold?.(Math.round(pct * 100) / 100);
              }
            }}
            className={clsx(
              'px-4 py-2 rounded-lg bg-gradient-to-br from-[#C9A962] to-[#D4A853] text-[#0A0A0A] text-sm font-semibold transition-all',
              isUpdating ? 'opacity-60 cursor-not-allowed' : 'hover:brightness-110',
            )}
          >
            {isUpdating ? 'Updating...' : 'Update Threshold'}
          </button>

          <button
            onClick={() => onRebalance?.(usycAmount, liquidAmount)}
            className="px-4 py-2 rounded-lg border border-[#C9A96230] text-[#C9A962] text-sm font-semibold hover:bg-[#C9A96215] transition-all"
          >
            Rebalance
          </button>
        </div>
      </div>
    </div>
  );
}
