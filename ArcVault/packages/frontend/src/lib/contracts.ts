// Contract addresses loaded from environment variables
export const TREASURY_VAULT_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_VAULT_ADDRESS as `0x${string}`;
export const PAYOUT_ROUTER_ADDRESS = process.env.NEXT_PUBLIC_PAYOUT_ROUTER_ADDRESS as `0x${string}`;
export const BUDGET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_BUDGET_MANAGER_ADDRESS as `0x${string}`;
export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
export const USYC_ADDRESS = process.env.NEXT_PUBLIC_USYC_ADDRESS as `0x${string}`;

// ABI re-exports
export { TreasuryVaultABI } from './abis/TreasuryVault';
export { PayoutRouterABI } from './abis/PayoutRouter';
export { BudgetManagerABI } from './abis/BudgetManager';
