'use client';

import { ActionBar } from '@/components/vault/ActionBar';
import { YieldPerformance } from '@/components/vault/YieldPerformance';
import { LiquidityAllocation } from '@/components/vault/LiquidityAllocation';
import { TransactionHistoryTable } from '@/components/vault/TransactionHistoryTable';

export default function VaultPage() {
  return (
    <div className="-m-6 px-10 py-8 space-y-7">
      {/* TODO: wire up deposit/withdraw/swap/redeem actions */}
      <ActionBar />
      <YieldPerformance />
      <LiquidityAllocation />
      <TransactionHistoryTable />
    </div>
  );
}
