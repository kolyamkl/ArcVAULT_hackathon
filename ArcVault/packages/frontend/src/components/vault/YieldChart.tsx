'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { clsx } from 'clsx';
import { Skeleton } from '@/components/shared/Skeleton';
import { formatCurrency } from '@/lib/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface YieldDataPoint {
  date: string;
  cumulativeYield: number;
  dailyYield: number;
}

type TimeRange = '1D' | '1W' | '1M' | '3M' | 'ALL';

interface YieldChartProps {
  data: YieldDataPoint[];
  /** Controlled time range (used on vault page where parent controls range). */
  timeRange?: TimeRange;
  /** Callback when user changes time range. */
  onTimeRangeChange?: (range: TimeRange) => void;
  /** Whether to show the built-in time range selector. Defaults to true. */
  showTimeRangeSelector?: boolean;
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Time range configuration
// ---------------------------------------------------------------------------

const TIME_RANGES: TimeRange[] = ['1D', '1W', '1M', '3M'];
const VAULT_TIME_RANGES: TimeRange[] = ['1D', '1W', '1M', '3M', 'ALL'];

const RANGE_DAYS: Record<TimeRange, number> = {
  '1D': 1,
  '1W': 7,
  '1M': 30,
  '3M': 90,
  ALL: Infinity,
};

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const dateStr = new Date(label as string).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="bg-[#232120] border border-[#383430] shadow-lg rounded-lg p-3 text-sm">
      <p className="text-muted text-xs mb-2">{dateStr}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted">Cumulative</span>
          <span className="font-medium text-[#C9A962]">
            {formatCurrency(payload[0]?.value ?? 0, { decimals: 2 })}
          </span>
        </div>
        {payload[1] && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted">Daily</span>
            <span className="font-medium text-success">
              +{formatCurrency(payload[1]?.value ?? 0, { decimals: 2 })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function YieldChart({
  data,
  timeRange: controlledRange,
  onTimeRangeChange,
  showTimeRangeSelector = true,
  loading = false,
}: YieldChartProps) {
  const [internalRange, setInternalRange] = useState<TimeRange>('1M');

  const activeRange = controlledRange ?? internalRange;
  const ranges = controlledRange ? VAULT_TIME_RANGES : TIME_RANGES;

  const handleRangeChange = useCallback(
    (range: TimeRange) => {
      if (onTimeRangeChange) {
        onTimeRangeChange(range);
      } else {
        setInternalRange(range);
      }
    },
    [onTimeRangeChange],
  );

  // Filter data based on selected time range
  const filteredData = useMemo(() => {
    if (!data.length) return [];
    const days = RANGE_DAYS[activeRange];
    if (days === Infinity) return data;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return data.filter((d) => new Date(d.date) >= cutoff);
  }, [data, activeRange]);

  // Format x-axis tick
  const formatXTick = useCallback(
    (value: string) => {
      const d = new Date(value);
      if (activeRange === '1D') {
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      }
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },
    [activeRange],
  );

  // Format y-axis tick
  const formatYTick = useCallback((value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value}`;
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {showTimeRangeSelector && (
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" className="w-10 h-7 rounded-md" />
            ))}
          </div>
        )}
        <Skeleton variant="rectangular" className="w-full h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Time range selector */}
      {showTimeRangeSelector && (
        <div className="flex items-center gap-1">
          {ranges.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => handleRangeChange(range)}
              className={clsx(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                activeRange === range
                  ? 'bg-[#C9A962] text-[#0A0A0A]'
                  : 'bg-[#262420] text-muted hover:text-foreground',
              )}
            >
              {range}
            </button>
          ))}
        </div>
      )}

      {/* Chart */}
      {filteredData.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-sm text-muted">
          No yield data available for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={filteredData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="yieldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#C9A962" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#C9A962" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#2A2A2A"
              vertical={false}
            />

            <XAxis
              dataKey="date"
              tickFormatter={formatXTick}
              tick={{ fill: '#A09D95', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
            />

            <YAxis
              tickFormatter={formatYTick}
              tick={{ fill: '#A09D95', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={56}
            />

            <Tooltip content={<ChartTooltip />} />

            <Area
              type="monotone"
              dataKey="cumulativeYield"
              stroke="#C9A962"
              strokeWidth={2}
              fill="url(#yieldGradient)"
              animationDuration={500}
              style={{ filter: 'drop-shadow(0 0 4px rgba(201, 169, 98, 0.3))' }}
            />

            <Area
              type="monotone"
              dataKey="dailyYield"
              stroke="transparent"
              fill="transparent"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
