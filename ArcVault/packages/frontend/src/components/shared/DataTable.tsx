'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from './Skeleton';

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onSort,
  pagination,
  loading = false,
  emptyMessage = 'No data found',
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function handleSort(key: string) {
    if (!onSort) return;
    const newDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortDir(newDir);
    onSort(key, newDir);
  }

  const totalPages = pagination
    ? Math.ceil(pagination.total / pagination.pageSize)
    : 0;

  const skeletonRows = Array.from({ length: pagination?.pageSize || 5 });

  return (
    <div className={clsx('w-full', className)}>
      <div className="overflow-x-auto rounded-xl border border-[#2A2A2A]">
        <table className="w-full">
          {/* Header */}
          <thead>
            <tr className="bg-transparent">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted',
                    col.sortable && 'cursor-pointer select-none hover:text-foreground transition-colors'
                  )}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span className="inline-flex flex-col">
                        <ChevronUp
                          className={clsx(
                            'h-3 w-3 -mb-1',
                            sortKey === col.key && sortDir === 'asc'
                              ? 'text-primary'
                              : 'text-muted/40'
                          )}
                        />
                        <ChevronDown
                          className={clsx(
                            'h-3 w-3 -mt-1',
                            sortKey === col.key && sortDir === 'desc'
                              ? 'text-primary'
                              : 'text-muted/40'
                          )}
                        />
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {loading
              ? skeletonRows.map((_, rowIdx) => (
                  <tr key={rowIdx} className="border-t border-[#2A2A2A]">
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        <Skeleton variant="text" className="h-4 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              : data.length === 0
                ? (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="px-4 py-12 text-center text-muted text-sm"
                      >
                        {emptyMessage}
                      </td>
                    </tr>
                  )
                : data.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className={clsx(
                        'border-t border-[#2A2A2A] transition-colors',
                        'hover:bg-[#C9A96208]',
                        rowIdx % 2 === 1 && 'bg-[#23212080]'
                      )}
                    >
                      {columns.map((col) => (
                        <td key={col.key} className="px-4 py-3 text-sm text-foreground">
                          {col.render
                            ? col.render(row)
                            : (row[col.key] as React.ReactNode) ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-sm text-muted">
            Page {pagination.page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                'hover:bg-[#C9A96215] text-foreground',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= totalPages}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                'hover:bg-[#C9A96215] text-foreground',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
