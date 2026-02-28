'use client';

import { useEffect, useRef } from 'react';
import { usePipelineStore, type NodeStatus } from '@/stores/pipeline.store';
import { usePipelineExecution } from '@/hooks/usePipelineExecution';

/**
 * Poll-driven execution orchestrator.
 *
 * When the pipeline store has `isExecuting` and a `currentExecutionId`,
 * this component activates the `usePipelineExecution` polling hook.
 * It syncs step statuses and logs into the Zustand store via useEffect
 * (never inside React Query's select — that must stay pure).
 * On completion, it calls `finishExecution()`.
 *
 * This component renders nothing — it is purely a side-effect orchestrator.
 */
export function ExecutionAnimation() {
  const isExecuting = usePipelineStore((s) => s.isExecuting);
  const currentExecutionId = usePipelineStore((s) => s.currentExecutionId);
  const updateNodeStatus = usePipelineStore((s) => s.updateNodeStatus);
  const replaceExecutionLogs = usePipelineStore((s) => s.replaceExecutionLogs);
  const finishExecution = usePipelineStore((s) => s.finishExecution);

  const { data } = usePipelineExecution(
    isExecuting ? currentExecutionId : null,
  );

  // Track previous data to avoid redundant store writes
  const prevDataRef = useRef<typeof data>(undefined);

  // Sync execution data → Zustand store
  useEffect(() => {
    if (!data || data === prevDataRef.current) return;
    prevDataRef.current = data;

    // Sync node statuses for canvas animation
    for (const step of data.steps) {
      // Map 'skipped' to 'failed' for visual display
      const visualStatus: NodeStatus =
        step.status === 'skipped' ? 'failed' : step.status as NodeStatus;
      updateNodeStatus(step.nodeId, visualStatus);
    }

    // Replace logs with full server state (avoids duplicates on re-poll)
    if (data.newLogs.length > 0) {
      replaceExecutionLogs(
        data.newLogs.map((log) => ({
          timestamp: new Date(log.timestamp),
          message: log.message,
          status: log.status,
          nodeId: log.nodeId,
        })),
      );
    }
  }, [data, updateNodeStatus, replaceExecutionLogs]);

  // When execution reaches a terminal state, finish (deferred to ensure
  // the final store updates above are rendered first).
  // AWAITING_APPROVAL and PAUSED are NOT terminal — pipeline is still alive.
  useEffect(() => {
    if (!data) return;
    const status = data.status;
    if (
      status === 'COMPLETED' ||
      status === 'FAILED' ||
      status === 'PARTIAL_FAILURE'
    ) {
      // Defer so the final node statuses render before isExecuting goes false
      const timer = setTimeout(() => finishExecution(), 0);
      return () => clearTimeout(timer);
    }
  }, [data, finishExecution]);

  return null;
}
