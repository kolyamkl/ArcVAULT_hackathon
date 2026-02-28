'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { useVaultBalances } from '@/hooks/useVaultBalances';
import { usePipelineStore, type NodeStatus } from '@/stores/pipeline.store';
import { formatCurrency } from '@/lib/utils';
import { Landmark } from 'lucide-react';

// ---------------------------------------------------------------------------
// Status-driven style map
// ---------------------------------------------------------------------------

const statusClasses: Record<NodeStatus, string> = {
  pending: 'border-[#C9A962] opacity-60',
  processing: 'border-[#E0A84C] animate-pulse shadow-[#E0A84C]/20 shadow-lg',
  completed: 'border-[#7EC97A] shadow-[#7EC97A]/20 shadow-lg',
  failed: 'border-[#D46B6B] shadow-[#D46B6B]/20 shadow-lg',
  awaiting_approval: 'border-[#A78BFA] animate-pulse shadow-[#A78BFA]/20 shadow-lg',
  paused: 'border-[#60A5FA] shadow-[#60A5FA]/20 shadow-lg',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Treasury source node. Always present on the canvas, non-deletable.
 *
 * Shows live vault balances: liquid USDC, USYC balance, and total value.
 * Has a single source handle on the right side for connecting to departments.
 */
function TreasurySourceNodeRaw(_props: NodeProps) {
  const { liquidUSDC, usycBalance, totalValue, isLoading } = useVaultBalances();
  const isExecuting = usePipelineStore((s) => s.isExecuting);
  const executionProgress = usePipelineStore((s) => s.executionProgress);
  const nodeStatus = executionProgress.get('treasury-source');

  const borderClass =
    isExecuting && nodeStatus
      ? statusClasses[nodeStatus]
      : 'border-[#C9A962]';

  return (
    <div
      className={`rounded-xl border-2 ${borderClass} bg-[#2D2B28] p-4 min-w-[220px] shadow-lg transition-all duration-300`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-[#C9A96215] flex items-center justify-center">
          <Landmark className="w-4 h-4 text-[#C9A962]" />
        </div>
        <span className="text-xs font-display font-semibold text-[#C9A962] uppercase tracking-wider">
          Treasury
        </span>
      </div>

      {/* Total value */}
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-6 w-24 rounded bg-[#383430] animate-pulse" />
          <div className="h-3 w-36 rounded bg-[#383430] animate-pulse" />
        </div>
      ) : (
        <>
          <div className="text-lg font-bold text-foreground">
            {formatCurrency(totalValue)}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-[#A09D95]">
            <span>Liquid: {formatCurrency(liquidUSDC)}</span>
            <span className="text-[#383430]">|</span>
            <span>USYC: {formatCurrency(usycBalance)}</span>
          </div>
        </>
      )}

      {/* Source handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-5 !h-5 !bg-[#C9A962] !border-2 !border-[#2D2B28] hover:!shadow-[0_0_8px_#C9A962]"
      />
    </div>
  );
}

export const TreasurySourceNode = memo(TreasurySourceNodeRaw);
