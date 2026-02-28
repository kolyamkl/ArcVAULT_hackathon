import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet } from './chains';

/**
 * Server-side public client for read-only on-chain calls (view functions).
 * Uses the same Arc Testnet RPC configured for the frontend.
 */
export function getPublicClient() {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });
}

/**
 * Returns the deployer account (address + signer) derived from DEPLOYER_PRIVATE_KEY.
 * Needed for EIP-712 signing in StableFX and other server-side signing flows.
 */
export function getDeployerAccount() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('DEPLOYER_PRIVATE_KEY environment variable is not set');
  }
  return privateKeyToAccount(privateKey as `0x${string}`);
}

/**
 * Server-side wallet client for write transactions (executePayout, etc.).
 * Uses DEPLOYER_PRIVATE_KEY from env — only available in API routes, never exposed to browser.
 */
export function getWalletClient() {
  const account = getDeployerAccount();

  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });
}
