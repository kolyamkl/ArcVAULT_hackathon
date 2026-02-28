import { useQuery } from '@tanstack/react-query';
import { queryKeys, type FXHistoryParams } from '@/lib/queryKeys';
import { api } from '@/lib/api';
import type { FXHistory } from '@/types/api';

// Re-export for consumers
export type { FXHistory, FXHistoryEntry } from '@/types/api';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches paginated FX conversion history from the API.
 */
export function useFXHistory(params: FXHistoryParams) {
  return useQuery<FXHistory>({
    queryKey: queryKeys.fx.history(params),
    queryFn: () =>
      api.fx.getHistory({
        page: String(params.page),
        limit: String(params.limit),
      }),
  });
}
