import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWriteContract, usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
import { queryKeys } from '@/lib/queryKeys';
import { recordTransaction } from '@/lib/recordTransaction';
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
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      recordTransaction({
        type: 'WITHDRAW',
        txHash: receipt.transactionHash,
        amount: formatUnits(amount, 6),
        blockNumber: Number(receipt.blockNumber),
      });

      return receipt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.balances });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: ['vault', 'history'] });
    },
  });
}
