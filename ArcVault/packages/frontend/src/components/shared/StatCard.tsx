'use client';

import { clsx } from 'clsx';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from './Card';

interface StatCardProps {
  label: string;
  value: string | number;
  /** Percentage change. Positive = green arrow up, negative = red arrow down. */
  change?: number;
  /** Label for the change comparison (default: "vs last month") */
  changeLabel?: string;
  icon?: React.ReactNode;
  /** Icon badge element displayed in a gold circle */
  iconBadge?: React.ReactNode;
  /** Static subtitle text below value */
  subtitle?: string;
  /** Optional className override for the value text */
  valueClassName?: string;
  /** Optional mini chart rendered at the bottom */
  miniChart?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function StatCard({
  label,
  value,
  change,
  changeLabel,
  icon,
  iconBadge,
  subtitle,
  valueClassName,
  miniChart,
  className,
  children,
}: StatCardProps) {
  return (
    <Card className={clsx('relative', className)}>
      <div className="space-y-3.5">
        {/* Top row: label + icon badge */}
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-normal text-muted">
            {label}
          </p>
          {iconBadge && (
            <div className="w-9 h-9 rounded-full bg-[#C9A96240] flex items-center justify-center text-[#C9A962]">
              {iconBadge}
            </div>
          )}
          {/* Legacy icon slot */}
          {icon && !iconBadge && (
            <div className="text-muted">{icon}</div>
          )}
        </div>
        <p className={clsx('font-display text-[32px] font-normal text-foreground', valueClassName)}>
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-muted">{subtitle}</p>
        )}
        {change !== undefined && (
          <div className="flex items-center gap-1.5 text-[12px]">
            {change >= 0 ? (
              <TrendingUp className="h-3 w-3 text-[#4ADE80]" />
            ) : (
              <TrendingDown className="h-3 w-3 text-error" />
            )}
            <span className={clsx('font-medium', change >= 0 ? 'text-[#4ADE80]' : 'text-error')}>
              {change >= 0 ? '+' : ''}
              {change.toFixed(1)}%
            </span>
            <span className="text-muted">{changeLabel ?? 'vs last month'}</span>
          </div>
        )}
        {miniChart}
        {children}
      </div>
    </Card>
  );
}
