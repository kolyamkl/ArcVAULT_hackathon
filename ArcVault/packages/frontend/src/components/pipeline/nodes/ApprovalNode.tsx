'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from 'reactflow';
import { usePipelineStore } from '@/stores/pipeline.store';
import { ShieldCheck, Check, Plus, X } from 'lucide-react';
import { NodeDeleteButton } from './NodeDeleteButton';
import { statusClasses } from './shared';
import { FieldInput } from './FieldInput';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalData {
  approvers: string[];
  threshold: number;
  expanded: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ApprovalNodeRaw({ id, data }: NodeProps<ApprovalData>) {
  const { setNodes } = useReactFlow();
  const isExecuting = usePipelineStore((s) => s.isExecuting);
  const executionProgress = usePipelineStore((s) => s.executionProgress);
  const nodeStatus = executionProgress.get(id);

  const { approvers = [], threshold = 1, expanded } = data;

  const borderClass =
    isExecuting && nodeStatus
      ? statusClasses[nodeStatus]
      : 'border-l-[#A78BFA]';

  const updateField = useCallback(
    (field: string, value: unknown) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n,
        ),
      );
    },
    [id, setNodes],
  );

  const addApprover = useCallback(() => {
    updateField('approvers', [...approvers, '']);
  }, [approvers, updateField]);

  const removeApprover = useCallback(
    (index: number) => {
      updateField('approvers', approvers.filter((_, i) => i !== index));
    },
    [approvers, updateField],
  );

  const updateApprover = useCallback(
    (index: number, value: string) => {
      const updated = [...approvers];
      updated[index] = value;
      updateField('approvers', updated);
    },
    [approvers, updateField],
  );

  const handleDone = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, expanded: false } } : n,
        ),
      );
    },
    [id, setNodes],
  );

  return (
    <div
      className={`group relative rounded-lg border border-[#383430] border-l-4 ${borderClass} bg-[#2D2B28] min-w-[180px] shadow-md transition-all duration-300`}
    >
      <NodeDeleteButton nodeId={id} />
      {/* Compact view */}
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#A78BFA]/15 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-3 h-3 text-[#A78BFA]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              Approval Gate
            </p>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#A78BFA]/20 text-[#A78BFA]"
          >
            {threshold} of {approvers.length || 1} required
          </span>
          {nodeStatus === 'awaiting_approval' && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#A78BFA]/10 text-[#A78BFA] animate-pulse">
              Awaiting...
            </span>
          )}
        </div>
      </div>

      {/* Expanded form */}
      {expanded && !isExecuting && (
        <div className="border-t border-[#383430] p-3 space-y-2.5 animate-fade-in">
          <div>
            <label className="text-[10px] font-medium text-[#A09D95] block mb-1">
              Approvers
            </label>
            <div className="space-y-1.5">
              {approvers.map((addr, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={addr}
                    onChange={(e) => updateApprover(i, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 rounded border border-[#383430] bg-[#232120] px-2 py-1 text-xs text-foreground
                               focus:border-[#C9A962] focus:outline-none transition-colors font-mono"
                    placeholder="0x..."
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); removeApprover(i); }}
                    className="p-0.5 rounded text-[#A09D95] hover:text-[#D46B6B] transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); addApprover(); }}
              className="flex items-center gap-1 mt-1.5 text-[10px] font-medium text-[#A78BFA] hover:text-[#C4B5FD] transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add approver
            </button>
          </div>
          <FieldInput
            label="Threshold"
            value={threshold}
            onChange={(v) => updateField('threshold', Math.max(1, parseInt(v) || 1))}
            placeholder="1"
            type="number"
          />
          <button
            onClick={handleDone}
            className="flex items-center gap-1.5 text-xs font-medium text-[#C9A962] hover:text-[#D4A853] transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Done
          </button>
        </div>
      )}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-5 !h-5 !bg-[#A78BFA] !border-2 !border-[#2D2B28] hover:!shadow-[0_0_8px_#A78BFA]"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-5 !h-5 !bg-[#A78BFA] !border-2 !border-[#2D2B28] hover:!shadow-[0_0_8px_#A78BFA]"
      />
    </div>
  );
}

export const ApprovalNode = memo(ApprovalNodeRaw);
