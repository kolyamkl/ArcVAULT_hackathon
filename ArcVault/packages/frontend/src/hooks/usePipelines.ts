import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { api } from '@/lib/api';
import type { Pipeline } from '@/types/api';

// Re-export for consumers
export type { Pipeline } from '@/types/api';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches the list of saved pipeline configurations.
 */
export function usePipelines() {
  return useQuery<Pipeline[]>({
    queryKey: queryKeys.pipelines.list,
    queryFn: () => api.pipelines.list(),
  });
}
