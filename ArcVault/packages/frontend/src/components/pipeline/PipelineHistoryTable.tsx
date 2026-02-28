'use client';

import { useState, useCallback } from 'react';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Select } from '@/components/shared/Select';
import { usePipelineHistory } from '@/hooks/usePipelineHistory';
import { usePipelineStore } from '@/stores/pipeline.store';
import { formatCurrency, formatDateTime, shortenAddress } from '@/lib/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExecutionRow {
  id: string;
  status: string;
  totalCost: number;
  triggeredBy: string;
  startedAt: string;
  duration: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { label: 'All Statuses', value: 'ALL' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Failed', value: 'FAILED' },
  { label: 'Running', value: 'RUNNING' },
  { label: 'Partial Failure', value: 'PARTIAL_FAILURE' },
];

function computeDuration(startedAt: string, completedAt?: string): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diffMs = end - start;

  if (diffMs < 1000) return '<1s';
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PipelineHistoryTable() {
  const currentPipelineId = usePipelineStore((s) => s.currentPipelineId);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data, isLoading } = usePipelineHistory(currentPipelineId, {
    page,
    limit: PAGE_SIZE,
  });

  const handleStatusChange = useCallback((value: string) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  if (!currentPipelineId) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Select a pipeline to view execution history.
      </div>
    );
  }

  const filtered = (data?.executions ?? []).filter(
    (e) => statusFilter === 'ALL' || e.status === statusFilter,
  );

  const tableData: ExecutionRow[] = filtered.map((entry) => ({
    id: entry.id,
    status: entry.status,
    totalCost: entry.totalCost ?? 0,
    triggeredBy: entry.triggeredBy ?? '',
    startedAt: entry.startedAt,
    duration: computeDuration(entry.startedAt, entry.completedAt),
  }));

  const columns = [
    {
      key: 'status',
      header: 'Status',
      width: '160px',
      render: (row: ExecutionRow) => <StatusBadge status={row.status} />,
    },
    {
      key: 'totalCost',
      header: 'Cost',
      render: (row: ExecutionRow) => (
        <span className="text-sm font-medium text-foreground">
          {formatCurrency(row.totalCost, { decimals: 2 })}
        </span>
      ),
    },
    {
      key: 'triggeredBy',
      header: 'Triggered By',
      render: (row: ExecutionRow) => (
        <span className="text-sm text-muted">
          {row.triggeredBy ? shortenAddress(row.triggeredBy) : '-'}
        </span>
      ),
    },
    {
      key: 'startedAt',
      header: 'Started',
      sortable: true,
      render: (row: ExecutionRow) => (
        <span className="text-sm text-muted">{formatDateTime(row.startedAt)}</span>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (row: ExecutionRow) => (
        <span className="text-sm text-muted">{row.duration}</span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4 h-full overflow-y-auto">
      {/* Header + filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-display text-2xl font-medium text-foreground">
          Execution History
        </h3>
        <div className="w-48">
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={handleStatusChange}
            placeholder="Filter by status"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable<ExecutionRow>
        columns={columns}
        data={tableData}
        loading={isLoading}
        emptyMessage="No executions found"
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
