import { getAddress } from 'viem';

// Contract addresses loaded from environment variables (checksummed via EIP-55)
// .trim() guards against trailing whitespace in env values
export const TREASURY_VAULT_ADDRESS = getAddress((process.env.NEXT_PUBLIC_TREASURY_VAULT_ADDRESS ?? '0x0').trim());
export const PAYOUT_ROUTER_ADDRESS = getAddress((process.env.NEXT_PUBLIC_PAYOUT_ROUTER_ADDRESS ?? '0x0').trim());
export const BUDGET_MANAGER_ADDRESS = getAddress((process.env.NEXT_PUBLIC_BUDGET_MANAGER_ADDRESS ?? '0x0').trim());
export const USDC_ADDRESS = getAddress((process.env.NEXT_PUBLIC_USDC_ADDRESS ?? '0x0').trim());
export const EURC_ADDRESS = getAddress((process.env.NEXT_PUBLIC_EURC_ADDRESS ?? '0x0').trim());
export const USYC_ADDRESS = getAddress((process.env.NEXT_PUBLIC_USYC_ADDRESS ?? '0x0').trim());
export const STABLEFX_ADDRESS = getAddress((process.env.NEXT_PUBLIC_STABLEFX_ADDRESS ?? '0x0').trim());

// Currency code → on-chain token address mapping
export const TOKEN_ADDRESSES: Record<string, `0x${string}`> = {
  USDC: USDC_ADDRESS,
  EURC: EURC_ADDRESS,
};

// ABI re-exports
export { TreasuryVaultABI } from './abis/TreasuryVault';
export { PayoutRouterABI } from './abis/PayoutRouter';
export { BudgetManagerABI } from './abis/BudgetManager';
export { StableFXABI } from './abis/StableFX';
