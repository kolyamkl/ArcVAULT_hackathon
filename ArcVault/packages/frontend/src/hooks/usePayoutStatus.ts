import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { api } from '@/lib/api';
import type { Payout } from '@/types/api';

// Re-export for consumers
export type { Payout } from '@/types/api';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Polls a single payout's status.
 *
 * - Polls every 5 s while status is PENDING or PROCESSING.
 * - Stops polling once status reaches COMPLETED or FAILED.
 */
export function usePayoutStatus(id: string) {
  return useQuery<Payout>({
    queryKey: queryKeys.payouts.detail(id),
    queryFn: () => api.payouts.get(id),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'COMPLETED' || status === 'FAILED') return false;
      return 5_000;
    },
  });
}
