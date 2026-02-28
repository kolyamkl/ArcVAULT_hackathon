import { useReadContracts, useAccount } from 'wagmi';
import {
  TREASURY_VAULT_ADDRESS,
  TreasuryVaultABI,
} from '@/lib/contracts';
import { arcTestnet } from '@/lib/chains';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Checks whether the connected wallet holds CFO_ROLE on TreasuryVault.
 *
 * 1. Reads `CFO_ROLE()` to get the role's bytes32 identifier.
 * 2. Calls `hasRole(cfoRole, connectedAddress)`.
 *
 * Returns `{ hasCFORole, isLoading }`.
 */
export function useHasCFORole() {
  const { address, isConnected, chain } = useAccount();

  const contract = {
    address: TREASURY_VAULT_ADDRESS,
    abi: TreasuryVaultABI,
  } as const;

  const enabled = isConnected && !!address && chain?.id === arcTestnet.id;

  // First read: get the CFO_ROLE bytes32 constant
  const { data: roleData, isLoading: roleLoading } = useReadContracts({
    contracts: [{ ...contract, functionName: 'CFO_ROLE' }],
    query: { enabled, retry: 1 },
  });

  const cfoRole = roleData?.[0]?.result as `0x${string}` | undefined;

  // Second read: check hasRole for the connected address
  const { data: hasRoleData, isLoading: hasRoleLoading } = useReadContracts({
    contracts: [
      {
        ...contract,
        functionName: 'hasRole',
        args: cfoRole && address ? [cfoRole, address] : undefined,
      },
    ],
    query: { enabled: enabled && !!cfoRole, retry: 1 },
  });

  const hasCFORole = (hasRoleData?.[0]?.result as boolean | undefined) ?? false;

  return {
    hasCFORole,
    isLoading: enabled ? roleLoading || hasRoleLoading : false,
  };
}
