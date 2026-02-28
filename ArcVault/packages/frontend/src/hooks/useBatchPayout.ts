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

export interface BatchPayoutParams {
  recipients: `0x${string}`[];
  amounts: bigint[];
  currencies: `0x${string}`[]; // bytes32[]
  references: string[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Execute a batch payout through the PayoutRouter contract.
 *
 * Contract: PayoutRouter.batchPayout(recipients[], amounts[], currencies[], references[])
 *
 * On success, invalidates payout list, vault balances, and dashboard queries.
 */
export function useBatchPayout() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recipients,
      amounts,
      currencies,
      references,
    }: BatchPayoutParams) => {
      if (!publicClient) throw new Error('Wallet not connected');

      const hash = await writeContractAsync({
        address: PAYOUT_ROUTER_ADDRESS,
        abi: PayoutRouterABI,
        functionName: 'batchPayout',
        args: [recipients, amounts, currencies, references as readonly `0x${string}`[]],
      });
      return await publicClient.waitForTransactionReceipt({ hash });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts', 'list'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.balances });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
