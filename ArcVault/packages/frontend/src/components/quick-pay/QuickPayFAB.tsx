'use client';

import dynamic from 'next/dynamic';
import { useUIStore } from '@/stores/ui.store';
import { Plus } from 'lucide-react';

const QuickPayModal = dynamic(
  () => import('./QuickPayModal').then((m) => m.QuickPayModal),
  { ssr: false },
);

/**
 * Floating action button for Quick Pay, visible on every page.
 *
 * Renders at fixed bottom-right position (z-40) with a gold glassmorphism background.
 * Clicking opens the QuickPayModal via the UI Zustand store.
 * The modal is only mounted when open to avoid idle wagmi/RPC hook overhead.
 */
export function QuickPayFAB() {
  const isOpen = useUIStore((s) => s.quickPayOpen);
  const openQuickPay = useUIStore((s) => s.openQuickPay);

  return (
    <>
      <button
        onClick={openQuickPay}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center
                   justify-center rounded-full bg-[#2A2518]
                   border border-[#C9A96230] text-[#C9A962] shadow-lg shadow-[#C9A96220]
                   transition-all duration-200
                   hover:scale-105 hover:shadow-xl hover:bg-[#C9A96260] active:scale-95
                   focus:outline-none focus:ring-2 focus:ring-gold/50 focus:ring-offset-2 focus:ring-offset-background"
        aria-label="Quick Pay"
      >
        <Plus className="h-6 w-6" />
      </button>
      {isOpen && <QuickPayModal />}
    </>
  );
}
