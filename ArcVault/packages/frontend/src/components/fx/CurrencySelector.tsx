'use client';

import { useMemo } from 'react';
import { Select } from '@/components/shared/Select';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CurrencySelectorProps {
  value: string;
  onChange: (currency: string) => void;
  /** Currency code to exclude from the options (prevents same-pair selection). */
  exclude?: string;
  label?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Supported currencies
// ---------------------------------------------------------------------------

interface CurrencyInfo {
  code: string;
  flag: string;
  name: string;
}

const CURRENCIES: CurrencyInfo[] = [
  { code: 'USDC', flag: '\uD83C\uDDFA\uD83C\uDDF8', name: 'US Dollar Coin' },
  { code: 'EURC', flag: '\uD83C\uDDEA\uD83C\uDDFA', name: 'Euro Coin' },
  { code: 'GBPC', flag: '\uD83C\uDDEC\uD83C\uDDE7', name: 'British Pound Coin' },
  { code: 'JPYC', flag: '\uD83C\uDDEF\uD83C\uDDF5', name: 'Japanese Yen Coin' },
  { code: 'CADC', flag: '\uD83C\uDDE8\uD83C\uDDE6', name: 'Canadian Dollar Coin' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CurrencySelector({
  value,
  onChange,
  exclude,
  label,
  className,
}: CurrencySelectorProps) {
  const options = useMemo(
    () =>
      CURRENCIES
        .filter((c) => c.code !== exclude)
        .map((c) => ({
          label: `${c.flag} ${c.code} — ${c.name}`,
          value: c.code,
        })),
    [exclude],
  );

  return (
    <Select
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Select currency"
      className={className}
    />
  );
}

/**
 * Get the flag emoji for a currency code.
 */
export function getCurrencyFlag(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.flag ?? '';
}
