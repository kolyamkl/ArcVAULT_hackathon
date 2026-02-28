import { createConfig, http } from 'wagmi';
import { injected, metaMask, walletConnect, coinbaseWallet } from 'wagmi/connectors';
import { arcTestnet } from '@/lib/chains';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!projectId) {
  throw new Error('Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID environment variable');
}

export const config = createConfig({
  connectors: [
    metaMask(),
    walletConnect({ projectId, showQrModal: false }),
    coinbaseWallet({ appName: 'ArcVault' }),
    injected(),
  ],
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0], {
      timeout: 5_000,
      retryCount: 1,
    }),
  },
  ssr: true,
});
