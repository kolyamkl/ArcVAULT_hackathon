'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { ShieldCheck, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useApprovalSign } from '@/hooks/useApprovalSign';
import { shortenAddress } from '@/lib/utils';

interface Approver {
  address: string;
  status: string; // PENDING | APPROVED
}

interface ApprovalStatus {
  nodeId: string;
  approvals: Approver[];
  threshold: number;
  met: boolean;
}

interface ApprovalPanelProps {
  executionId: string;
  nodeId: string;
}

export function ApprovalPanel({ executionId, nodeId }: ApprovalPanelProps) {
  const { address: connectedAddress } = useAccount();
  const { signApproval, isSigning, error: signError, clearError } = useApprovalSign();

  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Poll approval status every 5s
  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch(
          `/api/pipelines/executions/${executionId}/approve?nodeId=${nodeId}`,
        );
        if (res.ok && !cancelled) {
          setApprovalStatus(await res.json());
        }
      } catch {
        // silent — will retry
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 5_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [executionId, nodeId]);

  const handleApprove = useCallback(async () => {
    if (!connectedAddress) return;
    clearError();
    setSubmitError(null);

    const signature = await signApproval(executionId, nodeId);
    if (!signature) return; // signError is set by the hook

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/pipelines/executions/${executionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approverAddress: connectedAddress,
          nodeId,
          signature,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }));
        setSubmitError(data.error || `Error ${res.status}`);
        return;
      }

      // Refresh status immediately
      const updated = await fetch(
        `/api/pipelines/executions/${executionId}/approve?nodeId=${nodeId}`,
      );
      if (updated.ok) setApprovalStatus(await updated.json());
    } catch {
      setSubmitError('Network error — please try again');
    } finally {
      setIsSubmitting(false);
    }
  }, [connectedAddress, executionId, nodeId, signApproval, clearError]);

  // Derived state
  const lowerConnected = connectedAddress?.toLowerCase();
  const isApprover = approvalStatus?.approvals.some(
    (a) => a.address.toLowerCase() === lowerConnected,
  );
  const alreadyApproved = approvalStatus?.approvals.some(
    (a) => a.address.toLowerCase() === lowerConnected && a.status === 'APPROVED',
  );
  // Check if connected wallet is in the configured approver list (even if not yet in DB)
  const isPendingApprover = isApprover && !alreadyApproved;
  const approvedCount = approvalStatus?.approvals.filter((a) => a.status === 'APPROVED').length ?? 0;
  const threshold = approvalStatus?.threshold ?? 1;
  const displayError = signError || submitError;

  return (
    <div className="border-t border-[#383430] p-4 flex-shrink-0">
      <div className="rounded-lg p-3 bg-[#A78BFA]/10 border border-[#A78BFA]/20">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-[#A78BFA]" />
          <p className="text-sm font-semibold text-[#A78BFA]">
            Approval Gate
          </p>
          <span className="ml-auto text-xs text-[#A09D95]">
            {approvedCount}/{threshold}
          </span>
        </div>

        {/* Approver list */}
        {approvalStatus && (
          <div className="space-y-1.5 mb-3">
            {approvalStatus.approvals.map((a) => (
              <div
                key={a.address}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-foreground font-mono">
                  {shortenAddress(a.address)}
                </span>
                {a.status === 'APPROVED' ? (
                  <span className="flex items-center gap-1 text-[#7EC97A]">
                    <CheckCircle className="w-3 h-3" />
                    Signed
                  </span>
                ) : (
                  <span className="text-[#A09D95]">Pending</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Action area */}
        {!connectedAddress && (
          <p className="text-xs text-[#A09D95]">
            Connect your wallet to approve.
          </p>
        )}

        {connectedAddress && !isApprover && approvalStatus && (
          <p className="text-xs text-[#A09D95]">
            Your wallet ({shortenAddress(connectedAddress)}) is not a configured approver.
          </p>
        )}

        {alreadyApproved && (
          <p className="text-xs text-[#7EC97A]">
            You have already approved this step.
          </p>
        )}

        {isPendingApprover && (
          <button
            onClick={handleApprove}
            disabled={isSigning || isSubmitting}
            className="w-full mt-1 py-2 px-3 rounded-md text-sm font-semibold
                       bg-[#A78BFA] text-white hover:bg-[#9575E6]
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors flex items-center justify-center gap-2"
          >
            {isSigning || isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isSigning ? 'Signing...' : 'Submitting...'}
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Sign & Approve
              </>
            )}
          </button>
        )}

        {/* Wallet not in approver list at all — check if we just haven't loaded yet */}
        {connectedAddress && !approvalStatus && (
          <div className="flex items-center gap-2 text-xs text-[#A09D95]">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading approver status...
          </div>
        )}

        {/* Error display */}
        {displayError && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-[#D46B6B]">
            <XCircle className="w-3 h-3 flex-shrink-0" />
            {displayError}
          </div>
        )}

        {/* Threshold met */}
        {approvalStatus?.met && (
          <p className="mt-2 text-xs text-[#7EC97A]">
            Threshold met — pipeline is resuming.
          </p>
        )}
      </div>
    </div>
  );
}
