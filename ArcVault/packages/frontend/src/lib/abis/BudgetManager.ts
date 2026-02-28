export const BudgetManagerABI = [
  { type: 'function', name: 'createBudget', inputs: [{ name: 'name', type: 'string' }, { name: 'departmentHead', type: 'address' }, { name: 'allocation', type: 'uint256' }, { name: 'periodEnd', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'spendFromBudget', inputs: [{ name: 'budgetId', type: 'uint256' }, { name: 'amount', type: 'uint256' }, { name: 'reference', type: 'string' }], outputs: [], stateMutability: 'nonpayable' },
] as const;
