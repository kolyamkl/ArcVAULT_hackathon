'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from 'reactflow';
import { usePipelineStore } from '@/stores/pipeline.store';
import { GitBranch, Check } from 'lucide-react';
import { NodeDeleteButton } from './NodeDeleteButton';
import { statusClasses } from './shared';
import { FieldInput, FieldSelect } from './FieldInput';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConditionData {
  field: string;
  operator: string;
  value: string;
  expanded: boolean;
}

const FIELD_OPTIONS = [
  { label: 'Amount', value: 'amount' },
  { label: 'Currency', value: 'currency' },
  { label: 'Recipient Count', value: 'recipientCount' },
];

const OPERATOR_OPTIONS = [
  { label: '>', value: '>' },
  { label: '<', value: '<' },
  { label: '>=', value: '>=' },
  { label: '<=', value: '<=' },
  { label: '==', value: '==' },
  { label: '!=', value: '!=' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ConditionNodeRaw({ id, data }: NodeProps<ConditionData>) {
  const { setNodes } = useReactFlow();
  const isExecuting = usePipelineStore((s) => s.isExecuting);
  const executionProgress = usePipelineStore((s) => s.executionProgress);
  const nodeStatus = executionProgress.get(id);

  const { field = 'amount', operator = '>', value = '0', expanded } = data;

  const borderClass =
    isExecuting && nodeStatus
      ? statusClasses[nodeStatus]
      : 'border-l-[#22D3EE]';

  const expression = `${field} ${operator} ${value}`;

  const updateField = useCallback(
    (fieldName: string, fieldValue: string | number) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, [fieldName]: fieldValue } } : n,
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
      className={`group relative rounded-lg border border-[#383430] border-l-4 ${borderClass} bg-[#2D2B28] min-w-[180px] shadow-md transition-all duration-300`}
    >
      <NodeDeleteButton nodeId={id} />
      {/* Compact view */}
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#22D3EE]/15 flex items-center justify-center flex-shrink-0">
            <GitBranch className="w-3 h-3 text-[#22D3EE]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              Condition
            </p>
          </div>
        </div>

        <div className="mt-2">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#22D3EE]/20 text-[#22D3EE] font-mono"
          >
            {expression}
          </span>
        </div>
      </div>

      {/* Expanded form */}
      {expanded && !isExecuting && (
        <div className="border-t border-[#383430] p-3 space-y-2.5 animate-fade-in">
          <FieldSelect
            label="Field"
            value={field}
            options={FIELD_OPTIONS}
            onChange={(v) => updateField('field', v)}
          />
          <FieldSelect
            label="Operator"
            value={operator}
            options={OPERATOR_OPTIONS}
            onChange={(v) => updateField('operator', v)}
          />
          <FieldInput
            label="Value"
            value={value}
            onChange={(v) => updateField('value', v)}
            placeholder="5000"
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

      {/* Handles: target left, two source handles right (true top, false bottom) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-5 !h-5 !bg-[#22D3EE] !border-2 !border-[#2D2B28] hover:!shadow-[0_0_8px_#22D3EE]"
      />

      {/* True branch handle with label */}
      <div className="absolute right-0 flex items-center gap-1" style={{ top: '30%', transform: 'translateY(-50%) translateX(50%)' }}>
        <span className="text-[9px] font-semibold text-[#7EC97A] select-none pointer-events-none mr-3">T</span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className="!w-5 !h-5 !bg-[#7EC97A] !border-2 !border-[#2D2B28] hover:!shadow-[0_0_8px_#7EC97A]"
        style={{ top: '30%' }}
      />

      {/* False branch handle with label */}
      <div className="absolute right-0 flex items-center gap-1" style={{ top: '70%', transform: 'translateY(-50%) translateX(50%)' }}>
        <span className="text-[9px] font-semibold text-[#D46B6B] select-none pointer-events-none mr-3">F</span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        className="!w-5 !h-5 !bg-[#D46B6B] !border-2 !border-[#2D2B28] hover:!shadow-[0_0_8px_#D46B6B]"
        style={{ top: '70%' }}
      />
    </div>
  );
}

export const ConditionNode = memo(ConditionNodeRaw);
