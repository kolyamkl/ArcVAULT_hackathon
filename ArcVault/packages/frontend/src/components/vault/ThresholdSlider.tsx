'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { Input } from '@/components/shared/Input';
import { Button } from '@/components/shared/Button';
import { Skeleton } from '@/components/shared/Skeleton';
import { formatCurrency } from '@/lib/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThresholdSliderProps {
  /** Current on-chain threshold (USD). */
  currentThreshold: number;
  /** Current liquid USDC balance (USD). */
  liquidBalance: number;
  /** Current USYC position value (USD). */
  usycBalance: number;
  /** Total vault value (USD). */
  totalValue: number;
  /** Callback when user commits a new threshold. */
  onUpdateThreshold: (newThreshold: number) => void;
  /** True while the threshold-update transaction is pending. */
  isUpdating: boolean;
  /** False if user lacks CFO_ROLE. */
  canUpdate: boolean;
  /** Loading state. */
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Snap increment
// ---------------------------------------------------------------------------

const SNAP_INCREMENT = 1_000;

function snapToIncrement(value: number, max: number): number {
  const snapped = Math.round(value / SNAP_INCREMENT) * SNAP_INCREMENT;
  return Math.max(0, Math.min(snapped, max));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThresholdSlider({
  currentThreshold,
  liquidBalance,
  usycBalance,
  totalValue,
  onUpdateThreshold,
  isUpdating,
  canUpdate,
  loading = false,
}: ThresholdSliderProps) {
  const [proposedThreshold, setProposedThreshold] = useState(currentThreshold);
  const [inputValue, setInputValue] = useState(String(currentThreshold));
  const [isDragging, setIsDragging] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // Sync when on-chain value changes
  useEffect(() => {
    if (!isDragging) {
      setProposedThreshold(currentThreshold);
      setInputValue(String(currentThreshold));
    }
  }, [currentThreshold, isDragging]);

  // Derived values
  const hasChanged = proposedThreshold !== currentThreshold;
  const maxThreshold = totalValue > 0 ? totalValue : 1_000_000;
  const thresholdPct = totalValue > 0 ? (proposedThreshold / totalValue) * 100 : 50;
  const usycPct = 100 - thresholdPct;

  // Impact preview calculations
  const impactPreview = useMemo(() => {
    if (!hasChanged) return null;

    const diff = proposedThreshold - liquidBalance;

    if (diff > 0) {
      // Need to redeem from USYC
      return {
        action: 'redeem' as const,
        redeemAmount: diff,
        newLiquid: proposedThreshold,
        newUSYC: usycBalance - diff,
      };
    } else {
      // Excess liquid swept to USYC
      const excessAmount = Math.abs(diff);
      return {
        action: 'sweep' as const,
        sweepAmount: excessAmount,
        newLiquid: proposedThreshold,
        newUSYC: usycBalance + excessAmount,
      };
    }
  }, [hasChanged, proposedThreshold, liquidBalance, usycBalance]);

  // Drag logic
  const updateFromPosition = useCallback(
    (clientX: number) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      // The handle represents the split: left = USYC, right = Liquid
      // So threshold = pct * totalValue from the right, i.e., (1 - pct) * totalValue
      const raw = pct * totalValue;
      const snapped = snapToIncrement(raw, maxThreshold);
      setProposedThreshold(snapped);
      setInputValue(String(snapped));
    },
    [totalValue, maxThreshold],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!canUpdate) return;
      e.preventDefault();
      setIsDragging(true);
      updateFromPosition(e.clientX);
    },
    [canUpdate, updateFromPosition],
  );

  useEffect(() => {
    if (!isDragging) return;

    function handleMouseMove(e: MouseEvent) {
      updateFromPosition(e.clientX);
    }

    function handleMouseUp() {
      setIsDragging(false);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, updateFromPosition]);

  // Touch support
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!canUpdate) return;
      setIsDragging(true);
      updateFromPosition(e.touches[0].clientX);
    },
    [canUpdate, updateFromPosition],
  );

  useEffect(() => {
    if (!isDragging) return;

    function handleTouchMove(e: TouchEvent) {
      updateFromPosition(e.touches[0].clientX);
    }

    function handleTouchEnd() {
      setIsDragging(false);
    }

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, updateFromPosition]);

  // Manual input handler
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^0-9]/g, '');
      setInputValue(raw);
      const num = parseInt(raw, 10);
      if (!isNaN(num)) {
        const clamped = Math.max(0, Math.min(num, maxThreshold));
        setProposedThreshold(clamped);
      }
    },
    [maxThreshold],
  );

  const handleInputBlur = useCallback(() => {
    const snapped = snapToIncrement(proposedThreshold, maxThreshold);
    setProposedThreshold(snapped);
    setInputValue(String(snapped));
  }, [proposedThreshold, maxThreshold]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="text" className="h-6 w-48" />
        <Skeleton variant="rectangular" className="h-10 w-full rounded-lg" />
        <div className="flex gap-4">
          <Skeleton variant="text" className="h-10 w-40" />
          <Skeleton variant="rectangular" className="h-10 w-36 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Title */}
      <h3 className="font-display text-2xl font-medium text-foreground">Liquidity Allocation</h3>

      {/* Visual allocation bar */}
      <div className="space-y-2">
        <div
          ref={barRef}
          className={clsx(
            'relative h-10 rounded-lg overflow-visible flex cursor-pointer select-none',
            !canUpdate && 'opacity-60 cursor-not-allowed',
          )}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={maxThreshold}
          aria-valuenow={proposedThreshold}
          aria-label="Liquidity threshold"
          tabIndex={canUpdate ? 0 : -1}
        >
          {/* USYC portion (left) */}
          <div
            className="h-full bg-[#B08D3E]/50 rounded-l-lg flex items-center justify-center relative"
            style={{ width: `${Math.max(usycPct, 5)}%` }}
          >
            {usycPct > 20 && (
              <span className="text-xs font-medium text-white/90 whitespace-nowrap px-2">
                USYC: {formatCurrency(totalValue - proposedThreshold, { compact: true })}
              </span>
            )}
          </div>

          {/* Liquid USDC portion (right) */}
          <div
            className="h-full bg-[#C9A962]/70 rounded-r-lg flex items-center justify-center relative"
            style={{ width: `${Math.max(thresholdPct, 5)}%` }}
          >
            {thresholdPct > 20 && (
              <span className="text-xs font-medium text-[#0A0A0A] whitespace-nowrap px-2">
                Liquid: {formatCurrency(proposedThreshold, { compact: true })}
              </span>
            )}
          </div>

          {/* Drag handle */}
          {canUpdate && (
            <div
              className={clsx(
                'absolute top-1/2 -translate-y-1/2 -translate-x-1/2',
                'w-5 h-5 rounded-full bg-[#C9A962] border-2 border-[#D4A853] shadow-md',
                'transition-shadow duration-100',
                isDragging && 'shadow-lg ring-2 ring-[#C9A96240]',
                'z-10',
              )}
              style={{ left: `${thresholdPct}%` }}
            />
          )}
        </div>

        {/* Labels below the bar */}
        <div className="flex justify-between text-xs text-[#A09D95]">
          <span>0% Liquid</span>
          <span>100% Liquid</span>
        </div>
      </div>

      {/* Threshold input + update button */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-48">
          <Input
            label="Threshold"
            prefix="$"
            value={Number(inputValue).toLocaleString('en-US')}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            disabled={!canUpdate || isUpdating}
            aria-label="Liquidity threshold amount"
          />
        </div>

        <Button
          variant="primary"
          onClick={() => onUpdateThreshold(proposedThreshold)}
          disabled={!hasChanged || !canUpdate || isUpdating}
          loading={isUpdating}
        >
          Update Threshold
        </Button>

        {!canUpdate && (
          <p className="text-xs text-muted">
            Requires CFO role to update the threshold
          </p>
        )}
      </div>

      {/* Impact preview */}
      {hasChanged && impactPreview && (
        <div className="bg-[#C9A96215] border border-[#C9A96230] rounded-lg p-4 text-sm space-y-1 animate-fade-in">
          <p className="font-medium text-[#C9A962] mb-2">Impact Preview</p>

          {impactPreview.action === 'redeem' ? (
            <p className="text-muted">
              {formatCurrency(impactPreview.redeemAmount)} would be redeemed from USYC to
              bring liquid balance to {formatCurrency(impactPreview.newLiquid)}
            </p>
          ) : (
            <p className="text-muted">
              {formatCurrency(impactPreview.sweepAmount)} excess would be swept from liquid
              to USYC
            </p>
          )}

          <p className="text-muted">
            New liquid balance:{' '}
            <span className="text-foreground font-medium">
              {formatCurrency(impactPreview.newLiquid)}
            </span>
          </p>
          <p className="text-muted">
            New USYC position:{' '}
            <span className="text-foreground font-medium">
              {formatCurrency(Math.max(0, impactPreview.newUSYC))}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
