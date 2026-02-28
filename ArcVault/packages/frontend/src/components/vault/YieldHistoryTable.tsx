'use client';

import { useState, useCallback, useMemo } from 'react';
import { DataTable } from '@/components/shared/DataTable';
import { formatCurrency, formatPercentage, formatDate } from '@/lib/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface YieldHistoryRow {
  date: string;
  dailyYield: number;
  cumulativeYield: number;
  apy: number;
  [key: string]: unknown;
}

interface YieldHistoryTableProps {
  data: Array<{
    date: string;
    dailyYield: number;
    cumulativeYield: number;
    apy?: number;
  }>;
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function YieldHistoryTable({ data, loading = false }: YieldHistoryTableProps) {
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = useCallback((key: string, dir: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(dir);
  }, []);

  // Sort and paginate the data
  const processedData = useMemo(() => {
    const rows: YieldHistoryRow[] = data.map((d) => ({
      date: d.date,
      dailyYield: d.dailyYield,
      cumulativeYield: d.cumulativeYield,
      apy: d.apy ?? 0,
    }));

    rows.sort((a, b) => {
      const aVal = a[sortKey as keyof YieldHistoryRow];
      const bVal = b[sortKey as keyof YieldHistoryRow];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      const numA = Number(aVal);
      const numB = Number(bVal);
      return sortDir === 'asc' ? numA - numB : numB - numA;
    });

    return rows;
  }, [data, sortKey, sortDir]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return processedData.slice(start, start + PAGE_SIZE);
  }, [processedData, page]);

  const columns = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (row: YieldHistoryRow) => (
        <span className="text-sm text-foreground">{formatDate(row.date)}</span>
      ),
    },
    {
      key: 'dailyYield',
      header: 'Daily Yield',
      sortable: true,
      render: (row: YieldHistoryRow) => (
        <span className="text-sm font-medium text-[#7EC97A]">
          +{formatCurrency(row.dailyYield, { decimals: 2 })}
        </span>
      ),
    },
    {
      key: 'cumulativeYield',
      header: 'Cumulative',
      sortable: true,
      render: (row: YieldHistoryRow) => (
        <span className="text-sm text-foreground">
          {formatCurrency(row.cumulativeYield, { decimals: 2 })}
        </span>
      ),
    },
    {
      key: 'apy',
      header: 'APY',
      sortable: true,
      render: (row: YieldHistoryRow) => (
        <span className="text-sm text-foreground">{formatPercentage(row.apy)}</span>
      ),
    },
  ];

  return (
    <div className="mt-6">
      <h4 className="font-display text-lg font-medium text-foreground mb-3">
        Yield History
      </h4>
      <DataTable<YieldHistoryRow>
        columns={columns}
        data={paginatedData}
        onSort={handleSort}
        loading={loading}
        emptyMessage="No yield history available"
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total: processedData.length,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
