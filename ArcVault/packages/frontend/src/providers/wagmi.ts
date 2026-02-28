import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  walletConnectWallet,
  coinbaseWallet,
  injectedWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { mainnet } from 'viem/chains';
import { arcTestnet } from '@/lib/chains';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!projectId) {
  throw new Error('Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID environment variable');
}

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular',
      wallets: [metaMaskWallet, walletConnectWallet, coinbaseWallet],
    },
    {
      groupName: 'Other',
      wallets: [injectedWallet],
    },
  ],
  {
    projectId,
    appName: 'ArcVault',
  },
);

export const config = createConfig({
  connectors,
  chains: [mainnet, arcTestnet],
  transports: {
    [mainnet.id]: http(),
    [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0], {
      timeout: 5_000,
      retryCount: 1,
    }),
  },
  ssr: true,
});
