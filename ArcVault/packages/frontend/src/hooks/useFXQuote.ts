import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { api } from '@/lib/api';
import type { FXQuote } from '@/types/api';

// Re-export for consumers
export type { FXQuote } from '@/types/api';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches a live FX quote for the given currency pair and amount.
 *
 * - Enabled only when `pair` and a positive `amount` are provided.
 * - staleTime and refetchInterval are set to 25 s so the UI refreshes
 *   before the 30 s quote expiry.
 * - The consuming component should debounce the `amount` input (500 ms)
 *   before passing it to this hook.
 */
export function useFXQuote(pair: string, amount: string) {
  return useQuery<FXQuote>({
    queryKey: queryKeys.fx.quote(pair, amount),
    queryFn: () => api.fx.getQuote({ pair, amount }),
    enabled: Boolean(pair) && Boolean(amount) && Number(amount) > 0,
    staleTime: 25_000,
    refetchInterval: 25_000,
  });
}
