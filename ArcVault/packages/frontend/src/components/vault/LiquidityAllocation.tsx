'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

interface LiquidityAllocationProps {
  usycPercent?: number;
  liquidPercent?: number;
  threshold?: number;
  onUpdateThreshold?: (value: number) => void;
}

export function LiquidityAllocation({
  usycPercent = 65,
  liquidPercent = 35,
  threshold = 20,
  onUpdateThreshold,
}: LiquidityAllocationProps) {
  const [thresholdInput, setThresholdInput] = useState(String(threshold));
  useEffect(() => { setThresholdInput(String(threshold)); }, [threshold]);
  const isAboveThreshold = liquidPercent >= threshold;

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

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-[var(--color-secondary,#C9A962)]" />
          <span className="text-muted">USYC ({usycPercent}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-[var(--color-primary,#D4A853)]" />
          <span className="text-muted">Liquid ({liquidPercent}%)</span>
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
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <input
            type="number"
            value={thresholdInput}
            onChange={(e) => setThresholdInput(e.target.value)}
            className="w-full bg-[#0A0A0A60] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-[#C9A96250]"
            placeholder="Threshold %"
            min={0}
            max={100}
          />
        </div>
        <button
          onClick={() => {
            const v = Number(thresholdInput);
            if (!Number.isFinite(v) || v < 0 || v > 100) return;
            onUpdateThreshold?.(v);
          }}
          className="px-4 py-2 rounded-lg bg-gradient-to-br from-[#C9A962] to-[#D4A853] text-[#0A0A0A] text-sm font-semibold hover:brightness-110 transition-all"
        >
          Update Threshold
        </button>
      </div>
    </div>
  );
}
