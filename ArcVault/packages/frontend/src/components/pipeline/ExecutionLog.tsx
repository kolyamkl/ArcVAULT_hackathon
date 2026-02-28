'use client';

import { useEffect, useRef, useState } from 'react';
import { usePipelineStore, type ExecutionLogEntry } from '@/stores/pipeline.store';
import {
  X,
  CheckCircle,
  XCircle,
  Loader2,
  Info,
  ChevronRight,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { usePipelineExecution } from '@/hooks/usePipelineExecution';
import { ApprovalPanel } from './ApprovalPanel';

// ---------------------------------------------------------------------------
// Status icon map
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: ExecutionLogEntry['status'] }) {
  switch (status) {
    case 'success':
      return <CheckCircle className="w-4 h-4 text-[#7EC97A] flex-shrink-0" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-[#D46B6B] flex-shrink-0" />;
    case 'pending':
      return <Loader2 className="w-4 h-4 text-[#E0A84C] animate-spin flex-shrink-0" />;
    case 'info':
    default:
      return <Info className="w-4 h-4 text-[#C9A962] flex-shrink-0" />;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Execution log side panel (320px wide).
 *
 * Slides in from the right during pipeline execution. Shows progressive
 * log entries with status icons, auto-scrolls to bottom, and can be
 * collapsed via the close button.
 */
export function ExecutionLog() {
  const isExecuting = usePipelineStore((s) => s.isExecuting);
  const currentExecutionId = usePipelineStore((s) => s.currentExecutionId);
  const executionLog = usePipelineStore((s) => s.executionLog);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { data: executionData } = usePipelineExecution(
    isExecuting ? currentExecutionId : null,
  );
  const executionStatus = executionData?.status;

  // Find the node that is currently awaiting approval
  const pausedApprovalNodeId = executionData?.steps?.find(
    (s) => s.status === 'awaiting_approval',
  )?.nodeId ?? null;

  const scrollRef = useRef<HTMLDivElement>(null);

  // Show panel when execution starts
  const isVisible = (isExecuting || executionLog.length > 0) && !isCollapsed;

  // Auto-scroll to bottom when new entries appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [executionLog.length]);

  // Compute summary stats for the final summary display
  const isComplete = !isExecuting && executionLog.length > 0;
  const successCount = executionLog.filter((e) => e.status === 'success').length;
  const errorCount = executionLog.filter((e) => e.status === 'error').length;

  if (!isVisible && !isCollapsed) return null;

  // Collapsed toggle button
  if (isCollapsed && executionLog.length > 0) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-30
                   bg-[#232120] border border-[#383430] border-r-0 rounded-l-lg
                   p-2 shadow-lg hover:bg-[#C9A96210] transition-colors"
        aria-label="Show execution log"
      >
        <ChevronRight className="w-4 h-4 text-[#A09D95] rotate-180" />
      </button>
    );
  }

  if (!isVisible) return null;

  return (
    <aside
      className="w-[320px] flex-shrink-0 border-l border-[#383430] bg-transparent
                 flex flex-col animate-slide-in-right overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#383430] flex-shrink-0">
        <h3 className="text-sm font-display font-semibold text-foreground">
          Execution Log
        </h3>
        <div className="flex items-center gap-2">
          {isExecuting && executionStatus === 'AWAITING_APPROVAL' && (
            <span className="flex items-center gap-1.5 text-xs text-[#A78BFA]">
              <ShieldCheck className="w-3 h-3" />
              Awaiting
            </span>
          )}
          {isExecuting && executionStatus === 'PAUSED' && (
            <span className="flex items-center gap-1.5 text-xs text-[#60A5FA]">
              <Clock className="w-3 h-3" />
              Paused
            </span>
          )}
          {isExecuting && executionStatus !== 'AWAITING_APPROVAL' && executionStatus !== 'PAUSED' && (
            <span className="flex items-center gap-1.5 text-xs text-[#E0A84C]">
              <Loader2 className="w-3 h-3 animate-spin" />
              Running
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 rounded text-[#A09D95] hover:text-foreground hover:bg-[#C9A96210] transition-colors"
            aria-label="Close execution log"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-2"
      >
        {executionLog.map((entry, index) => (
          <div
            key={index}
            className="flex items-start gap-2.5 animate-fade-in"
          >
            <StatusIcon status={entry.status} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground leading-snug">
                {entry.message}
              </p>
              <p className="text-[10px] text-[#C9A962] mt-0.5">
                {entry.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {/* Execution in progress indicator */}
        {isExecuting && executionLog.length > 0 && (
          <div className="flex items-center gap-2 pt-2">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4A853] animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4A853] animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4A853] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Awaiting approval panel */}
      {executionStatus === 'AWAITING_APPROVAL' && currentExecutionId && pausedApprovalNodeId ? (
        <ApprovalPanel executionId={currentExecutionId} nodeId={pausedApprovalNodeId} />
      ) : executionStatus === 'AWAITING_APPROVAL' && (
        <div className="border-t border-[#383430] p-4 flex-shrink-0">
          <div className="rounded-lg p-3 bg-[#A78BFA]/10 border border-[#A78BFA]/20">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-[#A78BFA]" />
              <p className="text-sm font-semibold text-[#A78BFA]">Awaiting Approvals</p>
            </div>
            <p className="text-xs text-[#A09D95]">
              Pipeline is paused at an approval gate. Execution will resume once the required approvals are collected.
            </p>
          </div>
        </div>
      )}

      {/* Paused (delay) panel */}
      {executionStatus === 'PAUSED' && (
        <div className="border-t border-[#383430] p-4 flex-shrink-0">
          <div className="rounded-lg p-3 bg-[#60A5FA]/10 border border-[#60A5FA]/20">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-[#60A5FA]" />
              <p className="text-sm font-semibold text-[#60A5FA]">Pipeline Paused</p>
            </div>
            <p className="text-xs text-[#A09D95]">
              Pipeline is paused at a delay node. Execution will resume automatically when the timer expires.
            </p>
          </div>
        </div>
      )}

      {/* Final summary (shown after execution completes) */}
      {isComplete && (
        <div className="border-t border-[#383430] p-4 flex-shrink-0">
          <div
            className={`rounded-lg p-3 ${
              errorCount > 0
                ? 'bg-[#D46B6B]/10 border border-[#D46B6B]/20'
                : 'bg-[#7EC97A]/10 border border-[#7EC97A]/20'
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                errorCount > 0 ? 'text-[#D46B6B]' : 'text-[#7EC97A]'
              }`}
            >
              {errorCount > 0
                ? 'Pipeline Completed with Errors'
                : 'Pipeline Executed Successfully!'}
            </p>
            <div className="mt-2 space-y-1 text-xs text-[#A09D95]">
              <p>
                {successCount} payment{successCount !== 1 ? 's' : ''} completed
                {errorCount > 0 && `, ${errorCount} failed`}
              </p>
            </div>
          </div>
        </div>
      )}

    </aside>
  );
}
