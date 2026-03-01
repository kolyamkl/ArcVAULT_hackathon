import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWriteContract, usePublicClient } from 'wagmi';
import { queryKeys } from '@/lib/queryKeys';
import { recordTransaction } from '@/lib/recordTransaction';
import {
  TREASURY_VAULT_ADDRESS,
  TreasuryVaultABI,
} from '@/lib/contracts';

/**
 * Sweep liquid USDC above the liquidity threshold into yield-bearing USYC.
 * Requires no arguments — the contract sweeps all USDC above the threshold.
 */
export function useSweepToUSYC() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!publicClient) throw new Error('Wallet not connected');

      const hash = await writeContractAsync({
        address: TREASURY_VAULT_ADDRESS,
        abi: TreasuryVaultABI,
        functionName: 'sweepToUSYC',
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Sweep amount is determined by the contract; record with 0 and let chain indexer update
      recordTransaction({
        type: 'SWEEP',
        txHash: receipt.transactionHash,
        amount: '0',
        currency: 'USYC',
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
