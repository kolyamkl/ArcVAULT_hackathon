'use client';

import { CirclePlus, CircleMinus, ArrowRightLeft, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
  onClick?: () => void;
}

function ActionButton({ icon, label, primary, onClick }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex-1 flex flex-col items-center justify-center gap-1.5 h-[72px] rounded-xl transition-all',
        primary
          ? 'bg-gradient-to-br from-[#C9A962] to-[#D4A853] text-[#0A0A0A]'
          : 'bg-[#16161480] border border-[#C9A96230] text-foreground hover:border-[#C9A96250]',
      )}
    >
      <span className={clsx('w-5 h-5', !primary && 'text-[#C9A962]')}>{icon}</span>
      <span className="text-[12px] font-semibold">{label}</span>
    </button>
  );
}

interface ActionBarProps {
  onDeposit?: () => void;
  onWithdraw?: () => void;
  onSwap?: () => void;
  onRedeem?: () => void;
}

export function ActionBar({ onDeposit, onWithdraw, onSwap, onRedeem }: ActionBarProps) {
  return (
    <div className="flex gap-3">
      <ActionButton icon={<CirclePlus className="w-5 h-5" />} label="Deposit" primary onClick={onDeposit} />
      <ActionButton icon={<CircleMinus className="w-5 h-5" />} label="Withdraw" onClick={onWithdraw} />
      <ActionButton icon={<ArrowRightLeft className="w-5 h-5" />} label="Swap" onClick={onSwap} />
      <ActionButton icon={<RotateCcw className="w-5 h-5" />} label="Redeem" onClick={onRedeem} />
    </div>
  );
}
