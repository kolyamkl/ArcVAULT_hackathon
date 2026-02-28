import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWriteContract, usePublicClient } from 'wagmi';
import { queryKeys } from '@/lib/queryKeys';
import {
  TREASURY_VAULT_ADDRESS,
  TreasuryVaultABI,
} from '@/lib/contracts';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Withdraw funds from TreasuryVault.
 * Requires TREASURY_MANAGER_ROLE on-chain.
 *
 * Contract: TreasuryVault.withdrawFunds(amount)
 */
export function useWithdraw() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ amount }: { amount: bigint }) => {
      if (!publicClient) throw new Error('Wallet not connected');

      const hash = await writeContractAsync({
        address: TREASURY_VAULT_ADDRESS,
        abi: TreasuryVaultABI,
        functionName: 'withdrawFunds',
        args: [amount],
      });
      return await publicClient.waitForTransactionReceipt({ hash });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.balances });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
