import { clsx } from 'clsx';

interface StatusBadgeProps {
  status: 'COMPLETED' | 'PENDING' | 'PROCESSING' | 'FAILED' | string;
  className?: string;
}

const statusStyles: Record<string, string> = {
  COMPLETED: 'bg-[#7EC97A15] text-[#7EC97A]',
  PENDING: 'bg-[#E0A84C15] text-[#E0A84C]',
  PROCESSING: 'bg-[#C9A96215] text-[#C9A962] animate-pulse-status',
  FAILED: 'bg-[#D46B6B15] text-[#D46B6B]',
  RUNNING: 'bg-[#C9A96215] text-[#C9A962] animate-pulse-status',
  PARTIAL_FAILURE: 'bg-[#E0A84C15] text-[#E0A84C]',
  AWAITING_APPROVAL: 'bg-[#7AADDB15] text-[#7AADDB]',
  PAUSED: 'bg-[#9B8EC815] text-[#9B8EC8]',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = status.toUpperCase();
  const colorClasses = statusStyles[normalized] || 'bg-muted/10 text-muted';

  return (
    <span
      className={clsx(
        'rounded-full px-3 py-1 text-xs font-medium inline-flex items-center gap-1',
        colorClasses,
        className
      )}
    >
      {status}
    </span>
  );
}
