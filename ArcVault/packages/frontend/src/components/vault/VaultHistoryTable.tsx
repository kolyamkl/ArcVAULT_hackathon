'use client';

import { useState, useCallback } from 'react';
import { ExternalLink } from 'lucide-react';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Select } from '@/components/shared/Select';
import { useVaultHistory } from '@/hooks/useVaultHistory';
import { formatCurrency, formatDateTime, truncateAddress } from '@/lib/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VaultEventRow {
  id: string;
  type: string;
  amount: number;
  txHash: string;
  timestamp: string;
  status: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

const TYPE_OPTIONS = [
  { label: 'All Types', value: 'ALL' },
  { label: 'Deposit', value: 'DEPOSIT' },
  { label: 'Withdrawal', value: 'WITHDRAWAL' },
  { label: 'Yield', value: 'YIELD' },
  { label: 'Rebalance', value: 'REBALANCE' },
];

const TYPE_BADGE_VARIANT: Record<string, string> = {
  DEPOSIT: 'COMPLETED',
  WITHDRAWAL: 'PENDING',
  YIELD: 'PROCESSING',
  REBALANCE: 'PROCESSING',
};

const EXPLORER_URL = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || 'https://testnet-explorer.arc.io';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VaultHistoryTable({ loading: externalLoading }: { loading?: boolean }) {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('ALL');

  const { data, isLoading } = useVaultHistory({
    page,
    limit: PAGE_SIZE,
    type: typeFilter !== 'ALL' ? (typeFilter.toLowerCase() as 'deposit' | 'withdraw' | 'yield' | 'rebalance') : undefined,
  });

  const isLoadingAny = externalLoading || isLoading;

  const handleTypeChange = useCallback((value: string) => {
    setTypeFilter(value);
    setPage(1);
  }, []);

  const tableData: VaultEventRow[] = (data?.entries ?? []).map((entry) => ({
    id: entry.id,
    type: entry.type,
    amount: entry.amount,
    txHash: entry.txHash,
    timestamp: entry.timestamp,
    status: entry.status,
  }));

  const columns = [
    {
      key: 'type',
      header: 'Type',
      render: (row: VaultEventRow) => {
        const variant = TYPE_BADGE_VARIANT[row.type] ?? row.type;
        return <StatusBadge status={variant} className="!text-xs" />;
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (row: VaultEventRow) => (
        <span className="text-sm font-medium text-foreground">
          {formatCurrency(row.amount, { decimals: 2 })} USDC
        </span>
      ),
    },
    {
      key: 'txHash',
      header: 'TX Hash',
      render: (row: VaultEventRow) =>
        row.txHash ? (
          <a
            href={`${EXPLORER_URL}/tx/${row.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-[#C9A962] hover:text-[#D4A853] transition-colors"
          >
            {truncateAddress(row.txHash)}
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span className="text-sm text-muted">-</span>
        ),
    },
    {
      key: 'timestamp',
      header: 'Timestamp',
      sortable: true,
      render: (row: VaultEventRow) => (
        <span className="text-sm text-muted">{formatDateTime(row.timestamp)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: VaultEventRow) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header + filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-display text-2xl font-medium text-foreground">Vault History</h3>
        <div className="w-44">
          <Select
            options={TYPE_OPTIONS}
            value={typeFilter}
            onChange={handleTypeChange}
            placeholder="Filter by type"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable<VaultEventRow>
        columns={columns}
        data={tableData}
        loading={isLoadingAny}
        emptyMessage="No vault history found"
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
