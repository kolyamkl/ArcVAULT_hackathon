import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NodeStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'awaiting_approval' | 'paused';

export interface ExecutionLogEntry {
  timestamp: Date;
  message: string;
  status: 'info' | 'success' | 'error' | 'pending';
  nodeId?: string;
}

interface PipelineState {
  // Current pipeline being edited
  currentPipelineId: string | null;
  currentPipelineName: string;
  isDirty: boolean;

  // Execution state
  isExecuting: boolean;
  currentExecutionId: string | null;
  executionProgress: Map<string, NodeStatus>;
  executionLog: ExecutionLogEntry[];

  // Execution modal trigger (auto-open after save)
  pendingExecutionModal: boolean;

  // Actions -- Pipeline management
  setCurrentPipeline: (id: string | null, name: string) => void;
  markDirty: () => void;
  markClean: () => void;
  resetPipeline: () => void;
  triggerExecutionModal: () => void;
  clearExecutionModalTrigger: () => void;

  // Actions -- Execution
  startExecution: (executionId?: string) => void;
  setExecutionId: (executionId: string | null) => void;
  updateNodeStatus: (nodeId: string, status: NodeStatus) => void;
  addLogEntry: (entry: ExecutionLogEntry) => void;
  replaceExecutionLogs: (logs: ExecutionLogEntry[]) => void;
  finishExecution: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Pipeline editor and execution state store.
 *
 * Manages:
 * - Current pipeline identity and dirty-tracking for the editor.
 * - Execution progress (Map<nodeId, NodeStatus>) for real-time canvas animation.
 * - Execution log entries streamed from the polling hook.
 *
 * This store is intentionally separate from React Flow's useNodesState/useEdgesState
 * to avoid coupling visual canvas state with execution logic.
 */
export const usePipelineStore = create<PipelineState>((set) => ({
  // Initial state
  currentPipelineId: null,
  currentPipelineName: 'Untitled Pipeline',
  isDirty: false,
  isExecuting: false,
  currentExecutionId: null,
  executionProgress: new Map(),
  executionLog: [],
  pendingExecutionModal: false,

  // Pipeline management
  setCurrentPipeline: (id, name) =>
    set({ currentPipelineId: id, currentPipelineName: name, isDirty: false }),

  markDirty: () => set({ isDirty: true }),

  markClean: () => set({ isDirty: false }),

  triggerExecutionModal: () => set({ pendingExecutionModal: true }),

  clearExecutionModalTrigger: () => set({ pendingExecutionModal: false }),

  resetPipeline: () =>
    set({
      currentPipelineId: null,
      currentPipelineName: 'Untitled Pipeline',
      isDirty: false,
      isExecuting: false,
      currentExecutionId: null,
      executionProgress: new Map(),
      executionLog: [],
      pendingExecutionModal: false,
    }),

  // Execution
  startExecution: (executionId) =>
    set({
      isExecuting: true,
      currentExecutionId: executionId ?? null,
      executionProgress: new Map(),
      executionLog: [],
    }),

  setExecutionId: (executionId) =>
    set({ currentExecutionId: executionId }),

  updateNodeStatus: (nodeId, status) =>
    set((state) => {
      const newProgress = new Map(state.executionProgress);
      newProgress.set(nodeId, status);
      return { executionProgress: newProgress };
    }),

  addLogEntry: (entry) =>
    set((state) => ({
      executionLog: [...state.executionLog, entry],
    })),

  replaceExecutionLogs: (logs) =>
    set({ executionLog: logs }),

  finishExecution: () => set({ isExecuting: false, currentExecutionId: null }),
}));
