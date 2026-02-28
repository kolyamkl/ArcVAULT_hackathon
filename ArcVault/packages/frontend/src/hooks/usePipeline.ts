import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { api } from '@/lib/api';
import type { Pipeline } from '@/types/api';

// Re-export for consumers
export type { Pipeline, PipelineStep, PipelineConnection } from '@/types/api';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches a single pipeline definition by id.
 * Enabled only when `id` is provided (non-null).
 */
export function usePipeline(id: string | null) {
  return useQuery<Pipeline>({
    queryKey: queryKeys.pipelines.detail(id!),
    queryFn: () => api.pipelines.get(id!),
    enabled: Boolean(id),
  });
}
