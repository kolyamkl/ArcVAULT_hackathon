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

export interface SpendBudgetParams {
  budgetId: bigint;
  amount: bigint;
  reference: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Spend from an existing budget on the BudgetManager contract.
 *
 * Contract: BudgetManager.spendFromBudget(budgetId, amount, reference)
 *
 * On success, invalidates budget list and vault balance queries.
 */
export function useSpendBudget() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      budgetId,
      amount,
      reference,
    }: SpendBudgetParams) => {
      if (!publicClient) throw new Error('Wallet not connected');

      const hash = await writeContractAsync({
        address: BUDGET_MANAGER_ADDRESS,
        abi: BudgetManagerABI,
        functionName: 'spendFromBudget',
        args: [budgetId, amount, reference],
      });
      return await publicClient.waitForTransactionReceipt({ hash });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.list });
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.balances });
    },
  });
}
