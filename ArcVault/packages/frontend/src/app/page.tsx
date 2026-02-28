'use client';

import { useCallback } from 'react';
import {
  AlertCircle,
  RefreshCw,
  Landmark,
  TrendingUp,
  DollarSign,
  Coins,
  Clock,
} from 'lucide-react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useVaultBalances } from '@/hooks/useVaultBalances';
import { StatCard } from '@/components/shared/StatCard';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { YieldChart } from '@/components/vault/YieldChart';
import { AllocationPie } from '@/components/vault/AllocationPie';
import {
  SparklineChart,
  MiniBarChart,
  GaugeChart,
  ProgressBar,
  PendingDots,
} from '@/components/shared/MiniCharts';
import { formatCurrency } from '@/lib/format';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useDashboardStats();

  const vaultBalances = useVaultBalances();

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

  // Static sample data until the API provides a yield time-series
  const yieldHistory: Array<{
    date: string;
    cumulativeYield: number;
    dailyYield: number;
  }> = [
    { date: '2026-02-01', cumulativeYield: 320, dailyYield: 32 },
    { date: '2026-02-05', cumulativeYield: 480, dailyYield: 38 },
    { date: '2026-02-09', cumulativeYield: 610, dailyYield: 28 },
    { date: '2026-02-13', cumulativeYield: 790, dailyYield: 45 },
    { date: '2026-02-17', cumulativeYield: 940, dailyYield: 36 },
    { date: '2026-02-21', cumulativeYield: 1120, dailyYield: 42 },
    { date: '2026-02-25', cumulativeYield: 1280, dailyYield: 39 },
  ];

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
    <div className="-m-6 px-10 py-8 space-y-7 animate-fade-in">
      {/* Performance Row */}
      <p className="text-[10px] font-semibold tracking-[2px] text-muted">PERFORMANCE</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total AUM"
          value={formatCurrency(totalAUM)}
          change={stats?.balanceChange}
          iconBadge={<Landmark className="h-5 w-5" />}
          miniChart={<SparklineChart />}
        />
        <StatCard
          label="Yield Earned"
          value={formatCurrency(yieldAccrued)}
          change={12.5}
          iconBadge={<TrendingUp className="h-5 w-5" />}
          miniChart={<MiniBarChart />}
        />
        <StatCard
          label="Current APY"
          value="4.85%"
          change={0.12}
          changeLabel="vs last week"
          iconBadge={<TrendingUp className="h-5 w-5" />}
          miniChart={<GaugeChart />}
        />
      </div>

      {/* Positions Row */}
      <p className="text-[10px] font-semibold tracking-[2px] text-muted">POSITIONS</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Liquid USDC"
          value={formatCurrency(liquidUSDC)}
          valueClassName="text-[#7EC97A]"
          subtitle="Available for payouts"
          iconBadge={<DollarSign className="h-5 w-5" />}
          miniChart={<ProgressBar />}
        />
        <StatCard
          label="USYC Position"
          value={formatCurrency(usycPosition)}
          subtitle="Earning 4.85% APY"
          iconBadge={<Coins className="h-5 w-5" />}
        />
        <StatCard
          label="Pending Payouts"
          value={formatCurrency(0)}
          subtitle="Awaiting execution"
          iconBadge={<Clock className="h-5 w-5" />}
          miniChart={<PendingDots />}
        />
      </div>

      {/* Charts Row */}
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

    </div>
  );
}
