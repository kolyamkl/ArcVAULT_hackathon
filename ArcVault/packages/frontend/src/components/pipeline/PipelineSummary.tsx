'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { useReactFlow } from 'reactflow';
import { Button } from '@/components/shared/Button';
import { useVaultBalances } from '@/hooks/useVaultBalances';
import { usePipelineStore } from '@/stores/pipeline.store';
import { formatCurrency } from '@/lib/utils';
import { Play, Wallet, AlertCircle } from 'lucide-react';
import { ExecutionModal } from './ExecutionModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineCostSummary {
  totalCost: number;
  fxConversionCount: number;
  estimatedFxCost: number;
  usycRedemptionNeeded: number;
  recipientCount: number;
  approvalCount: number;
  conditionCount: number;
  delayCount: number;
  departmentBreakdown: { name: string; cost: number }[];
  recipients: {
    name: string;
    amount: number;
    currency: string;
    walletAddress: string;
  }[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Pipeline summary panel at the bottom of the left sidebar.
 *
 * Computes live cost totals from the current canvas nodes, shows FX conversion
 * counts and USYC redemption needs, and provides the "Execute Pipeline" button.
 */
export function PipelineSummary() {
  const [executionModalOpen, setExecutionModalOpen] = useState(false);

  const { isConnected } = useAccount();
  const { liquidUSDC } = useVaultBalances();
  const liquidBalance = Number(liquidUSDC) / 1e6;

  const isExecuting = usePipelineStore((s) => s.isExecuting);
  const pendingExecutionModal = usePipelineStore((s) => s.pendingExecutionModal);
  const clearExecutionModalTrigger = usePipelineStore((s) => s.clearExecutionModalTrigger);

  // Auto-open execution modal after pipeline save
  useEffect(() => {
    if (pendingExecutionModal) {
      setExecutionModalOpen(true);
      clearExecutionModalTrigger();
    }
  }, [pendingExecutionModal, clearExecutionModalTrigger]);

  // Read current nodes and edges from React Flow
  // This component must be rendered inside a ReactFlowProvider (provided by the Pipeline page)
  const { getNodes, getEdges } = useReactFlow();
  const nodes = getNodes();
  const edges = getEdges();

  // Compute summary from nodes
  const summary = useMemo<PipelineCostSummary>(() => {
    const recipientNodes = nodes.filter(
      (n) => n.type === 'employee' || n.type === 'contractor',
    );
    const departmentNodes = nodes.filter((n) => n.type === 'department');

    const totalCost = recipientNodes.reduce(
      (sum, n) => {
        const base = Number(n.data.amount) || 0;
        const gift = n.data.giftEnabled ? (Number(n.data.giftAmount) || 0) : 0;
        return sum + base + gift;
      },
      0,
    );

    const fxNodes = recipientNodes.filter(
      (n) => n.data.currency && n.data.currency !== 'USDC',
    );
    const fxConversionCount = fxNodes.length;
    const estimatedFxCost = fxConversionCount * 0.5; // ~$0.50 per FX conversion estimate

    const usycRedemptionNeeded = Math.max(0, totalCost - liquidBalance);

    // Build department breakdown
    const departmentBreakdown = departmentNodes.map((dept) => {
      // Find all edges from this department to recipients
      const childEdges = edges.filter((e) => e.source === dept.id);
      const childNodeIds = new Set<string>();

      // Traverse through FX nodes too
      childEdges.forEach((edge) => {
        const targetNode = nodes.find((n) => n.id === edge.target);
        if (targetNode?.type === 'fxConversion') {
          // Find edges from FX node to the actual recipient
          edges
            .filter((e) => e.source === targetNode.id)
            .forEach((fxEdge) => childNodeIds.add(fxEdge.target));
        } else if (
          targetNode?.type === 'employee' ||
          targetNode?.type === 'contractor'
        ) {
          childNodeIds.add(edge.target);
        }
      });

      const cost = nodes
        .filter((n) => childNodeIds.has(n.id))
        .reduce((sum, n) => {
          const base = Number(n.data.amount) || 0;
          const gift = n.data.giftEnabled ? (Number(n.data.giftAmount) || 0) : 0;
          return sum + base + gift;
        }, 0);

      return {
        name: (dept.data.name as string) || 'Unnamed',
        cost,
      };
    });

    // Recipient list for the execution modal
    const recipients = recipientNodes.map((n) => ({
      name: (n.data.name as string) || 'Unnamed',
      amount: Number(n.data.amount) || 0,
      currency: (n.data.currency as string) || 'USDC',
      walletAddress: (n.data.walletAddress as string) || '',
    }));

    const approvalCount = nodes.filter((n) => n.type === 'approval').length;
    const conditionCount = nodes.filter((n) => n.type === 'condition').length;
    const delayCount = nodes.filter((n) => n.type === 'delay').length;

    return {
      totalCost,
      fxConversionCount,
      estimatedFxCost,
      usycRedemptionNeeded,
      recipientCount: recipientNodes.length,
      approvalCount,
      conditionCount,
      delayCount,
      departmentBreakdown,
      recipients,
    };
  }, [nodes, edges, liquidBalance]);

  const canExecute =
    isConnected &&
    summary.recipientCount > 0 &&
    !isExecuting;

  return (
    <div className="p-3 mt-auto border-t border-[#383430]">
      {/* Summary stats */}
      <h3 className="text-[10px] font-display font-semibold text-[#A09D95] uppercase tracking-wider mb-2">
        Summary
      </h3>

      {/* Cost highlight card */}
      <div className="rounded-md bg-[#C9A962]/10 border border-[#C9A962]/20 px-3 py-2 mb-2">
        <span className="text-[10px] text-[#A09D95] block">Total Cost</span>
        <span className="text-lg font-bold text-[#C9A962]">{formatCurrency(summary.totalCost)}</span>
      </div>

      <div className="space-y-1.5 mb-3">
        <SummaryRow
          label="Recipients"
          value={String(summary.recipientCount)}
          color="#7EC97A"
        />
        {summary.fxConversionCount > 0 && (
          <SummaryRow
            label="FX conversions"
            value={`${summary.fxConversionCount}`}
            color="#D4A853"
          />
        )}
        {summary.approvalCount > 0 && (
          <SummaryRow
            label="Approvals"
            value={String(summary.approvalCount)}
            color="#A78BFA"
          />
        )}
        {summary.conditionCount > 0 && (
          <SummaryRow
            label="Conditions"
            value={String(summary.conditionCount)}
            color="#22D3EE"
          />
        )}
        {summary.delayCount > 0 && (
          <SummaryRow
            label="Delays"
            value={String(summary.delayCount)}
            color="#60A5FA"
          />
        )}
        {summary.usycRedemptionNeeded > 0 && (
          <div className="flex items-start gap-2 text-xs">
            <AlertCircle className="w-3.5 h-3.5 text-[#E0A84C] flex-shrink-0 mt-0.5" />
            <span className="text-[#E0A84C]">
              Redeem {formatCurrency(summary.usycRedemptionNeeded)} from USYC
            </span>
          </div>
        )}
      </div>

      {/* Execute button */}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={!canExecute}
        onClick={() => setExecutionModalOpen(true)}
      >
        {!isConnected ? (
          <>
            <Wallet className="w-4 h-4 mr-2" />
            Connect wallet
          </>
        ) : isExecuting ? (
          'Executing...'
        ) : (
          <>
            <Play className="w-4 h-4 mr-2" />
            Execute Pipeline
          </>
        )}
      </Button>

      {summary.recipientCount === 0 && (
        <p className="text-[10px] text-[#A09D95] text-center mt-2">
          Add recipients to the canvas to execute
        </p>
      )}

      {/* Execution modal */}
      <ExecutionModal
        isOpen={executionModalOpen}
        onClose={() => setExecutionModalOpen(false)}
        summary={summary}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal sub-component
// ---------------------------------------------------------------------------

interface SummaryRowProps {
  label: string;
  value: string;
  color?: string;
}

function SummaryRow({ label, value, color }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[#A09D95]">{label}</span>
      <span
        className="font-semibold"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
