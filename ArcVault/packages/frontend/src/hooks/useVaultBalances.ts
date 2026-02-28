import { useReadContracts, useAccount } from 'wagmi';
import {
  TREASURY_VAULT_ADDRESS,
  TreasuryVaultABI,
} from '@/lib/contracts';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Reads five on-chain values from TreasuryVault in a single multicall:
 *   getLiquidBalance, getUSYCBalance, getTotalValue, getYieldAccrued, liquidityThreshold
 *
 * Only fires when a wallet is connected — avoids hanging RPC calls to
 * unreachable/testnet nodes when no wallet is present.
 * Polls every 30 s to keep the UI in sync with on-chain state.
 */
export function useVaultBalances() {
  const { isConnected } = useAccount();

  const contract = {
    address: TREASURY_VAULT_ADDRESS,
    abi: TreasuryVaultABI,
  } as const;

  const { data, isLoading, error } = useReadContracts({
    contracts: [
      { ...contract, functionName: 'getLiquidBalance' },
      { ...contract, functionName: 'getUSYCBalance' },
      { ...contract, functionName: 'getTotalValue' },
      { ...contract, functionName: 'getYieldAccrued' },
      { ...contract, functionName: 'liquidityThreshold' },
    ],
    query: {
      enabled: isConnected,
      refetchInterval: isConnected ? 30_000 : false,
      retry: 1,
    },
  });

  return {
    liquidUSDC: (data?.[0]?.result as bigint | undefined) ?? BigInt(0),
    usycBalance: (data?.[1]?.result as bigint | undefined) ?? BigInt(0),
    totalValue: (data?.[2]?.result as bigint | undefined) ?? BigInt(0),
    yieldAccrued: (data?.[3]?.result as bigint | undefined) ?? BigInt(0),
    threshold: (data?.[4]?.result as bigint | undefined) ?? BigInt(0),
    isLoading: isConnected ? isLoading : false,
    error,
  };
}
