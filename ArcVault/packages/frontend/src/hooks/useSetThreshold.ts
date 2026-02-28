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
 * Set the liquidity threshold on TreasuryVault.
 * Requires CFO_ROLE on-chain.
 *
 * Contract: TreasuryVault.setLiquidityThreshold(newThreshold)
 */
export function useSetThreshold() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ threshold }: { threshold: bigint }) => {
      if (!publicClient) throw new Error('Wallet not connected');

      const hash = await writeContractAsync({
        address: TREASURY_VAULT_ADDRESS,
        abi: TreasuryVaultABI,
        functionName: 'setLiquidityThreshold',
        args: [threshold],
      });
      return await publicClient.waitForTransactionReceipt({ hash });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.balances });
    },
  });
}
