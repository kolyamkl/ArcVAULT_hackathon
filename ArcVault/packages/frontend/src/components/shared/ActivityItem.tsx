'use client';

import { clsx } from 'clsx';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowRightLeft,
  ArrowDown,
  ArrowUpLeft,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActivityType = 'DEPOSIT' | 'SWEEP' | 'PAYOUT' | 'FX_SWAP' | 'REDEEM' | 'WITHDRAW';

interface ActivityItemProps {
  type: ActivityType | string;
  description: string;
  amount: number;
  currency: string;
  timestamp: string;
  txHash?: string;
  onClick?: () => void;
}

// ---------------------------------------------------------------------------
// Config map: icon + color per activity type — gold theme
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<
  string,
  { icon: React.ElementType; colorClass: string; bgClass: string }
> = {
  DEPOSIT: {
    icon: ArrowDownLeft,
    colorClass: 'text-[#7EC97A]',
    bgClass: 'bg-[#7EC97A15]',
  },
  SWEEP: {
    icon: ArrowRight,
    colorClass: 'text-[#D4A853]',
    bgClass: 'bg-[#D4A85315]',
  },
  PAYOUT: {
    icon: ArrowUpRight,
    colorClass: 'text-[#E0A84C]',
    bgClass: 'bg-[#E0A84C15]',
  },
  FX_SWAP: {
    icon: ArrowRightLeft,
    colorClass: 'text-[#B08D3E]',
    bgClass: 'bg-[#C4934015]',
  },
  REDEEM: {
    icon: ArrowDown,
    colorClass: 'text-[#C9A962]',
    bgClass: 'bg-[#C9A96215]',
  },
  WITHDRAW: {
    icon: ArrowUpLeft,
    colorClass: 'text-[#D46B6B]',
    bgClass: 'bg-[#D46B6B15]',
  },
};

const DEFAULT_CONFIG = {
  icon: ArrowRight,
  colorClass: 'text-muted',
  bgClass: 'bg-muted/10',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityItem({
  type,
  description,
  amount,
  currency,
  timestamp,
  onClick,
}: ActivityItemProps) {
  const config = TYPE_CONFIG[type] ?? DEFAULT_CONFIG;
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-4 w-full px-4 py-3 rounded-lg transition-colors text-left',
        'hover:bg-[#C9A96208] cursor-pointer',
        'border-b border-[#2A2A2A] last:border-b-0',
        'focus:outline-none focus:ring-2 focus:ring-gold/30'
      )}
      aria-label={`${type}: ${description}`}
    >
      {/* Type icon */}
      <div
        className={clsx(
          'flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0',
          config.bgClass
        )}
      >
        <Icon className={clsx('w-4 h-4', config.colorClass)} />
      </div>

      {/* Description */}
      <span className="flex-1 text-sm text-foreground truncate">{description}</span>

      {/* Amount */}
      <span className="text-sm font-medium text-foreground flex-shrink-0">
        {formatCurrency(amount, currency)}
      </span>

      {/* Relative time */}
      <span className="text-xs text-muted flex-shrink-0 w-20 text-right">
        {formatRelativeTime(timestamp)}
      </span>
    </button>
  );
}
