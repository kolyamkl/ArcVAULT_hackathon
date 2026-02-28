'use client';

import { useId } from 'react';

/**
 * Small decorative chart components for StatCards.
 */

// ---------------------------------------------------------------------------
// SparklineChart — gold line with gradient fill area
// ---------------------------------------------------------------------------

export function SparklineChart() {
  const uid = useId();
  const gradId = `sparkGrad-${uid}`;
  const points = [20, 30, 25, 40, 35, 50, 45, 60, 55, 70];
  const width = 200;
  const height = 48;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;

  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * width,
    y: height - ((p - min) / range) * (height - 8) - 4,
  }));

  const linePath = coords.map((c, i) => (i === 0 ? `M${c.x},${c.y}` : `L${c.x},${c.y}`)).join(' ');
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const last = coords[coords.length - 1];

  return (
    <div className="pt-1">
      <svg width="100%" viewBox={`0 0 ${width} ${height + 4}`} preserveAspectRatio="none" className="overflow-visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C9A962" stopOpacity="0.19" />
            <stop offset="100%" stopColor="#C9A962" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke="#C9A962" strokeWidth="2" />
        <circle cx={last.x} cy={last.y} r="4" fill="#C9A962" />
        <circle cx={last.x} cy={last.y} r="6" fill="#C9A962" opacity="0.3" />
      </svg>
      <p className="text-[9px] text-muted mt-1">30-day trend</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MiniBarChart — ascending bars with opacity gradient
// ---------------------------------------------------------------------------

export function MiniBarChart() {
  const bars = [24, 32, 28, 40, 36, 48];
  const maxH = Math.max(...bars);

  return (
    <div className="flex items-end gap-1 h-10 pt-1">
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: `${(h / maxH) * 100}%`,
            backgroundColor: '#C9A962',
            opacity: 0.25 + (i / (bars.length - 1)) * 0.75,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GaugeChart — semi-circular arc
// ---------------------------------------------------------------------------

export function GaugeChart() {
  const percent = 0.72;
  const r = 28;
  const cx = 36;
  const cy = 36;
  const startAngle = Math.PI;
  const endAngle = 0;
  const totalAngle = startAngle - endAngle;
  const filledAngle = startAngle - totalAngle * percent;

  const trackStart = { x: cx + r * Math.cos(startAngle), y: cy - r * Math.sin(startAngle) };
  const trackEnd = { x: cx + r * Math.cos(endAngle), y: cy - r * Math.sin(endAngle) };
  const filledEnd = { x: cx + r * Math.cos(filledAngle), y: cy - r * Math.sin(filledAngle) };

  return (
    <div className="flex justify-center pt-1">
      <svg width="72" height="40" viewBox="0 0 72 40">
        <path
          d={`M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 0 1 ${trackEnd.x} ${trackEnd.y}`}
          fill="none"
          stroke="#2A2A2A"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d={`M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 0 1 ${filledEnd.x} ${filledEnd.y}`}
          fill="none"
          stroke="#C9A962"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProgressBar — simple horizontal fill bar
// ---------------------------------------------------------------------------

export function ProgressBar({ percent = 0.65 }: { percent?: number }) {
  return (
    <div className="pt-1">
      <div className="h-1.5 w-full rounded-full bg-[#2A2A2A]">
        <div
          className="h-full rounded-full bg-[var(--color-success)]"
          style={{ width: `${Math.min(percent * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PendingDots — 3 animated dots with decreasing opacity
// ---------------------------------------------------------------------------

export function PendingDots() {
  return (
    <div className="flex items-center gap-2 pt-1">
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full bg-[#60A5FA]" />
        <div className="w-2 h-2 rounded-full bg-[#60A5FA80]" />
        <div className="w-2 h-2 rounded-full bg-[#60A5FA40]" />
      </div>
      <span className="text-[11px] text-[#60A5FA]">Next in ~2h</span>
    </div>
  );
}
