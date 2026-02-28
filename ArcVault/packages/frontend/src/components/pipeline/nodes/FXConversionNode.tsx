'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { usePipelineStore, type NodeStatus } from '@/stores/pipeline.store';
import { ArrowRightLeft } from 'lucide-react';

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

interface FXConversionData {
  fromCurrency: string;
  toCurrency: string;
  rate: number | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Auto-inserted FX conversion pill node.
 *
 * Positioned midway between a Department and a non-USDC recipient node.
 * Shows the conversion rate and is non-interactive (not editable, not deletable
 * independently -- removed when the parent edge is deleted).
 */
function FXConversionNodeRaw({ id, data }: NodeProps<FXConversionData>) {
  const isExecuting = usePipelineStore((s) => s.isExecuting);
  const executionProgress = usePipelineStore((s) => s.executionProgress);
  const nodeStatus = executionProgress.get(id);

  const { fromCurrency, toCurrency, rate } = data;

  const borderClass =
    isExecuting && nodeStatus
      ? statusClasses[nodeStatus]
      : 'border-[#D4A853]';

  return (
    <div
      className={`rounded-full border ${borderClass} bg-[#D4A853]/10 px-4 py-2 shadow-sm transition-all duration-300`}
    >
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="w-3.5 h-3.5 text-[#D4A853] flex-shrink-0" />
        <div className="text-center">
          <div className="text-[10px] font-semibold text-[#D4A853] uppercase tracking-wider">
            FX
          </div>
          <div className="text-xs text-foreground whitespace-nowrap">
            {rate
              ? `1 ${fromCurrency || 'USDC'} = ${rate.toFixed(4)} ${toCurrency}`
              : `${fromCurrency || 'USDC'} → ${toCurrency}`}
          </div>
        </div>
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-[#D4A853] !border-2 !border-[#2D2B28] hover:!shadow-[0_0_8px_#D4A853]"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-[#D4A853] !border-2 !border-[#2D2B28] hover:!shadow-[0_0_8px_#D4A853]"
      />
    </div>
  );
}

export const FXConversionNode = memo(FXConversionNodeRaw);
