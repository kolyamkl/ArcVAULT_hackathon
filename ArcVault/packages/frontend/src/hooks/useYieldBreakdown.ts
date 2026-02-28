import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VaultSnapshot {
  timestamp: string;
  totalValue: number;
  yieldAccrued: number;
  apy: number;
}

export interface YieldBreakdown {
  daily: number;
  weekly: number;
  monthly: number;
  projectedAnnual: number;
  currentAPY: number;
}

// ---------------------------------------------------------------------------
// Internal computation
// ---------------------------------------------------------------------------

function computeYieldBreakdown(snapshots: VaultSnapshot[]): YieldBreakdown {
  if (!snapshots || snapshots.length === 0) {
    return {
      daily: 0,
      weekly: 0,
      monthly: 0,
      projectedAnnual: 0,
      currentAPY: 0,
    };
  }

  // Snapshots are assumed to be sorted chronologically (oldest first)
  const latest = snapshots[snapshots.length - 1];
  const now = new Date(latest.timestamp).getTime();

  // Helper: find the snapshot closest to a given offset (in ms) from the latest
  const findSnapshotAt = (offsetMs: number): VaultSnapshot | undefined => {
    const target = now - offsetMs;
    let closest: VaultSnapshot | undefined;
    let closestDiff = Infinity;

    for (const snap of snapshots) {
      const diff = Math.abs(new Date(snap.timestamp).getTime() - target);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = snap;
      }
    }
    return closest;
  };

  const MS_DAY = 86_400_000;
  const dayAgo = findSnapshotAt(MS_DAY);
  const weekAgo = findSnapshotAt(7 * MS_DAY);
  const monthAgo = findSnapshotAt(30 * MS_DAY);

  const daily = dayAgo ? latest.yieldAccrued - dayAgo.yieldAccrued : 0;
  const weekly = weekAgo ? latest.yieldAccrued - weekAgo.yieldAccrued : 0;
  const monthly = monthAgo ? latest.yieldAccrued - monthAgo.yieldAccrued : 0;

  // Project annual yield from daily rate
  const projectedAnnual = daily * 365;

  return {
    daily,
    weekly,
    monthly,
    projectedAnnual,
    currentAPY: latest.apy,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches vault snapshots and computes yield breakdown metrics.
 * Uses a longer staleTime (60 s) because yield data does not change rapidly.
 */
export function useYieldBreakdown() {
  return useQuery({
    queryKey: queryKeys.vault.yieldBreakdown,
    queryFn: async (): Promise<YieldBreakdown> => {
      const res = await fetch('/api/vault/snapshots');
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API Error ${res.status}: ${text}`);
      }
      const snapshots: VaultSnapshot[] = await res.json();
      return computeYieldBreakdown(snapshots);
    },
    staleTime: 60_000,
  });
}
