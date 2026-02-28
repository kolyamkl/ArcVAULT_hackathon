'use client';

import { useState } from 'react';
import { Search, Download } from 'lucide-react';
import { clsx } from 'clsx';

interface Transaction {
  id: string;
  type: 'Deposit' | 'Withdrawal' | 'Yield' | 'Swap' | 'Payout';
  date: string;
  amount: string;
  status: 'Confirmed' | 'Pending' | 'Failed';
  txHash: string;
}

const TYPE_COLORS: Record<string, string> = {
  Deposit: 'bg-[#4ADE8020] text-[#4ADE80]',
  Withdrawal: 'bg-[#EF444420] text-[#EF4444]',
  Yield: 'bg-[#C9A96220] text-[#C9A962]',
  Swap: 'bg-[#60A5FA20] text-[#60A5FA]',
  Payout: 'bg-[#A78BFA20] text-[#A78BFA]',
};

const STATUS_COLORS: Record<string, string> = {
  Confirmed: 'text-[#4ADE80]',
  Pending: 'text-[#C9A962]',
  Failed: 'text-[#EF4444]',
};

// Sample data
const SAMPLE_TXS: Transaction[] = [
  { id: '1', type: 'Deposit', date: '2026-02-28 14:32', amount: '$50,000.00', status: 'Confirmed', txHash: '0x1a2b...3c4d' },
  { id: '2', type: 'Yield', date: '2026-02-27 09:00', amount: '$128.50', status: 'Confirmed', txHash: '0x5e6f...7a8b' },
  { id: '3', type: 'Payout', date: '2026-02-26 16:45', amount: '$12,500.00', status: 'Confirmed', txHash: '0x9c0d...1e2f' },
  { id: '4', type: 'Swap', date: '2026-02-25 11:20', amount: '$8,000.00', status: 'Confirmed', txHash: '0x3a4b...5c6d' },
  { id: '5', type: 'Withdrawal', date: '2026-02-24 08:15', amount: '$25,000.00', status: 'Pending', txHash: '0x7e8f...9a0b' },
];

export function TransactionHistoryTable() {
  const [search, setSearch] = useState('');

  const filtered = SAMPLE_TXS.filter(
    (tx) =>
      tx.type.toLowerCase().includes(search.toLowerCase()) ||
      tx.txHash.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="bg-[#16161480] border border-[#C9A96212] rounded-xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-semibold text-foreground">Transaction History</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="bg-[#0A0A0A60] border border-[#2A2A2A] rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-[#C9A96250] w-40"
            />
          </div>
          <button aria-label="Download transaction history" className="p-1.5 rounded-lg border border-[#2A2A2A] text-muted hover:text-foreground transition-colors">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted text-xs">
              <th className="pb-3 pr-4 w-[100px] font-medium">Type</th>
              <th className="pb-3 pr-4 w-[180px] font-medium">Date</th>
              <th className="pb-3 pr-4 font-medium">Amount</th>
              <th className="pb-3 pr-4 w-[120px] font-medium">Status</th>
              <th className="pb-3 w-[120px] font-medium">TX Hash</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx) => (
              <tr key={tx.id} className="border-t border-[#1F1F1F]">
                <td className="py-3 pr-4">
                  <span
                    className={clsx(
                      'inline-block px-2 py-0.5 rounded text-xs font-medium',
                      TYPE_COLORS[tx.type] ?? 'bg-[#2A2A2A] text-muted',
                    )}
                  >
                    {tx.type}
                  </span>
                </td>
                <td className="py-3 pr-4 text-muted">{tx.date}</td>
                <td className="py-3 pr-4 text-foreground font-medium">{tx.amount}</td>
                <td className="py-3 pr-4">
                  <span className={clsx('flex items-center gap-1.5 text-xs font-medium', STATUS_COLORS[tx.status])}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {tx.status}
                  </span>
                </td>
                <td className="py-3">
                  <span className="text-[#C9A962] text-xs font-medium cursor-pointer hover:underline">
                    {tx.txHash}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
