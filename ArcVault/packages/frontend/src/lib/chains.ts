import { defineChain } from 'viem';

export const arcTestnet = defineChain({
  id: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID) || 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'ARC',
    symbol: 'ARC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arc Explorer',
      url: process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || 'https://testnet-explorer.arc.io',
    },
  },
  testnet: true,
});
