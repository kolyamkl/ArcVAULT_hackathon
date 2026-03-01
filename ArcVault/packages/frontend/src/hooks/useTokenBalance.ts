import { useAccount, useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { TOKEN_ADDRESSES } from '@/lib/contracts';
import { arcTestnet } from '@/lib/chains';

/**
 * Reads the connected user's balance for a given token (by currency code).
 * Polls every 15 s so the UI stays current after swaps.
 */
export function useTokenBalance(currencyCode: string) {
  const { address, isConnected, chain } = useAccount();
  const tokenAddress = TOKEN_ADDRESSES[currencyCode];

  const enabled =
    isConnected &&
    !!address &&
    !!tokenAddress &&
    tokenAddress !== '0x0000000000000000000000000000000000000000' &&
    chain?.id === arcTestnet.id;

  const { data, isLoading, error } = useReadContract({
    address: tokenAddress,
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
