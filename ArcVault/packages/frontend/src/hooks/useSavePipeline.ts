import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { usePipelineStore } from '@/stores/pipeline.store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SavePipelineParams {
  id?: string;
  name: string;
  nodes: Array<{ id: string; type?: string; position: { x: number; y: number }; data: Record<string, unknown>; [key: string]: unknown }>;
  edges: Array<{ id: string; source: string; target: string; type?: string; [key: string]: unknown }>;
  metadata: Record<string, unknown>;
  ownerWallet: string;
}

interface SavePipelineResponse {
  pipeline: {
    id: string;
    name: string;
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Save (create or update) a pipeline via the API.
 *
 * - If `id` is provided, updates the existing pipeline (PUT).
 * - Otherwise, creates a new pipeline (POST).
 *
 * On success, invalidates the pipeline list and updates the pipeline store
 * with the returned id/name, marking it as clean.
 */
export function useSavePipeline() {
  const queryClient = useQueryClient();
  const pipelineStore = usePipelineStore();

  return useMutation({
    mutationFn: async ({
      id,
      name,
      nodes,
      edges,
      metadata,
      ownerWallet,
    }: SavePipelineParams): Promise<SavePipelineResponse> => {
      const body = JSON.stringify({ name, nodes, edges, metadata, ownerWallet });
      const headers = { 'Content-Type': 'application/json' };

      if (id) {
        const res = await fetch(`/api/pipelines/${id}`, {
          method: 'PUT',
          headers,
          body,
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`API Error ${res.status}: ${text}`);
        }
        return res.json();
      }

      const res = await fetch('/api/pipelines', {
        method: 'POST',
        headers,
        body,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API Error ${res.status}: ${text}`);
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.list });
      pipelineStore.setCurrentPipeline(data.pipeline.id, data.pipeline.name);
      pipelineStore.markClean();
      pipelineStore.triggerExecutionModal();
    },
  });
}
