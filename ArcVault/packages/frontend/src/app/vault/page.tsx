'use client';

import { useState } from 'react';
import { parseUnits } from 'viem';
import { ActionBar } from '@/components/vault/ActionBar';
import { YieldPerformance } from '@/components/vault/YieldPerformance';
import { LiquidityAllocation } from '@/components/vault/LiquidityAllocation';
import { TransactionHistoryTable } from '@/components/vault/TransactionHistoryTable';
import { DepositModal } from '@/components/vault/DepositModal';
import { WithdrawModal } from '@/components/vault/WithdrawModal';
import { SweepModal } from '@/components/vault/SweepModal';
import { RedeemModal } from '@/components/vault/RedeemModal';
import { useVaultBalances } from '@/hooks/useVaultBalances';
import { useSetThreshold } from '@/hooks/useSetThreshold';
import { useHasCFORole } from '@/hooks/useHasCFORole';

export default function VaultPage() {
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [sweepOpen, setSweepOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);

  const [localThresholdPercent, setLocalThresholdPercent] = useState<number | null>(null);

  const { liquidUSDC, usycBalance, totalValue, threshold } = useVaultBalances();
  const setThreshold = useSetThreshold();
  const { hasCFORole } = useHasCFORole();

  // Convert on-chain bigint values (6 decimals) to numbers for the UI
  const totalVal = Number(totalValue) / 1e6;
  const liquidVal = Number(liquidUSDC) / 1e6;
  const usycVal = Number(usycBalance) / 1e6;
  const thresholdVal = Number(threshold) / 1e6;

  // Compute percentages — fallback to defaults when wallet not connected (totalVal === 0)
  const usycPercent = totalVal > 0 ? Math.round((usycVal / totalVal) * 100) : 65;
  const liquidPercent = totalVal > 0 ? Math.round((liquidVal / totalVal) * 100) : 35;
  const thresholdPercent = totalVal > 0 ? Math.round((thresholdVal / totalVal) * 100) : 20;
  const displayTotalBalance = totalVal > 0 ? totalVal : 1_000_000;

  const handleUpdateThreshold = async (percentValue: number) => {
    // Immediately update the UI so the user sees feedback
    setLocalThresholdPercent(percentValue);

    try {
      // Convert percentage to absolute USDC amount (6 decimals)
      const absoluteAmount = (percentValue / 100) * displayTotalBalance;
      const thresholdBigInt = parseUnits(String(absoluteAmount), 6);
      await setThreshold.mutateAsync({ threshold: thresholdBigInt });
    } catch {
      // Revert optimistic update on failure
      setLocalThresholdPercent(null);
    }
  };

  return (
    <div className="-m-6 px-10 py-8 space-y-7">
      <ActionBar
        onDeposit={() => setDepositOpen(true)}
        onWithdraw={() => setWithdrawOpen(true)}
        onSwap={() => setSweepOpen(true)}
        onRedeem={() => setRedeemOpen(true)}
      />
      <YieldPerformance />
      <LiquidityAllocation
        usycPercent={usycPercent}
        liquidPercent={liquidPercent}
        threshold={localThresholdPercent ?? thresholdPercent}
        totalBalance={displayTotalBalance}
        onUpdateThreshold={handleUpdateThreshold}
        onRebalance={() => alert('Rebalance coming soon')}
        isUpdating={setThreshold.isPending}
        canUpdate={hasCFORole}
      />
      <TransactionHistoryTable />

      <DepositModal isOpen={depositOpen} onClose={() => setDepositOpen(false)} />
      <WithdrawModal isOpen={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
      <SweepModal isOpen={sweepOpen} onClose={() => setSweepOpen(false)} />
      <RedeemModal isOpen={redeemOpen} onClose={() => setRedeemOpen(false)} />
    </div>
  );
}
