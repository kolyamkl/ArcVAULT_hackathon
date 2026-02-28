'use client';

import { clsx } from 'clsx';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from './Card';

interface StatCardProps {
  label: string;
  value: string | number;
  /** Percentage change. Positive = green arrow up, negative = red arrow down. */
  change?: number;
  icon?: React.ReactNode;
  /** Icon badge element displayed in a gold circle top-right */
  iconBadge?: React.ReactNode;
  /** Static subtitle text below value */
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
}

export function StatCard({
  label,
  value,
  change,
  icon,
  iconBadge,
  subtitle,
  className,
  children,
}: StatCardProps) {
  return (
    <Card className={clsx('relative', className)}>
      {/* Icon badge - gold circle top-right */}
      {iconBadge && (
        <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-[#C9A96240] flex items-center justify-center text-[#C9A962]">
          {iconBadge}
        </div>
      )}
      {/* Legacy icon slot */}
      {icon && !iconBadge && (
        <div className="absolute top-4 right-4 text-muted">{icon}</div>
      )}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted uppercase tracking-[1px]">
          {label}
        </p>
        <p className="font-display text-4xl font-medium tracking-tight text-foreground">
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-muted">{subtitle}</p>
        )}
        {change !== undefined && (
          <div
            className={clsx(
              'inline-flex items-center gap-1 text-sm font-medium',
              change >= 0 ? 'text-success' : 'text-error'
            )}
          >
            {change >= 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>
              {change >= 0 ? '+' : ''}
              {change.toFixed(1)}%
            </span>
            <span className="text-muted text-xs ml-1">vs last month</span>
          </div>
        )}
        {children}
      </div>
    </Card>
  );
}
