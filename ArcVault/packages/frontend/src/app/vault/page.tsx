'use client';

import { useState } from 'react';
import { ActionBar } from '@/components/vault/ActionBar';
import { YieldPerformance } from '@/components/vault/YieldPerformance';
import { LiquidityAllocation } from '@/components/vault/LiquidityAllocation';
import { TransactionHistoryTable } from '@/components/vault/TransactionHistoryTable';
import { DepositModal } from '@/components/vault/DepositModal';
import { WithdrawModal } from '@/components/vault/WithdrawModal';

export default function VaultPage() {
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  return (
    <div className="-m-6 px-10 py-8 space-y-7">
      <ActionBar
        onDeposit={() => setDepositOpen(true)}
        onWithdraw={() => setWithdrawOpen(true)}
        onSwap={() => alert('Manual Swap coming soon')}
        onRedeem={() => alert('Manual Redeem coming soon')}
      />
      <YieldPerformance />
      <LiquidityAllocation />
      <TransactionHistoryTable />

      <DepositModal isOpen={depositOpen} onClose={() => setDepositOpen(false)} />
      <WithdrawModal isOpen={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </div>
  );
}
