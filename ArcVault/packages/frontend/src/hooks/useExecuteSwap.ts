import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExecuteSwapParams {
  quoteId: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
}

export interface SwapResult {
  txHash: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  status: 'success' | 'failed';
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Execute an FX swap through the backend API (not a direct contract write).
 * The StableFX interaction is routed server-side.
 *
 * Endpoint: POST /api/fx/execute
 *
 * On success, invalidates FX history and vault balance queries.
 */
export function useExecuteSwap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      quoteId,
      fromCurrency,
      toCurrency,
      fromAmount,
    }: ExecuteSwapParams): Promise<SwapResult> => {
      const res = await fetch('/api/fx/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId, fromCurrency, toCurrency, fromAmount }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API Error ${res.status}: ${text}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fx', 'history'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.balances });
    },
  });
}
