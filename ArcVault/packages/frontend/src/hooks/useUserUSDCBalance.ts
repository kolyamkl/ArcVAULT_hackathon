import { useAccount, useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { USDC_ADDRESS } from '@/lib/contracts';
import { arcTestnet } from '@/lib/chains';

/**
 * Reads the connected user's USDC wallet balance.
 * Polls every 15 s so the deposit modal stays current.
 */
export function useUserUSDCBalance() {
  const { address, isConnected, chain } = useAccount();

  const enabled = isConnected && !!address && chain?.id === arcTestnet.id;

  const { data, isLoading, error } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled,
      refetchInterval: enabled ? 15_000 : false,
      retry: 1,
    },
  });

  return {
    balance: (data as bigint | undefined) ?? 0n,
    isLoading: enabled ? isLoading : false,
    error,
  };
}
