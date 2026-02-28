'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from 'reactflow';
import { usePipelineStore } from '@/stores/pipeline.store';
import { Clock, Check } from 'lucide-react';
import { NodeDeleteButton } from './NodeDeleteButton';
import { statusClasses } from './shared';
import { FieldInput, FieldSelect } from './FieldInput';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DelayData {
  delayType: 'duration' | 'until';
  durationMinutes: number;
  durationHours: number;
  untilDate: string;
  expanded: boolean;
}

const DELAY_TYPE_OPTIONS = [
  { label: 'Duration', value: 'duration' },
  { label: 'Until Date', value: 'until' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDelay(data: DelayData): string {
  if (data.delayType === 'until' && data.untilDate) {
    try {
      const date = new Date(data.untilDate);
      return `Wait until ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    } catch {
      return 'Wait until...';
    }
  }
  const hours = data.durationHours || 0;
  const minutes = data.durationMinutes || 0;
  if (hours > 0 && minutes > 0) return `Wait ${hours}h ${minutes}m`;
  if (hours > 0) return `Wait ${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `Wait ${minutes} min`;
  return 'No delay set';
}

function formatCountdown(targetMs: number): string {
  const diff = targetMs - Date.now();
  if (diff <= 0) return 'Resuming...';
  const secs = Math.floor(diff / 1000) % 60;
  const mins = Math.floor(diff / 60000) % 60;
  const hrs = Math.floor(diff / 3600000);
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function DelayNodeRaw({ id, data }: NodeProps<DelayData>) {
  const { setNodes } = useReactFlow();
  const isExecuting = usePipelineStore((s) => s.isExecuting);
  const executionProgress = usePipelineStore((s) => s.executionProgress);
  const nodeStatus = executionProgress.get(id);

  const {
    delayType = 'duration',
    durationMinutes = 0,
    durationHours = 0,
    untilDate = '',
    expanded,
  } = data;

  const borderClass =
    isExecuting && nodeStatus
      ? statusClasses[nodeStatus]
      : 'border-l-[#60A5FA]';

  // Live countdown for paused state
  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    if (nodeStatus !== 'paused') {
      setCountdown('');
      return;
    }
    // Compute target time from duration
    const totalMs = ((durationHours || 0) * 3600 + (durationMinutes || 0) * 60) * 1000;
    const target = Date.now() + totalMs;
    const interval = setInterval(() => {
      setCountdown(formatCountdown(target));
    }, 1000);
    return () => clearInterval(interval);
  }, [nodeStatus, durationHours, durationMinutes]);

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
      className={`group relative rounded-lg border border-[#383430] border-l-4 ${borderClass} bg-[#2D2B28] min-w-[180px] shadow-md transition-all duration-300`}
    >
      <NodeDeleteButton nodeId={id} />
      {/* Compact view */}
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#60A5FA]/15 flex items-center justify-center flex-shrink-0">
            <Clock className="w-3 h-3 text-[#60A5FA]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              Delay
            </p>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#60A5FA]/20 text-[#60A5FA]"
          >
            {formatDelay(data)}
          </span>
          {nodeStatus === 'paused' && countdown && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#60A5FA]/10 text-[#60A5FA] font-mono animate-pulse">
              {countdown}
            </span>
          )}
        </div>
      </div>

      {/* Expanded form */}
      {expanded && !isExecuting && (
        <div className="border-t border-[#383430] p-3 space-y-2.5 animate-fade-in">
          <FieldSelect
            label="Delay Type"
            value={delayType}
            options={DELAY_TYPE_OPTIONS}
            onChange={(v) => updateField('delayType', v)}
          />
          {delayType === 'duration' ? (
            <div className="grid grid-cols-2 gap-2">
              <FieldInput
                label="Hours"
                value={durationHours || ''}
                onChange={(v) => updateField('durationHours', parseInt(v) || 0)}
                placeholder="0"
                type="number"
              />
              <FieldInput
                label="Minutes"
                value={durationMinutes || ''}
                onChange={(v) => updateField('durationMinutes', parseInt(v) || 0)}
                placeholder="30"
                type="number"
              />
            </div>
          ) : (
            <FieldInput
              label="Date & Time"
              value={untilDate}
              onChange={(v) => updateField('untilDate', v)}
              placeholder="2026-03-15T09:00"
              type="datetime-local"
            />
          )}
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
        className="!w-5 !h-5 !bg-[#60A5FA] !border-2 !border-[#2D2B28] hover:!shadow-[0_0_8px_#60A5FA]"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-5 !h-5 !bg-[#60A5FA] !border-2 !border-[#2D2B28] hover:!shadow-[0_0_8px_#60A5FA]"
      />
    </div>
  );
}

export const DelayNode = memo(DelayNodeRaw);
