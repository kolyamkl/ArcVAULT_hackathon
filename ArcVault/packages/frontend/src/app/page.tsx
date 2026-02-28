'use client';

import { useState, useCallback } from 'react';
import {
  AlertCircle,
  RefreshCw,
  Landmark,
  TrendingUp,
  DollarSign,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import dynamic from 'next/dynamic';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useVaultBalances } from '@/hooks/useVaultBalances';
import { useSetThreshold } from '@/hooks/useSetThreshold';
import { StatCard } from '@/components/shared/StatCard';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { YieldChart } from '@/components/vault/YieldChart';
import { AllocationPie } from '@/components/vault/AllocationPie';
import { ThresholdSlider } from '@/components/vault/ThresholdSlider';
import { ActivityFeed } from '@/components/shared/ActivityFeed';
import { formatCurrency } from '@/lib/format';

const DepositModal = dynamic(
  () => import('@/components/vault/DepositModal').then((m) => m.DepositModal),
  { ssr: false },
);
const WithdrawModal = dynamic(
  () => import('@/components/vault/WithdrawModal').then((m) => m.WithdrawModal),
  { ssr: false },
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { isConnected } = useAccount();
  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useDashboardStats();

  const vaultBalances = useVaultBalances();
  const setThresholdMutation = useSetThreshold();

  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  // Prefer on-chain balances when available, fall back to API data
  const liquidUSDC =
    vaultBalances.liquidUSDC > BigInt(0)
      ? Number(vaultBalances.liquidUSDC) / 1e6
      : stats?.liquidBalance ?? 0;

  const usycPosition =
    vaultBalances.usycBalance > BigInt(0)
      ? Number(vaultBalances.usycBalance) / 1e6
      : (stats?.totalBalance ?? 0) - (stats?.liquidBalance ?? 0);

  const totalAUM = liquidUSDC + usycPosition;
  const yieldAccrued = Number(vaultBalances.yieldAccrued) / 1e6;
  const totalValue = Number(vaultBalances.totalValue) / 1e6;
  const currentThreshold = Number(vaultBalances.threshold) / 1e6;
  const balancesLoading = vaultBalances.isLoading;

  // Handle threshold update
  const handleUpdateThreshold = useCallback(
    (newThreshold: number) => {
      const thresholdBigInt = parseUnits(newThreshold.toFixed(6), 6);
      setThresholdMutation.mutate({ threshold: thresholdBigInt });
    },
    [setThresholdMutation],
  );

  // Build activity entries from the API transactions
  const activities = (stats?.recentTransactions ?? []).map((tx) => ({
    id: tx.id,
    type: tx.type === 'WITHDRAWAL' ? 'WITHDRAW' : tx.type === 'YIELD' ? 'SWEEP' : tx.type,
    description: tx.description ?? `${tx.type} ${formatCurrency(tx.amount)}`,
    amount: tx.amount,
    currency: tx.currency ?? 'USDC',
    timestamp: tx.createdAt,
    txHash: tx.txHash,
  })) as Array<{
    id: string;
    type: 'DEPOSIT' | 'SWEEP' | 'PAYOUT' | 'FX_SWAP' | 'REDEEM' | 'WITHDRAW';
    description: string;
    amount: number;
    currency: string;
    timestamp: string;
    txHash?: string;
  }>;

  // Build yield chart data from dashboard stats
  const yieldHistory: Array<{
    date: string;
    cumulativeYield: number;
    dailyYield: number;
  }> = [];

  // Error state
  if (error && !stats) {
    return (
      <div className="animate-fade-in flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md mx-auto text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-error/10">
              <AlertCircle className="w-6 h-6 text-error" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                Failed to load dashboard
              </h3>
              <p className="text-sm text-muted">
                {error instanceof Error ? error.message : 'An unexpected error occurred'}
              </p>
            </div>
            <Button variant="primary" onClick={handleRetry}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Row 1 -- Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total AUM"
          value={formatCurrency(totalAUM)}
          change={stats?.balanceChange}
          iconBadge={<Landmark className="h-5 w-5" />}
        />
        <StatCard
          label="Liquid USDC"
          value={formatCurrency(liquidUSDC)}
          iconBadge={<DollarSign className="h-5 w-5" />}
          subtitle="Available for payouts"
        />
        <StatCard
          label="USYC Position"
          value={formatCurrency(usycPosition)}
          iconBadge={<Coins className="h-5 w-5" />}
          subtitle="Earning 4.85% APY"
        />
        <StatCard
          label="Accrued Yield"
          value={formatCurrency(yieldAccrued)}
          iconBadge={<TrendingUp className="h-5 w-5" />}
          subtitle="Since inception"
        />
      </div>

      {/* Row 2 -- Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <h3 className="font-display text-2xl font-medium text-foreground mb-4">Yield Over Time</h3>
          <YieldChart data={yieldHistory} loading={isLoading} />
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="font-display text-2xl font-medium text-foreground mb-4">Asset Allocation</h3>
          <AllocationPie
            liquidUSDC={liquidUSDC}
            usycPosition={usycPosition}
            loading={isLoading}
          />
        </Card>
      </div>

      {/* Row 3 -- Threshold + Actions */}
      <Card className="bg-transparent">
        <ThresholdSlider
          currentThreshold={currentThreshold}
          liquidBalance={liquidUSDC}
          usycBalance={usycPosition}
          totalValue={totalValue > 0 ? totalValue : liquidUSDC + usycPosition}
          onUpdateThreshold={handleUpdateThreshold}
          isUpdating={setThresholdMutation.isPending}
          canUpdate={isConnected}
          loading={balancesLoading}
        />
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          onClick={() => setDepositOpen(true)}
          disabled={!isConnected}
        >
          <ArrowDownLeft className="w-4 h-4 mr-2" />
          Deposit USDC
        </Button>

        <Button
          variant="secondary"
          onClick={() => setWithdrawOpen(true)}
          disabled={!isConnected}
        >
          <ArrowUpRight className="w-4 h-4 mr-2" />
          Withdraw USDC
        </Button>

        {!isConnected && (
          <p className="text-xs text-[#A09D95] self-center">
            Connect wallet to perform vault actions
          </p>
        )}
      </div>

      {/* Row 4 -- Recent Activity */}
      <Card>
        <ActivityFeed activities={activities} loading={isLoading} />
      </Card>

      {/* Modals */}
      <DepositModal isOpen={depositOpen} onClose={() => setDepositOpen(false)} />
      <WithdrawModal isOpen={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </div>
  );
}
