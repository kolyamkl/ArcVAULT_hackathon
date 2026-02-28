'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { TooltipProps } from 'recharts';
import { clsx } from 'clsx';
import { Skeleton } from '@/components/shared/Skeleton';
import { formatCurrency, formatPercentage } from '@/lib/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AllocationPieProps {
  liquidUSDC: number;
  usycPosition: number;
  loading?: boolean;
}

interface PieDataEntry {
  name: string;
  value: number;
  color: string;
}

// ---------------------------------------------------------------------------
// Color constants — gold theme
// ---------------------------------------------------------------------------

const COLORS = {
  liquidUSDC: '#D4A853',
  usyc: '#B08D3E',
};

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function PieTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const entry = payload[0];
  const total = (entry?.payload as PieDataEntry & { total?: number })?.total ?? 1;
  const pct = total > 0 ? ((entry?.value ?? 0) / total) * 100 : 0;

  return (
    <div className="bg-[#232120] border border-[#383430] shadow-lg rounded-lg p-3 text-sm">
      <p className="font-medium text-foreground">{entry?.name}</p>
      <p className="text-muted">
        {formatCurrency(entry?.value ?? 0)} ({formatPercentage(pct, 1)})
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Center label renderer (rendered as SVG text)
// ---------------------------------------------------------------------------

function CenterLabel({ total }: { total: number }) {
  let display: string;
  if (total >= 1_000_000_000) {
    display = `$${(total / 1_000_000_000).toFixed(1)}B`;
  } else if (total >= 1_000_000) {
    display = `$${(total / 1_000_000).toFixed(2)}M`;
  } else if (total >= 1_000) {
    display = `$${(total / 1_000).toFixed(1)}K`;
  } else {
    display = `$${total.toFixed(0)}`;
  }

  return (
    <>
      <text
        x="50%"
        y="45%"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground"
        style={{ fontSize: 18, fontWeight: 600 }}
      >
        {display}
      </text>
      <text
        x="50%"
        y="58%"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-muted"
        style={{ fontSize: 11 }}
      >
        Total
      </text>
    </>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AllocationPie({
  liquidUSDC,
  usycPosition,
  loading = false,
}: AllocationPieProps) {
  const total = liquidUSDC + usycPosition;

  const pieData: (PieDataEntry & { total: number })[] = useMemo(
    () => [
      { name: 'Liquid USDC', value: liquidUSDC, color: COLORS.liquidUSDC, total },
      { name: 'USYC', value: usycPosition, color: COLORS.usyc, total },
    ],
    [liquidUSDC, usycPosition, total],
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4">
        <Skeleton variant="circular" width={200} height={200} />
        <div className="space-y-2 w-full">
          <Skeleton variant="text" className="h-4 w-40" />
          <Skeleton variant="text" className="h-4 w-36" />
        </div>
      </div>
    );
  }

  // Handle zero-value state
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-sm text-muted">
        <p>No allocation data</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Donut chart */}
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="85%"
            paddingAngle={2}
            dataKey="value"
            stroke="none"
            animationDuration={500}
          >
            {pieData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<PieTooltip />} />
          <CenterLabel total={total} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-col gap-2 mt-2 w-full">
        {pieData.map((entry) => {
          const pct = total > 0 ? (entry.value / total) * 100 : 0;
          return (
            <div key={entry.name} className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-muted flex-1">{entry.name}</span>
              <span className="text-sm font-medium text-foreground">
                {formatCurrency(entry.value)} ({formatPercentage(pct, 1)})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
