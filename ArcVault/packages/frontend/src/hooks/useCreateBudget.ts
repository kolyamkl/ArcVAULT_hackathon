import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWriteContract, usePublicClient } from 'wagmi';
import { queryKeys } from '@/lib/queryKeys';
import {
  BUDGET_MANAGER_ADDRESS,
  BudgetManagerABI,
} from '@/lib/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateBudgetParams {
  name: string;
  departmentHead: `0x${string}`;
  allocation: bigint;
  periodEnd: bigint; // unix timestamp
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Create a new budget on the BudgetManager contract.
 * Requires CFO_ROLE on-chain.
 *
 * Contract: BudgetManager.createBudget(name, departmentHead, allocation, periodEnd)
 */
export function useCreateBudget() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      departmentHead,
      allocation,
      periodEnd,
    }: CreateBudgetParams) => {
      if (!publicClient) throw new Error('Wallet not connected');

      const hash = await writeContractAsync({
        address: BUDGET_MANAGER_ADDRESS,
        abi: BudgetManagerABI,
        functionName: 'createBudget',
        args: [name, departmentHead, allocation, periodEnd],
      });
      return await publicClient.waitForTransactionReceipt({ hash });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.list });
    },
  });
}
