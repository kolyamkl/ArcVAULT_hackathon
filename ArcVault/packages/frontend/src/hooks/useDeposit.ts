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

      console.log('[useDeposit] Starting deposit flow', {
        amount: amount.toString(),
        vaultAddress: TREASURY_VAULT_ADDRESS,
        usdcAddress: USDC_ADDRESS,
      });

      // Step 1: Approve USDC spending for the vault
      console.log('[useDeposit] Step 1: Approving USDC...');
      let approveHash: `0x${string}`;
      try {
        approveHash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'approve',
          args: [TREASURY_VAULT_ADDRESS, amount],
        });
      } catch (err) {
        console.error('[useDeposit] Approval TX failed:', err);
        throw new Error('USDC approval failed – check your wallet has enough USDC and you are on Arc Testnet');
      }
      console.log('[useDeposit] Approval TX sent:', approveHash);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      console.log('[useDeposit] Approval confirmed');

      // Notify caller that approval succeeded before starting deposit
      onApproved?.();

      // Step 2: Deposit into the vault
      console.log('[useDeposit] Step 2: Depositing into vault...');
      let depositHash: `0x${string}`;
      try {
        depositHash = await writeContractAsync({
          address: TREASURY_VAULT_ADDRESS,
          abi: TreasuryVaultABI,
          functionName: 'depositFunds',
          args: [amount],
        });
      } catch (err) {
        console.error('[useDeposit] Deposit TX failed:', err);
        throw new Error('Deposit transaction failed – the vault may be paused or the approval did not go through');
      }
      console.log('[useDeposit] Deposit TX sent:', depositHash);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: depositHash,
      });
      console.log('[useDeposit] Deposit confirmed, status:', receipt.status);
      return receipt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.balances });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
