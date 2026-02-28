'use client';

import { FXSwapCard } from '@/components/fx/FXSwapCard';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * FX Conversion page.
 *
 * The swap card is vertically and horizontally centered in the viewport
 * to match the Pencil design (no history table on this screen).
 */
export default function FXPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] px-4 animate-fade-in">
      <div className="w-full max-w-[480px]">
        <FXSwapCard />
      </div>
    </div>
  );
}
