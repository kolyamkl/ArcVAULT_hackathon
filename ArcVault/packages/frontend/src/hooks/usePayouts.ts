import { useQuery } from '@tanstack/react-query';
import { queryKeys, type PayoutListParams } from '@/lib/queryKeys';
import { api } from '@/lib/api';
import type { PayoutList } from '@/types/api';

// Re-export for consumers
export type { Payout, PayoutList } from '@/types/api';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches a paginated, optionally filtered list of payouts.
 */
export function usePayouts(params: PayoutListParams) {
  return useQuery<PayoutList>({
    queryKey: queryKeys.payouts.list(params),
    queryFn: () => {
      const searchParams: Record<string, string> = {
        page: String(params.page),
        limit: String(params.limit),
      };
      if (params.status) searchParams.status = params.status;
      if (params.sort) searchParams.sort = params.sort;
      if (params.order) searchParams.order = params.order;

      return api.payouts.list(searchParams);
    },
  });
}
