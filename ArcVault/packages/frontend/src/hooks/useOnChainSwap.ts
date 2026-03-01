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

      const ZERO = '0x0000000000000000000000000000000000000000' as const;

      const fromToken = TOKEN_ADDRESSES[fromCurrency];
      const toToken = TOKEN_ADDRESSES[toCurrency];
      if (!fromToken || fromToken === ZERO) throw new Error(`No on-chain token address configured for ${fromCurrency} — check NEXT_PUBLIC_${fromCurrency}_ADDRESS env var`);
      if (!toToken || toToken === ZERO) throw new Error(`No on-chain token address configured for ${toCurrency} — check NEXT_PUBLIC_${toCurrency}_ADDRESS env var`);
      if (STABLEFX_ADDRESS === ZERO) throw new Error('StableFX contract address not configured — check NEXT_PUBLIC_STABLEFX_ADDRESS env var');

      console.log('[useOnChainSwap] Starting on-chain swap:', {
        fromCurrency, toCurrency, amount: amount.toString(),
        fromToken, toToken, account, stableFX: STABLEFX_ADDRESS,
      });

      // Step 1: Approve StableFX contract to spend the from-token
      console.log('[useOnChainSwap] Step 1: Approving StableFX to spend', fromCurrency);
      const approveHash = await writeContractAsync({
        address: fromToken,
        abi: erc20Abi,
        functionName: 'approve',
        args: [STABLEFX_ADDRESS, amount],
      });
      console.log('[useOnChainSwap] Step 1: Approve tx sent:', approveHash);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      console.log('[useOnChainSwap] Step 1: Approve confirmed');

      // Step 2: Simulate requestQuote to get the quoteId, then execute it
      console.log('[useOnChainSwap] Step 2: Simulating requestQuote...');
      const { result } = await publicClient.simulateContract({
        address: STABLEFX_ADDRESS,
        abi: StableFXABI,
        functionName: 'requestQuote',
        args: [fromToken, toToken, amount],
        account,
      });
      const [quoteId, outputAmount] = result;
      console.log('[useOnChainSwap] Step 2: Simulated quoteId:', quoteId.toString(), 'outputAmount:', outputAmount.toString());

      const quoteHash = await writeContractAsync({
        address: STABLEFX_ADDRESS,
        abi: StableFXABI,
        functionName: 'requestQuote',
        args: [fromToken, toToken, amount],
      });
      console.log('[useOnChainSwap] Step 2: requestQuote tx sent:', quoteHash);
      await publicClient.waitForTransactionReceipt({ hash: quoteHash });
      console.log('[useOnChainSwap] Step 2: requestQuote confirmed');

      // Step 3: Execute the swap on-chain (transfers tokens)
      console.log('[useOnChainSwap] Step 3: Executing swap with quoteId:', quoteId.toString());
      const swapHash = await writeContractAsync({
        address: STABLEFX_ADDRESS,
        abi: StableFXABI,
        functionName: 'executeSwap',
        args: [quoteId],
      });
      console.log('[useOnChainSwap] Step 3: executeSwap tx sent:', swapHash);
      const swapReceipt = await publicClient.waitForTransactionReceipt({
        hash: swapHash,
      });
      console.log('[useOnChainSwap] Step 3: Swap confirmed! txHash:', swapReceipt.transactionHash);

      console.log('[useOnChainSwap] Swap complete:', {
        txHash: swapReceipt.transactionHash,
        outputAmount: outputAmount.toString(),
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
