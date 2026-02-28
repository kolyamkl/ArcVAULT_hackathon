import { useQuery } from '@tanstack/react-query';
import { queryKeys, type PipelineHistoryParams } from '@/lib/queryKeys';
import { api } from '@/lib/api';
import type { PipelineHistory } from '@/types/api';

// Re-export for consumers
export type { PipelineHistory, PipelineHistoryEntry } from '@/types/api';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches paginated pipeline execution history from the API.
 * Only enabled when pipelineId is non-null.
 */
export function usePipelineHistory(
  pipelineId: string | null,
  params: PipelineHistoryParams,
) {
  return useQuery<PipelineHistory>({
    queryKey: queryKeys.pipelines.history(pipelineId ?? '', params),
    queryFn: () =>
      api.pipelines.getHistory(pipelineId!, {
        page: String(params.page),
        limit: String(params.limit),
      }),
    enabled: pipelineId !== null,
  });
}
