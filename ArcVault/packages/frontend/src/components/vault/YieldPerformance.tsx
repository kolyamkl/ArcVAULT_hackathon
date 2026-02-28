'use client';

import { useId, useState } from 'react';
import { clsx } from 'clsx';

const PERIODS = ['Daily', 'Weekly', 'Monthly'] as const;
type Period = (typeof PERIODS)[number];

// Static sample metrics
const METRICS = [
  { label: 'Total Yield', value: '$12,847' },
  { label: 'Avg Daily', value: '$42.82' },
  { label: 'Best Day', value: '$128.50' },
  { label: 'Current Streak', value: '14 days' },
];

// SVG chart data (sample yield curve)
const CHART_POINTS = [10, 18, 24, 32, 36, 42, 52];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

export function YieldPerformance() {
  const uid = useId();
  const gradId = `yieldGrad-${uid}`;
  const [period, setPeriod] = useState<Period>('Monthly');

  const w = 560;
  const h = 180;
  const padX = 0;
  const padY = 10;
  const max = Math.max(...CHART_POINTS);
  const min = Math.min(...CHART_POINTS);
  const range = max - min || 1;

  const coords = CHART_POINTS.map((p, i) => ({
    x: padX + (i / (CHART_POINTS.length - 1)) * (w - padX * 2),
    y: padY + (1 - (p - min) / range) * (h - padY * 2),
  }));

  const linePath = coords.map((c, i) => (i === 0 ? `M${c.x},${c.y}` : `L${c.x},${c.y}`)).join(' ');
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;

  // Grid lines
  const gridLines = [0.25, 0.5, 0.75].map((p) => padY + (1 - p) * (h - padY * 2));

  return (
    <div className="bg-[#16161480] border border-[#C9A96212] rounded-xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-semibold text-foreground">Yield Performance</h3>
        <div className="flex gap-1 bg-[#0A0A0A60] rounded-lg p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={clsx(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                period === p
                  ? 'bg-[#C9A96220] text-[#C9A962]'
                  : 'text-muted hover:text-foreground',
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-4 gap-4">
        {METRICS.map((m) => (
          <div key={m.label}>
            <p className="text-[11px] text-muted">{m.label}</p>
            <p className="font-display text-[22px] font-semibold text-foreground">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div>
        <svg width="100%" viewBox={`0 0 ${w} ${h + 24}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C9A962" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#C9A962" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Grid lines */}
          {gridLines.map((y, i) => (
            <line key={i} x1="0" y1={y} x2={w} y2={y} stroke="#2A2A2A" strokeWidth="1" />
          ))}
          <path d={areaPath} fill={`url(#${gradId})`} />
          <path d={linePath} fill="none" stroke="#C9A962" strokeWidth="2" />
          {/* X-axis labels */}
          {MONTHS.map((month, i) => (
            <text
              key={month}
              x={(i / (MONTHS.length - 1)) * w}
              y={h + 18}
              textAnchor="middle"
              style={{ fontSize: 10 }}
              className="fill-muted"
            >
              {month}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
