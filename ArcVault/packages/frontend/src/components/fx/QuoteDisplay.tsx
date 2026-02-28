'use client';

import { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/shared/Skeleton';
import type { FXQuote } from '@/types/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuoteDisplayProps {
  quote: FXQuote | null | undefined;
  isLoading: boolean;
  fromCurrency: string;
  toCurrency: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuoteDisplay({
  quote,
  isLoading,
  fromCurrency,
  toCurrency,
}: QuoteDisplayProps) {
  const [secondsLeft, setSecondsLeft] = useState(30);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset countdown whenever a new quote arrives
  useEffect(() => {
    if (!quote?.expiresAt) {
      setSecondsLeft(0);
      return;
    }

    const expiresAt = new Date(quote.expiresAt).getTime();

    function tick() {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setSecondsLeft(remaining);
    }

    // Immediate tick
    tick();

    // Start interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [quote?.expiresAt]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-2 py-3">
        <Skeleton variant="text" className="h-4 w-48" />
        <Skeleton variant="text" className="h-4 w-32" />
        <Skeleton variant="text" className="h-4 w-24" />
      </div>
    );
  }

  // No quote
  if (!quote) {
    return null;
  }

  const isExpired = secondsLeft <= 0;
  const isWarning = secondsLeft <= 10 && secondsLeft > 0;

  // Format countdown as m:ss
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const countdownText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  // Use spread from quote (percentage), fallback to 0.1% default
  const spread = (quote.spread ?? 0.001) * 100;

  return (
    <div className="space-y-2 py-3 text-sm border-t border-[#383430]">
      {/* Rate */}
      <div className="flex items-center justify-between">
        <span className="text-[#A09D95]">Rate</span>
        <span className="font-medium text-[#C9A962]">
          1 {fromCurrency} = {quote.rate.toFixed(4)} {toCurrency}
        </span>
      </div>

      {/* Spread */}
      <div className="flex items-center justify-between">
        <span className="text-[#A09D95]">Spread</span>
        <span className="text-foreground">{spread.toFixed(2)}%</span>
      </div>

      {/* Countdown */}
      <div className="flex items-center justify-between">
        <span className="text-[#A09D95]">Quote expires</span>
        {isExpired ? (
          <span className="inline-flex items-center gap-1.5 text-[#A09D95]">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Refreshing...
          </span>
        ) : (
          <span
            className={clsx(
              'font-mono font-medium tabular-nums',
              isWarning ? 'text-[#E0A84C]' : 'text-foreground',
            )}
          >
            {countdownText}
          </span>
        )}
      </div>
    </div>
  );
}
