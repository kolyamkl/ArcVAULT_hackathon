import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWriteContract, usePublicClient, useAccount } from 'wagmi';
import { erc20Abi } from 'viem';
import { queryKeys } from '@/lib/queryKeys';
import {
  STABLEFX_ADDRESS,
  TOKEN_ADDRESSES,
  StableFXABI,
} from '@/lib/contracts';

export interface OnChainSwapParams {
  fromCurrency: string;
  toCurrency: string;
  /** Amount in base units (6 decimals for stablecoins) */
  amount: bigint;
}

export interface OnChainSwapResult {
  txHash: string;
  outputAmount: bigint;
}

/**
 * 3-step on-chain FX swap via the deployed StableFX contract:
 *
 *   1. Approve StableFX to spend the from-token
 *   2. StableFX.requestQuote(fromToken, toToken, amount)
 *   3. StableFX.executeSwap(quoteId) — actually moves tokens
 *
 * On success, invalidates vault balances and FX history queries.
 */
export function useOnChainSwap() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { address: account } = useAccount();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fromCurrency,
      toCurrency,
      amount,
    }: OnChainSwapParams): Promise<OnChainSwapResult> => {
      if (!publicClient) throw new Error('Wallet not connected');
      if (!account) throw new Error('No account connected');
      if (amount === 0n) throw new Error('Amount must be greater than zero');

      const fromToken = TOKEN_ADDRESSES[fromCurrency];
      const toToken = TOKEN_ADDRESSES[toCurrency];
      if (!fromToken) throw new Error(`No on-chain token address for ${fromCurrency}`);
      if (!toToken) throw new Error(`No on-chain token address for ${toCurrency}`);

      // Step 1: Approve StableFX contract to spend the from-token
      const approveHash = await writeContractAsync({
        address: fromToken,
        abi: erc20Abi,
        functionName: 'approve',
        args: [STABLEFX_ADDRESS, amount],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // Step 2: Simulate requestQuote to get the quoteId, then execute it
      const { result } = await publicClient.simulateContract({
        address: STABLEFX_ADDRESS,
        abi: StableFXABI,
        functionName: 'requestQuote',
        args: [fromToken, toToken, amount],
        account,
      });
      const [quoteId, outputAmount] = result;

      const quoteHash = await writeContractAsync({
        address: STABLEFX_ADDRESS,
        abi: StableFXABI,
        functionName: 'requestQuote',
        args: [fromToken, toToken, amount],
      });
      await publicClient.waitForTransactionReceipt({ hash: quoteHash });

      // Step 3: Execute the swap on-chain (transfers tokens)
      const swapHash = await writeContractAsync({
        address: STABLEFX_ADDRESS,
        abi: StableFXABI,
        functionName: 'executeSwap',
        args: [quoteId],
      });
      const swapReceipt = await publicClient.waitForTransactionReceipt({
        hash: swapHash,
      });

      return {
        txHash: swapReceipt.transactionHash,
        outputAmount,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.balances });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: ['fx', 'history'] });
    },
  });
}
