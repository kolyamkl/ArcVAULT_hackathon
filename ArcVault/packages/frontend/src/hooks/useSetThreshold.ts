import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWriteContract, usePublicClient } from 'wagmi';
import { queryKeys } from '@/lib/queryKeys';
import {
  TREASURY_VAULT_ADDRESS,
  TreasuryVaultABI,
} from '@/lib/contracts';

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

/** AccessControlUnauthorizedAccount(address account, bytes32 neededRole) */
const ACCESS_CONTROL_ERROR_SELECTOR = '0xe2517d3f';

function decodeAccessControlError(error: unknown): string | null {
  const message =
    error instanceof Error ? error.message : String(error);

  if (message.includes(ACCESS_CONTROL_ERROR_SELECTOR) || message.includes('AccessControlUnauthorizedAccount')) {
    return 'Your wallet does not have permission to update the threshold (requires CFO role).';
  }
  return null;
}

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

      try {
        const hash = await writeContractAsync({
          address: TREASURY_VAULT_ADDRESS,
          abi: TreasuryVaultABI,
          functionName: 'setLiquidityThreshold',
          args: [threshold],
        });
        return await publicClient.waitForTransactionReceipt({ hash });
      } catch (err) {
        const friendly = decodeAccessControlError(err);
        if (friendly) throw new Error(friendly);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.balances });
    },
  });
}
