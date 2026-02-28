import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExecutionStep {
  nodeId: string;
  nodeType?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped' | 'awaiting_approval' | 'paused';
  payoutId?: number;
  txHash?: string;
  amount?: number;
  currency?: string;
  fxQuoteId?: string;
  fxRate?: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  approvalCount?: number;
  approvalThreshold?: number;
}

export interface ExecutionLogEntry {
  timestamp: string;
  message: string;
  status: 'info' | 'success' | 'error' | 'pending';
  nodeId?: string;
}

export interface PipelineExecutionData {
  id: string;
  pipelineId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL_FAILURE' | 'FAILED' | 'AWAITING_APPROVAL' | 'PAUSED';
  steps: ExecutionStep[];
  newLogs: ExecutionLogEntry[];
  startedAt: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Polls a pipeline execution's progress.
 *
 * - Polls every 2 s while the execution is in progress.
 * - Stops polling when status reaches COMPLETED, PARTIAL_FAILURE, or FAILED.
 * - Returns raw execution data — the consuming component is responsible for
 *   syncing to the Zustand store via useEffect (not inside select).
 */
export function usePipelineExecution(executionId: string | null) {
  return useQuery<PipelineExecutionData>({
    queryKey: queryKeys.pipelines.execution(executionId!),
    queryFn: async (): Promise<PipelineExecutionData> => {
      const res = await fetch(`/api/pipelines/executions/${executionId}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API Error ${res.status}: ${text}`);
      }
      return res.json();
    },
    enabled: Boolean(executionId),
    refetchInterval: (query) => {
      const execution = query.state.data;
      if (
        !execution ||
        execution.status === 'COMPLETED' ||
        execution.status === 'PARTIAL_FAILURE' ||
        execution.status === 'FAILED'
      ) {
        return false;
      }
      // Slow polling for paused/awaiting states
      if (
        execution.status === 'AWAITING_APPROVAL' ||
        execution.status === 'PAUSED'
      ) {
        return 5_000;
      }
      return 2_000;
    },
  });
}
