'use client';

import { useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/providers/wagmi';
import { makeQueryClient } from '@/providers/query';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
