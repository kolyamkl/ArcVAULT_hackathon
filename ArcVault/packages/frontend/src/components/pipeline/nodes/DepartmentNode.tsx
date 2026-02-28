'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from 'reactflow';
import { usePipelineStore, type NodeStatus } from '@/stores/pipeline.store';
import { formatCurrency } from '@/lib/utils';
import { Building2, Check, AlertTriangle } from 'lucide-react';
import { NodeDeleteButton } from './NodeDeleteButton';

// ---------------------------------------------------------------------------
// Status-driven style map
// ---------------------------------------------------------------------------

const statusClasses: Record<NodeStatus, string> = {
  pending: 'border-[#A09D95] opacity-60',
  processing: 'border-[#E0A84C] animate-pulse shadow-[#E0A84C]/20 shadow-lg',
  completed: 'border-[#7EC97A] shadow-[#7EC97A]/20 shadow-lg',
  failed: 'border-[#D46B6B] shadow-[#D46B6B]/20 shadow-lg',
  awaiting_approval: 'border-[#A78BFA] animate-pulse shadow-[#A78BFA]/20 shadow-lg',
  paused: 'border-[#60A5FA] shadow-[#60A5FA]/20 shadow-lg',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DepartmentData {
  name: string;
  budgetCap: number;
  totalCost: number;
  expanded: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Department node with editable name and budget cap.
 *
 * Shows a utilization bar (totalCost / budgetCap) with color thresholds:
 * - < 80% : green
 * - 80-100%: amber
 * - > 100% : red (over budget)
 *
 * Click to expand inline form for editing name and budget cap.
 */
function DepartmentNodeRaw({ id, data }: NodeProps<DepartmentData>) {
  const { setNodes } = useReactFlow();
  const isExecuting = usePipelineStore((s) => s.isExecuting);
  const executionProgress = usePipelineStore((s) => s.executionProgress);
  const nodeStatus = executionProgress.get(id);

  const { name, budgetCap, totalCost, expanded } = data;

  const utilization = budgetCap > 0 ? (totalCost / budgetCap) * 100 : 0;
  const utilizationColor =
    utilization > 100
      ? 'bg-[#D46B6B]'
      : utilization >= 80
        ? 'bg-[#E0A84C]'
        : 'bg-[#7EC97A]';
  const isOverBudget = budgetCap > 0 && totalCost > budgetCap;

  const borderClass =
    isExecuting && nodeStatus
      ? statusClasses[nodeStatus]
      : 'border-[#C9A962]';

  const updateField = useCallback(
    (field: string, value: string | number) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n,
        ),
      );
    },
    [id, setNodes],
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
      className={`group relative rounded-xl border-2 ${borderClass} bg-[#2D2B28] min-w-[200px] shadow-md transition-all duration-300`}
    >
      <NodeDeleteButton nodeId={id} />
      {/* Compact header */}
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#C9A96215] flex items-center justify-center flex-shrink-0">
            <Building2 className="w-3.5 h-3.5 text-[#C9A962]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {name || 'New Department'}
            </p>
            {budgetCap > 0 && (
              <p className="text-xs text-[#A09D95]">
                {formatCurrency(totalCost)} / {formatCurrency(budgetCap)}
              </p>
            )}
          </div>
          {isOverBudget && (
            <AlertTriangle className="w-4 h-4 text-[#D46B6B] flex-shrink-0" />
          )}
        </div>

        {/* Utilization bar */}
        {budgetCap > 0 && (
          <div className="mt-2">
            <div className="h-1.5 w-full rounded-full bg-[#383430] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${utilizationColor}`}
                style={{ width: `${Math.min(utilization, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-[#A09D95] mt-0.5 text-right">
              {utilization.toFixed(0)}%
            </p>
          </div>
        )}
      </div>

      {/* Expanded form */}
      {expanded && !isExecuting && (
        <div className="border-t border-[#383430] p-3 space-y-3 animate-fade-in">
          <div>
            <label className="text-xs font-medium text-[#A09D95] block mb-1">
              Department Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => updateField('name', e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-lg border border-[#383430] bg-[#232120] px-2.5 py-1.5 text-sm text-foreground
                         focus:border-[#C9A962] focus:outline-none transition-colors"
              placeholder="Engineering"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[#A09D95] block mb-1">
              Budget Cap (USDC)
            </label>
            <input
              type="number"
              value={budgetCap || ''}
              onChange={(e) => updateField('budgetCap', parseFloat(e.target.value) || 0)}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-lg border border-[#383430] bg-[#232120] px-2.5 py-1.5 text-sm text-foreground
                         focus:border-[#C9A962] focus:outline-none transition-colors"
              placeholder="100000"
              min={0}
            />
          </div>

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
        className="!w-5 !h-5 !bg-[#C9A962] !border-2 !border-[#2D2B28] hover:!shadow-[0_0_8px_#C9A962]"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-5 !h-5 !bg-[#C9A962] !border-2 !border-[#2D2B28] hover:!shadow-[0_0_8px_#C9A962]"
      />
    </div>
  );
}

export const DepartmentNode = memo(DepartmentNodeRaw);
