'use client';

import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Activity } from 'lucide-react';
import { Skeleton } from '@/components/shared/Skeleton';
import { ActivityItem } from '@/components/shared/ActivityItem';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityEntry {
  id: string;
  type: 'DEPOSIT' | 'SWEEP' | 'PAYOUT' | 'FX_SWAP' | 'REDEEM' | 'WITHDRAW';
  description: string;
  amount: number;
  currency: string;
  timestamp: string;
  txHash?: string;
}

interface ActivityFeedProps {
  activities: ActivityEntry[];
  loading?: boolean;
  /** Maximum number of items to display. Defaults to 10. */
  maxItems?: number;
}

// ---------------------------------------------------------------------------
// Navigation map
// ---------------------------------------------------------------------------

const TYPE_ROUTE: Record<string, string> = {
  DEPOSIT: '/vault',
  SWEEP: '/vault',
  REDEEM: '/vault',
  WITHDRAW: '/vault',
  PAYOUT: '/vault',
  FX_SWAP: '/fx',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityFeed({
  activities,
  loading = false,
  maxItems = 10,
}: ActivityFeedProps) {
  const router = useRouter();

  const visibleActivities = activities.slice(0, maxItems);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-2xl font-medium text-foreground">Recent Activity</h3>
        {activities.length > maxItems && (
          <button
            type="button"
            onClick={() => router.push('/vault')}
            className="text-sm text-[#C9A962] hover:text-[#D4A853] transition-colors"
          >
            View All
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton variant="circular" width={36} height={36} />
              <Skeleton variant="text" className="flex-1 h-4" />
              <Skeleton variant="text" className="w-20 h-4" />
              <Skeleton variant="text" className="w-16 h-3" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && visibleActivities.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted">
          <Activity className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">No recent activity</p>
        </div>
      )}

      {/* Activity list */}
      {!loading && visibleActivities.length > 0 && (
        <div className={clsx('divide-y-0')}>
          {visibleActivities.map((activity) => (
            <ActivityItem
              key={activity.id}
              type={activity.type}
              description={activity.description}
              amount={activity.amount}
              currency={activity.currency}
              timestamp={activity.timestamp}
              txHash={activity.txHash}
              onClick={() => {
                const route = TYPE_ROUTE[activity.type] ?? '/vault';
                router.push(route);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
