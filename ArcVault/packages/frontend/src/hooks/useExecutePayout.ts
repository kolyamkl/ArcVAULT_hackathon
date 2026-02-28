import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWriteContract, usePublicClient } from 'wagmi';
import { queryKeys } from '@/lib/queryKeys';
import {
  PAYOUT_ROUTER_ADDRESS,
  PayoutRouterABI,
} from '@/lib/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExecutePayoutParams {
  recipient: `0x${string}`;
  amount: bigint;
  targetCurrency: `0x${string}`; // bytes32
  reference: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Execute a single payout through the PayoutRouter contract.
 *
 * Contract: PayoutRouter.executePayout(recipient, amount, targetCurrency, reference)
 *
 * On success, invalidates payout list, vault balances, and dashboard queries.
 */
export function useExecutePayout() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recipient,
      amount,
      targetCurrency,
      reference,
    }: ExecutePayoutParams) => {
      if (!publicClient) throw new Error('Wallet not connected');

      const hash = await writeContractAsync({
        address: PAYOUT_ROUTER_ADDRESS,
        abi: PayoutRouterABI,
        functionName: 'executePayout',
        args: [recipient, amount, targetCurrency, reference as `0x${string}`],
      });
      return await publicClient.waitForTransactionReceipt({ hash });
    },
    onSuccess: () => {
      // Invalidate all payout lists (regardless of filter params)
      queryClient.invalidateQueries({ queryKey: ['payouts', 'list'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.balances });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
