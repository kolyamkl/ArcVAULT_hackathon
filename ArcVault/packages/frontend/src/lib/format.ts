// ---------------------------------------------------------------------------
// Formatting utilities for currency, percentage, time, and addresses.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Currency symbols
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOLS: Record<string, string> = {
  USDC: '$',
  EURC: '\u20AC',   // Euro sign
  GBPC: '\u00A3',   // Pound sign
  JPYC: '\u00A5',   // Yen sign
  CADC: 'CA$',
};

// ---------------------------------------------------------------------------
// Currency formatting
// ---------------------------------------------------------------------------

/**
 * Format a number as currency with the appropriate symbol.
 *
 * Accepts a currency code string OR an options object as the second parameter.
 *
 * @example formatCurrency(1245000)                         => "$1,245,000.00"
 * @example formatCurrency(9234.5, 'EURC')                  => "€9,234.50"
 * @example formatCurrency(1245000, { compact: true })       => "$1.2M"
 * @example formatCurrency(4230, { decimals: 0 })            => "$4,230"
 * @example formatCurrency(1000000n)                         => "$1.00"
 */
export function formatCurrency(
  amount: number | string | bigint,
  currencyOrOptions?: string | { compact?: boolean; decimals?: number },
): string {
  const num =
    typeof amount === 'bigint'
      ? Number(amount) / 1e6
      : Number(amount);

  let symbol = '$';
  let decimals = 2;
  let compact = false;

  if (typeof currencyOrOptions === 'string') {
    symbol = CURRENCY_SYMBOLS[currencyOrOptions] ?? '$';
  } else if (currencyOrOptions) {
    decimals = currencyOrOptions.decimals ?? 2;
    compact = currencyOrOptions.compact ?? false;
  }

  if (compact) {
    if (Math.abs(num) >= 1_000_000_000) return `${symbol}${(num / 1_000_000_000).toFixed(1)}B`;
    if (Math.abs(num) >= 1_000_000) return `${symbol}${(num / 1_000_000).toFixed(1)}M`;
    if (Math.abs(num) >= 1_000) return `${symbol}${(num / 1_000).toFixed(1)}K`;
    return `${symbol}${num.toFixed(decimals)}`;
  }

  return `${symbol}${num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

// ---------------------------------------------------------------------------
// Compact number formatting
// ---------------------------------------------------------------------------

/**
 * Format a number in compact notation.
 *
 * @example formatCompact(1245000)  => "$1.2M"
 * @example formatCompact(5000)     => "$5.0K"
 */
export function formatCompact(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// APY formatting
// ---------------------------------------------------------------------------

/**
 * Format an APY percentage value.
 *
 * @example formatAPY(4.85) => "4.85%"
 */
export function formatAPY(apy: number): string {
  return `${apy.toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Percentage formatting
// ---------------------------------------------------------------------------

/**
 * Format a number as a percentage.
 *
 * @example formatPercentage(4.85)    => "4.85%"
 * @example formatPercentage(4.8, 1)  => "4.8%"
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

// ---------------------------------------------------------------------------
// Relative time formatting
// ---------------------------------------------------------------------------

/**
 * Format an ISO timestamp as relative time.
 *
 * @example formatRelativeTime("2024-01-15T10:30:00Z") => "2 min ago"
 */
export function formatRelativeTime(timestamp: string | Date): string {
  const now = new Date();
  const d = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin === 1) return '1 min ago';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr === 1) return '1 hr ago';
  if (diffHr < 24) return `${diffHr} hrs ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Address formatting
// ---------------------------------------------------------------------------

/**
 * Shorten an Ethereum address for display.
 *
 * @example shortenAddress("0xABCDEF1234567890ABCDEF1234567890ABCDEF12")
 *          => "0xABCD...EF12"
 */
export function shortenAddress(address: string, chars = 4): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/** Alias for {@link shortenAddress}. */
export const truncateAddress = shortenAddress;

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

/**
 * Format a date as a readable string.
 *
 * @example formatDate("2024-01-15T10:30:00Z") => "Jan 15, 2024"
 */
export function formatDate(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a date with time.
 *
 * @example formatDateTime("2024-01-15T10:30:00Z") => "Jan 15, 2024 10:30 AM"
 */
export function formatDateTime(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
