'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ArrowDownUp,
  Settings,
  ChevronDown,
  ArrowLeftRight,
  Route,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { useFXQuote } from '@/hooks/useFXQuote';
import { useExecuteSwap } from '@/hooks/useExecuteSwap';
import { useOnChainSwap } from '@/hooks/useOnChainSwap';
import { useVaultBalances } from '@/hooks/useVaultBalances';
import { formatCurrency, shortenAddress } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { Skeleton } from '@/components/shared/Skeleton';
import { TOKEN_ADDRESSES } from '@/lib/contracts';

// ---------------------------------------------------------------------------
// Currency metadata
// ---------------------------------------------------------------------------

interface CurrencyMeta {
  code: string;
  display: string;
  color: string;
  symbol: string;
  fiatSymbol: string;
}

const CURRENCIES: CurrencyMeta[] = [
  { code: 'USDC', display: 'USDC', color: '#D4A853', symbol: '$', fiatSymbol: '$' },
  { code: 'EURC', display: 'EURe', color: '#7EC97A', symbol: '\u20AC', fiatSymbol: '\u20AC' },
];

function getCurrency(code: string): CurrencyMeta {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

// ---------------------------------------------------------------------------
// TokenBadge (pill-shaped currency indicator with inline dropdown)
// ---------------------------------------------------------------------------

interface TokenBadgeProps {
  currency: string;
  exclude: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}

function TokenBadge({ currency, exclude, onChange, disabled }: TokenBadgeProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = getCurrency(currency);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const options = CURRENCIES.filter((c) => c.code !== exclude);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={clsx(
          'inline-flex items-center gap-2 rounded-full px-3.5 py-2',
          'bg-[#262420] hover:bg-[#2E2C26] transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-[#C9A962]/30',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Select currency, current: ${meta.display}`}
      >
        <span
          className="flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold"
          style={{ backgroundColor: meta.color }}
        >
          {meta.symbol.length <= 2 ? meta.symbol : meta.symbol[0]}
        </span>
        <span className="text-sm font-semibold text-foreground whitespace-nowrap">
          {meta.display}
        </span>
        <ChevronDown
          className={clsx(
            'w-4 h-4 text-[#A09D95] transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={clsx(
            'absolute right-0 top-full mt-1 z-30 min-w-[200px] py-1 rounded-xl',
            'bg-[#232120] border border-[#383430] shadow-lg',
            'animate-fade-in',
          )}
          role="listbox"
        >
          {options.map((c) => {
            const isSelected = c.code === currency;
            return (
              <button
                key={c.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(c.code);
                  setOpen(false);
                }}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors',
                  isSelected
                    ? 'bg-[#C9A96215] text-[#C9A962]'
                    : 'text-foreground hover:bg-[#C9A96210]',
                )}
              >
                <span
                  className="flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: c.color }}
                >
                  {c.symbol.length <= 2 ? c.symbol : c.symbol[0]}
                </span>
                <span className="font-medium">{c.display}</span>
                <span className="text-[#A09D95] text-xs ml-auto">
                  {c.code}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CurrencyInputSection
// ---------------------------------------------------------------------------

interface CurrencyInputSectionProps {
  label: string;
  amount: string;
  onAmountChange?: (value: string) => void;
  currency: string;
  excludeCurrency: string;
  onCurrencyChange: (code: string) => void;
  fiatEquivalent: string;
  balance: string;
  readOnly?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
}

function CurrencyInputSection({
  label,
  amount,
  onAmountChange,
  currency,
  excludeCurrency,
  onCurrencyChange,
  fiatEquivalent,
  balance,
  readOnly = false,
  disabled = false,
  isLoading = false,
}: CurrencyInputSectionProps) {
  return (
    <div className="rounded-[14px] bg-[#0A0E1A] p-4 space-y-2">
      {/* Label */}
      <p className="text-[13px] text-[#A09D95]">{label}</p>

      {/* Amount + Token badge row */}
      <div className="flex items-center justify-between gap-3">
        {isLoading ? (
          <Skeleton variant="text" className="h-8 w-32" />
        ) : readOnly ? (
          <span
            className={clsx(
              'text-[28px] font-bold text-foreground leading-tight',
              !amount && 'text-[#A09D95]',
            )}
          >
            {amount || '0.00'}
          </span>
        ) : (
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => onAmountChange?.(e.target.value)}
            disabled={disabled}
            className={clsx(
              'bg-transparent text-[28px] font-bold text-foreground leading-tight',
              'placeholder:text-[#A09D95] outline-none w-full min-w-0',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
            aria-label={`${label} amount`}
          />
        )}
        <TokenBadge
          currency={currency}
          exclude={excludeCurrency}
          onChange={onCurrencyChange}
          disabled={disabled}
        />
      </div>

      {/* Fiat equivalent + Balance row */}
      <div className="flex items-center justify-between text-xs text-[#A09D95]">
        <span>{fiatEquivalent}</span>
        <span>{balance}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main FXSwapCard Component
// ---------------------------------------------------------------------------

export function FXSwapCard() {
  const { isConnected } = useAccount();
  const { liquidUSDC } = useVaultBalances();
  const executeSwap = useExecuteSwap();
  const onChainSwap = useOnChainSwap();

  // Local state
  const [fromCurrency, setFromCurrency] = useState('USDC');
  const [toCurrency, setToCurrency] = useState('EURC');
  const [fromAmount, setFromAmount] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the input amount before fetching a quote
  const debouncedAmount = useDebounce(fromAmount, 500);

  // Build the pair string
  const pair = `${fromCurrency}/${toCurrency}`;

  // Fetch quote
  const {
    data: quote,
    isLoading: quoteLoading,
    error: quoteError,
  } = useFXQuote(pair, debouncedAmount);

  // Compute "To" amount from quote
  const toAmount = useMemo(() => {
    if (!quote || !quote.toAmount) return '';
    return quote.toAmount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }, [quote]);

  // Available balance display
  const availableBalance = Number(liquidUSDC) / 1e6;

  // Countdown for quote expiry
  const [secondsLeft, setSecondsLeft] = useState(30);
  useEffect(() => {
    if (!quote?.expiresAt) return;
    const expiresAt = new Date(quote.expiresAt).getTime();
    const timer = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((expiresAt - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
    }, 1000);
    return () => clearInterval(timer);
  }, [quote?.expiresAt]);

  // Clear success/error messages after a delay
  useEffect(() => {
    if (successMsg) {
      successTimer.current = setTimeout(() => setSuccessMsg(''), 5000);
      return () => {
        if (successTimer.current) clearTimeout(successTimer.current);
      };
    }
  }, [successMsg]);

  // Handlers
  const handleFromAmountChange = useCallback((raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setFromAmount(cleaned);
    setErrorMsg('');
    setSuccessMsg('');
  }, []);

  const handleSwapDirection = useCallback(() => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setFromAmount('');
    setErrorMsg('');
    setSuccessMsg('');
  }, [fromCurrency, toCurrency]);

  const handleFromCurrencyChange = useCallback(
    (currency: string) => {
      setFromCurrency(currency);
      if (currency === toCurrency) {
        setToCurrency(fromCurrency);
      }
      setFromAmount('');
    },
    [toCurrency, fromCurrency],
  );

  const handleToCurrencyChange = useCallback(
    (currency: string) => {
      setToCurrency(currency);
      if (currency === fromCurrency) {
        setFromCurrency(toCurrency);
      }
    },
    [fromCurrency, toCurrency],
  );

  // Check if both tokens have on-chain addresses for real token movement
  const hasOnChainTokens = Boolean(TOKEN_ADDRESSES[fromCurrency] && TOKEN_ADDRESSES[toCurrency]);

  const handleExecute = useCallback(async () => {
    if (!quote) return;

    try {
      setErrorMsg('');

      let txHash: string | undefined;

      if (hasOnChainTokens) {
        // On-chain swap: approve + requestQuote + executeSwap on StableFX contract
        const amount = parseUnits(fromAmount, 6);
        const result = await onChainSwap.mutateAsync({
          fromCurrency,
          toCurrency,
          amount,
        });
        txHash = result.txHash;
      } else {
        // API-only swap (for pairs without deployed tokens)
        const result = await executeSwap.mutateAsync({
          quoteId: quote.id,
          fromCurrency,
          toCurrency,
          fromAmount,
        });
        txHash = result.txHash;
      }

      setSuccessMsg(
        `Swap executed! TX: ${txHash ? shortenAddress(txHash) : 'confirmed'}`,
      );
      setFromAmount('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Swap failed');
    }
  }, [quote, executeSwap, onChainSwap, fromCurrency, toCurrency, fromAmount, hasOnChainTokens]);

  // Disable conditions for the execute button
  const isSwapping = executeSwap.isPending || onChainSwap.isPending;
  const canExecute =
    isConnected &&
    !!quote &&
    secondsLeft > 0 &&
    !!fromAmount &&
    Number(fromAmount) > 0 &&
    !isSwapping;

  // Computed display values
  const fromMeta = getCurrency(fromCurrency);
  const toMeta = getCurrency(toCurrency);
  const numericFrom = Number(fromAmount) || 0;
  const numericTo = quote?.toAmount ?? 0;

  // Fee calculation from quote spread (default 0.1%)
  const feeRate = quote?.spread ?? 0.001;
  const feeAmount = numericFrom * feeRate;

  // CTA label
  const ctaLabel = !isConnected
    ? 'Connect Wallet to Swap'
    : isSwapping
      ? 'Processing...'
      : !fromAmount || numericFrom <= 0
        ? 'Enter an Amount'
        : !quote
          ? 'Fetching Quote...'
          : secondsLeft <= 0
            ? 'Quote Expired'
            : `Swap ${Number(fromAmount).toLocaleString()} ${fromMeta.display} \u2192 ${toMeta.display}`;

  const isQuoteLoading =
    quoteLoading && !!debouncedAmount && Number(debouncedAmount) > 0;

  return (
    <div
      className="rounded-[20px] p-6 bg-[#232120] border border-[#383430]"
      style={{
        boxShadow: '0 8px 60px rgba(212, 168, 83, 0.08)',
      }}
    >
        <div className="space-y-1">
          {/* ---- Header: Swap + Settings ---- */}
          <div className="flex items-center justify-between pb-3">
            <h2 className="text-xl font-bold text-foreground">Swap</h2>
            <button
              type="button"
              className={clsx(
                'flex items-center justify-center w-9 h-9 rounded-lg',
                'bg-[#262420] hover:bg-[#2E2C26] transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-[#C9A962]/30',
              )}
              aria-label="Swap settings"
            >
              <Settings className="w-[18px] h-[18px] text-[#A09D95]" />
            </button>
          </div>

          {/* ---- You Pay ---- */}
          <CurrencyInputSection
            label="You Pay"
            amount={fromAmount}
            onAmountChange={handleFromAmountChange}
            currency={fromCurrency}
            excludeCurrency={toCurrency}
            onCurrencyChange={handleFromCurrencyChange}
            fiatEquivalent={`\u2248 ${fromMeta.fiatSymbol}${numericFrom.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            balance={`Balance: ${formatCurrency(availableBalance, fromCurrency)}`}
            disabled={isSwapping}
          />

          {/* ---- Swap Direction Button ---- */}
          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={handleSwapDirection}
              className={clsx(
                'flex items-center justify-center w-10 h-10 rounded-full',
                'bg-[#232120] border-2 border-[#383430]',
                'hover:border-[#C9A96250] hover:bg-[#C9A96210] transition-all',
                'focus:outline-none focus:ring-2 focus:ring-[#C9A962]/30',
              )}
              aria-label="Swap currencies"
            >
              <ArrowDownUp className="w-[18px] h-[18px] text-[#C9A962]" />
            </button>
          </div>

          {/* ---- You Receive ---- */}
          <CurrencyInputSection
            label="You Receive"
            amount={toAmount}
            currency={toCurrency}
            excludeCurrency={fromCurrency}
            onCurrencyChange={handleToCurrencyChange}
            fiatEquivalent={`\u2248 ${toMeta.fiatSymbol}${numericTo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            balance={`Balance: ${formatCurrency(0, toCurrency)}`}
            readOnly
            isLoading={isQuoteLoading}
          />

          {/* ---- Exchange Details ---- */}
          {(quote || isQuoteLoading) && (
            <div className="space-y-2.5 py-3">
              {isQuoteLoading ? (
                <>
                  <Skeleton variant="text" className="h-4 w-48" />
                  <Skeleton variant="text" className="h-4 w-36" />
                  <Skeleton variant="text" className="h-4 w-28" />
                </>
              ) : quote ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#A09D95]">
                      Exchange Rate
                    </span>
                    <span className="text-[13px] font-medium text-foreground">
                      1 {fromMeta.display} = {quote.rate.toFixed(3)}{' '}
                      {toMeta.display}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#A09D95]">
                      Swap Fee
                    </span>
                    <span className="text-[13px] font-medium text-foreground">
                      {(feeRate * 100).toFixed(2)}% (~{fromMeta.fiatSymbol}
                      {feeAmount.toFixed(2)})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#A09D95]">
                      Price Impact
                    </span>
                    <span className="text-[13px] font-medium text-[#7EC97A]">
                      &lt;0.01%
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* ---- Quote error ---- */}
          {quoteError && debouncedAmount && Number(debouncedAmount) > 0 && (
            <p className="text-xs text-[#D46B6B] py-1">
              Failed to fetch quote. Retrying...
            </p>
          )}

          {/* ---- Success message ---- */}
          {successMsg && (
            <div className="flex items-center gap-2 p-3 bg-[#7EC97A]/10 rounded-xl text-sm text-[#7EC97A] border border-[#7EC97A]/20 animate-fade-in">
              {successMsg}
            </div>
          )}

          {/* ---- Error message ---- */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-[#D46B6B]/10 rounded-xl text-sm text-[#D46B6B] border border-[#D46B6B]/20 animate-fade-in">
              {errorMsg}
            </div>
          )}

          {/* ---- CTA Button ---- */}
          <button
            type="button"
            onClick={handleExecute}
            disabled={!canExecute}
            className={clsx(
              'w-full h-[52px] rounded-[14px] flex items-center justify-center gap-2',
              'text-base font-semibold transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-[#D4A853]/50 focus:ring-offset-2 focus:ring-offset-background',
              canExecute
                ? 'bg-[#D4A853] hover:brightness-110 text-white cursor-pointer'
                : 'bg-[#D4A853]/40 text-white/50 cursor-not-allowed',
            )}
          >
            {isSwapping && (
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {canExecute && !isSwapping && (
              <ArrowLeftRight className="w-[18px] h-[18px]" />
            )}
            <span>{ctaLabel}</span>
          </button>

          {/* ---- Route info footer ---- */}
          <div className="flex items-center justify-center gap-1.5 pt-2">
            <Route className="w-3.5 h-3.5 text-[#A09D95]" />
            <span className="text-xs text-[#A09D95]">
              {hasOnChainTokens ? 'On-chain via StableFX contract' : 'Off-chain via Circle StableFX API'}
            </span>
          </div>
        </div>
    </div>
  );
}
