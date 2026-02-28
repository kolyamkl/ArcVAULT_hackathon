'use client';

import { useCallback, useState } from 'react';
import { useAccount } from 'wagmi';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { usePipelineStore } from '@/stores/pipeline.store';
import { api } from '@/lib/api';
import { formatCurrency, shortenAddress } from '@/lib/utils';
import type { PipelineCostSummary } from './PipelineSummary';
import { ArrowRightLeft, AlertCircle, Users, ShieldCheck, GitBranch, Clock } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: PipelineCostSummary;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Pre-execution summary modal.
 *
 * Shows a full breakdown of the pipeline before the user confirms execution:
 * - Total cost
 * - Department breakdown
 * - FX conversions needed
 * - USYC redemptions needed
 * - Recipient table
 * - Confirm & Execute / Cancel actions
 */
export function ExecutionModal({ isOpen, onClose, summary }: ExecutionModalProps) {
  const {
    currentPipelineId,
    currentPipelineName,
    startExecution,
    addLogEntry,
  } = usePipelineStore();

  const { address } = useAccount();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirmExecute = useCallback(async () => {
    if (!currentPipelineId || !address) return;

    setIsSubmitting(true);

    try {
      // Call the real execute endpoint
      const response = await api.pipelines.execute(currentPipelineId, address);
      const executionId = response.execution.id;

      // Start execution with the real execution ID — triggers polling
      startExecution(executionId);
      onClose();
    } catch (error) {
      console.error('Failed to start execution:', error);
      addLogEntry({
        timestamp: new Date(),
        message: `Failed to start execution: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [currentPipelineId, address, startExecution, addLogEntry, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Execute Pipeline: "${currentPipelineName}"`}
      className="!max-w-2xl"
    >
      <div className="space-y-5">
        {/* Total cost */}
        <div className="flex items-center justify-between rounded-lg bg-[#C9A96215] border border-[#C9A96230] p-3">
          <span className="text-sm font-medium text-[#A09D95]">Total cost</span>
          <span className="text-xl font-bold text-[#C9A962]">
            {formatCurrency(summary.totalCost)}
          </span>
        </div>

        {/* Department breakdown */}
        {summary.departmentBreakdown.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">
              Department Breakdown
            </h4>
            <div className="space-y-1.5">
              {summary.departmentBreakdown.map((dept) => (
                <div
                  key={dept.name}
                  className="flex items-center justify-between text-sm px-3 py-1.5 rounded bg-[#232120]"
                >
                  <span className="text-[#A09D95]">{dept.name}</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(dept.cost)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FX conversions */}
        {summary.fxConversionCount > 0 && (
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <ArrowRightLeft className="w-4 h-4 text-[#D4A853]" />
              FX Conversions
            </h4>
            <div className="space-y-1.5">
              {summary.recipients
                .filter((r) => r.currency !== 'USDC')
                .map((r) => (
                  <div
                    key={`${r.name}-${r.currency}`}
                    className="flex items-center justify-between text-sm px-3 py-1.5 rounded bg-[#D4A853]/5 border border-[#D4A853]/10"
                  >
                    <span className="text-[#A09D95]">
                      {formatCurrency(r.amount)} USDC → {r.currency}
                    </span>
                    <span className="text-xs text-[#D4A853]">{r.name}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Approval gates info */}
        {summary.approvalCount > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-[#A78BFA]/10 border border-[#A78BFA]/20 p-3">
            <ShieldCheck className="w-4 h-4 text-[#A78BFA] flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-[#A78BFA]">
                {summary.approvalCount} Approval Gate{summary.approvalCount > 1 ? 's' : ''}
              </p>
              <p className="text-[#A09D95] mt-0.5">
                Execution will pause at approval gates until the required signatures are collected.
              </p>
            </div>
          </div>
        )}

        {/* Delay info */}
        {summary.delayCount > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-[#60A5FA]/10 border border-[#60A5FA]/20 p-3">
            <Clock className="w-4 h-4 text-[#60A5FA] flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-[#60A5FA]">
                {summary.delayCount} Delay Node{summary.delayCount > 1 ? 's' : ''}
              </p>
              <p className="text-[#A09D95] mt-0.5">
                Execution will pause at delay nodes and resume automatically when the time expires.
              </p>
            </div>
          </div>
        )}

        {/* Condition info */}
        {summary.conditionCount > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-[#22D3EE]/10 border border-[#22D3EE]/20 p-3">
            <GitBranch className="w-4 h-4 text-[#22D3EE] flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-[#22D3EE]">
                {summary.conditionCount} Condition{summary.conditionCount > 1 ? 's' : ''}
              </p>
              <p className="text-[#A09D95] mt-0.5">
                Conditions will evaluate at runtime and only execute the matching branch.
              </p>
            </div>
          </div>
        )}

        {/* USYC redemption warning */}
        {summary.usycRedemptionNeeded > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-[#E0A84C]/10 border border-[#E0A84C]/20 p-3">
            <AlertCircle className="w-4 h-4 text-[#E0A84C] flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-[#E0A84C]">USYC Redemption Required</p>
              <p className="text-[#A09D95] mt-0.5">
                Need to redeem {formatCurrency(summary.usycRedemptionNeeded)} from USYC
                to cover the total cost.
              </p>
            </div>
          </div>
        )}

        {/* Recipient table */}
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
            <Users className="w-4 h-4 text-[#A09D95]" />
            Recipients ({summary.recipientCount})
          </h4>
          <div className="rounded-lg border border-[#383430] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#232120] border-b border-[#383430]">
                  <th className="text-left text-xs font-medium text-[#A09D95] px-3 py-2">
                    Name
                  </th>
                  <th className="text-right text-xs font-medium text-[#A09D95] px-3 py-2">
                    Amount
                  </th>
                  <th className="text-center text-xs font-medium text-[#A09D95] px-3 py-2">
                    Currency
                  </th>
                  <th className="text-right text-xs font-medium text-[#A09D95] px-3 py-2">
                    Wallet
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.recipients.map((r, idx) => (
                  <tr
                    key={`${r.name}-${idx}`}
                    className="border-b border-[#383430] last:border-0 hover:bg-[#C9A96210] transition-colors"
                  >
                    <td className="px-3 py-2 text-foreground font-medium">
                      {r.name || 'Unnamed'}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground">
                      {formatCurrency(r.amount, r.currency)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold
                          ${r.currency !== 'USDC'
                            ? 'bg-[#D4A853]/20 text-[#D4A853]'
                            : 'bg-[#7EC97A]/20 text-[#7EC97A]'
                          }`}
                      >
                        {r.currency}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-[#A09D95] text-xs font-mono">
                      {r.walletAddress
                        ? shortenAddress(r.walletAddress)
                        : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#383430]">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirmExecute}
            disabled={isSubmitting || !currentPipelineId || !address}
          >
            {isSubmitting ? 'Starting...' : 'Confirm & Execute'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
