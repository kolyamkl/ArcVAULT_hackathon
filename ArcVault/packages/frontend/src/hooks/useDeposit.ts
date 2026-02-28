import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWriteContract, usePublicClient } from 'wagmi';
import { erc20Abi } from 'viem';
import { queryKeys } from '@/lib/queryKeys';
import {
  TREASURY_VAULT_ADDRESS,
  USDC_ADDRESS,
  TreasuryVaultABI,
} from '@/lib/contracts';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * 2-step deposit: approve USDC spending then deposit into TreasuryVault.
 *
 * Sequence:
 *   1. USDC.approve(treasuryVaultAddress, amount)  -- wait for receipt
 *   2. TreasuryVault.depositFunds(amount)           -- wait for receipt
 *
 * On success, invalidates vault balances and dashboard queries.
 */
export function useDeposit() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      amount,
      onApproved,
    }: {
      amount: bigint;
      onApproved?: () => void;
    }) => {
      if (!publicClient) throw new Error('Wallet not connected');
      if (amount === 0n) throw new Error('Amount must be greater than zero');

      // Step 1: Approve USDC spending for the vault
      const approveHash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'approve',
        args: [TREASURY_VAULT_ADDRESS, amount],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // Notify caller that approval succeeded before starting deposit
      onApproved?.();

      // Step 2: Deposit into the vault
      const depositHash = await writeContractAsync({
        address: TREASURY_VAULT_ADDRESS,
        abi: TreasuryVaultABI,
        functionName: 'depositFunds',
        args: [amount],
      });
      return await publicClient.waitForTransactionReceipt({
        hash: depositHash,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.balances });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
