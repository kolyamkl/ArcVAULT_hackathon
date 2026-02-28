import { useQuery } from '@tanstack/react-query';
import { queryKeys, type VaultHistoryParams } from '@/lib/queryKeys';
import { api } from '@/lib/api';
import type { VaultHistory } from '@/types/api';

// Re-export for consumers
export type { VaultHistory, VaultHistoryEntry } from '@/types/api';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches paginated vault event history from the API.
 * Supports optional filtering by event type.
 */
export function useVaultHistory(params: VaultHistoryParams) {
  return useQuery<VaultHistory>({
    queryKey: queryKeys.vault.history(params),
    queryFn: () => {
      const searchParams: Record<string, string> = {
        page: String(params.page),
        limit: String(params.limit),
      };
      if (params.type) {
        searchParams.type = params.type;
      }
      return api.vault.getHistory(searchParams);
    },
  });
}
