'use client';

import { useState, useCallback } from 'react';
import { ExternalLink, ArrowRightLeft } from 'lucide-react';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useFXHistory } from '@/hooks/useFXHistory';
import { formatCurrency, shortenAddress } from '@/lib/utils';
import { formatRelativeTime, truncateAddress } from '@/lib/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FXHistoryRow {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  status: string;
  txHash: string;
  createdAt: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10;
const EXPLORER_URL = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || 'https://testnet-explorer.arc.io';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FXHistoryTable() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useFXHistory({ page, limit: PAGE_SIZE });

  const tableData: FXHistoryRow[] = (data?.entries ?? []).map((entry) => ({
    id: entry.id,
    fromCurrency: entry.fromCurrency,
    toCurrency: entry.toCurrency,
    fromAmount: entry.fromAmount,
    toAmount: entry.toAmount,
    rate: entry.rate,
    status: entry.status,
    txHash: entry.txHash,
    createdAt: entry.createdAt,
  }));

  const columns = [
    {
      key: 'pair',
      header: 'Pair',
      render: (row: FXHistoryRow) => (
        <span className="text-sm font-medium text-foreground">
          {row.fromCurrency}/{row.toCurrency}
        </span>
      ),
    },
    {
      key: 'rate',
      header: 'Rate',
      render: (row: FXHistoryRow) => (
        <span className="text-sm text-foreground">{row.rate.toFixed(4)}</span>
      ),
    },
    {
      key: 'fromAmount',
      header: 'From',
      render: (row: FXHistoryRow) => (
        <span className="text-sm text-foreground">
          {formatCurrency(row.fromAmount, row.fromCurrency)}
        </span>
      ),
    },
    {
      key: 'toAmount',
      header: 'To',
      render: (row: FXHistoryRow) => (
        <span className="text-sm text-foreground">
          {formatCurrency(row.toAmount, row.toCurrency)}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Time',
      render: (row: FXHistoryRow) => (
        <span className="text-sm text-muted">
          {formatRelativeTime(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: FXHistoryRow) => <StatusBadge status={row.status} />,
    },
    {
      key: 'txHash',
      header: 'TX',
      render: (row: FXHistoryRow) =>
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
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <h3 className="font-display text-2xl font-medium text-foreground tracking-tight">Transaction History</h3>

      {/* Empty state */}
      {!isLoading && tableData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#A09D95] border border-[#383430] rounded-xl bg-transparent">
          <ArrowRightLeft className="w-10 h-10 mb-3 text-[#C9A962] opacity-30" />
          <p className="text-sm">No FX conversions yet</p>
        </div>
      ) : (
        <DataTable<FXHistoryRow>
          columns={columns}
          data={tableData}
          loading={isLoading}
          emptyMessage="No FX conversions yet"
          pagination={{
            page,
            pageSize: PAGE_SIZE,
            total: data?.total ?? 0,
            onPageChange: setPage,
          }}
        />
      )}
    </div>
  );
}
