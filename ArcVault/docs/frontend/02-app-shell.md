# 02 - App Shell: Layout, Sidebar, Header, Providers & Routing

> **Scope:** Root layout, provider hierarchy, sidebar navigation, header bar, Quick Pay FAB, routing structure, contract config, and API client.
> **Owner:** Any frontend agent can implement this independently.
> **Prerequisites:** Design system tokens and primitives from `docs/frontend/01-design-system.md` must be available. Monorepo scaffolded per `docs/technical/01-monorepo-setup.md`.

---

## 1. Shell Layout Overview

```
+-------+------------------------------------------+
| LOGO  |  Header: Search  |  Wallet  |  Theme     |
+-------+------------------------------------------+
|       |                                          |
| Dash  |                                          |
| Vault |            Page Content                  |
| FX    |                                          |
| Pipe  |                                          |
|       |                                          |
+-------+------------------------------------------+
                                          [+ Quick Pay FAB]
```

- **Sidebar:** Fixed left column, 240px wide on desktop, collapsible on mobile.
- **Header:** Sticky top bar spanning the content area.
- **Main:** Scrollable content area to the right of the sidebar, below the header.
- **Quick Pay FAB:** Fixed-position floating action button, bottom-right, visible on all pages.

---

## 2. Root Layout

**File:** `packages/frontend/src/app/layout.tsx`

```tsx
import { Inter } from 'next/font/google';
import { Providers } from '@/providers';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { QuickPayFAB } from '@/components/layout/QuickPayFAB';
import '@/app/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: 'ArcVault — Enterprise Treasury & FX',
  description: 'Enterprise treasury management and FX operations on Arc blockchain',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body className="bg-background text-foreground font-sans antialiased">
        <Providers>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto p-6">
                {children}
              </main>
            </div>
          </div>
          <QuickPayFAB />
        </Providers>
      </body>
    </html>
  );
}
```

**Notes:**
- `suppressHydrationWarning` is required because `next-themes` modifies the `class` attribute on `<html>` at runtime.
- The `dark` class is set as the initial default; `next-themes` takes over on hydration.
- The Inter font is loaded via `next/font/google` and exposed as the `--font-inter` CSS variable (consumed in `tailwind.config.ts`).

---

## 3. Providers

**File:** `packages/frontend/src/providers/index.tsx`

Provider wrapping order (outermost to innermost):

1. **`ThemeProvider`** (`next-themes`) -- dark/light mode management.
2. **`WagmiProvider`** (`wagmi`) -- blockchain connection config.
3. **`QueryClientProvider`** (`@tanstack/react-query`) -- server-state cache.
4. **`RainbowKitProvider`** (`@rainbow-me/rainbowkit`) -- wallet connection UI.

```tsx
'use client';

import { ThemeProvider } from 'next-themes';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { config } from './wagmi';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30 seconds
      refetchInterval: 60_000, // 1 minute polling
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            theme={{
              darkMode: darkTheme({ accentColor: '#3B82F6' }),
              lightMode: lightTheme({ accentColor: '#3B82F6' }),
            }}
          >
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
```

---

## 4. Wagmi Config

**File:** `packages/frontend/src/providers/wagmi.ts`

```typescript
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { arcTestnet } from '@/lib/chains';

export const config = getDefaultConfig({
  appName: 'ArcVault',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [arcTestnet],
  ssr: true,
});
```

---

## 5. Arc Chain Definition

**File:** `packages/frontend/src/lib/chains.ts`

```typescript
import { defineChain } from 'viem';

export const arcTestnet = defineChain({
  id: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID) || 1397,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'ARC',
    symbol: 'ARC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://testnet-rpc.arc.io'],
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
```

---

## 6. Sidebar

**File:** `packages/frontend/src/components/layout/Sidebar.tsx`

**Desktop (>= 768px):**
- Fixed left, full viewport height, width `w-60` (240px).
- Background: `bg-surface border-r border-card-border`.
- Top: ArcVault logo and wordmark.
- Navigation links stacked vertically below the logo.

**Mobile (< 768px):**
- Hidden by default.
- A hamburger button in the Header toggles a slide-in overlay (`translate-x` transition).
- Overlay backdrop: `fixed inset-0 bg-black/50 z-40`.
- Sidebar slides in from the left with `z-50`.

**Navigation Items:**

| Label | Route | Icon (use Lucide React) |
|-------|-------|------------------------|
| Dashboard | `/` | `LayoutDashboard` |
| Treasury Vault | `/vault` | `Shield` |
| FX Conversion | `/fx` | `ArrowLeftRight` |
| Pipeline Builder | `/pipeline` | `Workflow` |

**Active state:**
- Use `usePathname()` from `next/navigation` to determine active route.
- Active link: `bg-gradient-primary text-white rounded-lg` background.
- Inactive link: `text-muted hover:text-foreground hover:bg-surface` with transition.

**Implementation pattern:**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Shield, ArrowLeftRight, Workflow } from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Treasury Vault', href: '/vault', icon: Shield },
  { label: 'FX Conversion', href: '/fx', icon: ArrowLeftRight },
  { label: 'Pipeline Builder', href: '/pipeline', icon: Workflow },
];
```

State management: use a local `useState` for mobile open/close; no global store needed.

---

## 7. Header

**File:** `packages/frontend/src/components/layout/Header.tsx`

- Sticky top: `sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-card-border`.
- Height: `h-16`.
- Layout: `flex items-center justify-between px-6`.

**Left side:**
- Mobile: hamburger menu button (triggers sidebar open).
- Desktop: breadcrumb or page title (derive from current route using `usePathname()`).

**Right side (flex row, gap-3):**
1. **ThemeToggle** component.
2. **ConnectButton** from `@rainbow-me/rainbowkit` (wallet connection).

---

## 8. Theme Toggle

**File:** `packages/frontend/src/components/layout/ThemeToggle.tsx`

```tsx
'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
```

**Behavior:**
- Renders a button with the `Sun` icon when dark mode is active (clicking switches to light).
- Renders a button with the `Moon` icon when light mode is active (clicking switches to dark).
- Use `useTheme()` hook: `const { theme, setTheme } = useTheme();`.
- Handle hydration mismatch: don't render the icon until `mounted` state is true (useEffect).
- Button style: `p-2 rounded-lg hover:bg-primary/10 transition-colors`.
- Icon transition: a subtle rotate + fade via CSS transitions.

---

## 9. Quick Pay FAB

**File:** `packages/frontend/src/components/layout/QuickPayFAB.tsx`

- Fixed position: `fixed bottom-6 right-6 z-40`.
- Circular gradient button: `w-14 h-14 rounded-full bg-gradient-primary shadow-lg hover:shadow-xl transition-all hover:scale-105`.
- Icon: `+` or `Plus` icon from Lucide, white, centered.
- On click: opens the Quick Pay Modal (see `docs/frontend/07-quick-pay.md` for the modal spec).
- State: local `useState` to control modal open/close.
- Visible on all pages (rendered in root layout, outside of `<main>`).
- Tooltip on hover: "Quick Pay" (use `title` attribute or a custom tooltip).

---

## 10. Routing (App Router Structure)

```
packages/frontend/src/app/
  layout.tsx          ← Root layout (section 2)
  globals.css         ← Theme variables (from 01-design-system.md)
  page.tsx            ← Dashboard (/) → see docs/frontend/03-dashboard-page.md
  vault/
    page.tsx          ← Treasury Vault (/vault) → see docs/frontend/04-vault-page.md
  fx/
    page.tsx          ← FX Conversion (/fx) → see docs/frontend/05-fx-page.md
  pipeline/
    page.tsx          ← Pipeline Builder (/pipeline) → see docs/frontend/06-pipeline-builder.md
  api/
    ...               ← API routes → see docs/technical/07-api-routes.md
```

Each `page.tsx` is a React Server Component by default. Pages that need client interactivity should mark sections with `'use client'` or extract client components.

---

## 11. Contract Configuration

**File:** `packages/frontend/src/lib/contracts.ts`

```typescript
// Contract addresses loaded from environment variables
export const TREASURY_VAULT_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_VAULT_ADDRESS as `0x${string}`;
export const PAYOUT_ROUTER_ADDRESS = process.env.NEXT_PUBLIC_PAYOUT_ROUTER_ADDRESS as `0x${string}`;
export const BUDGET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_BUDGET_MANAGER_ADDRESS as `0x${string}`;
export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

// ABI re-exports
export { TreasuryVaultABI } from './abis/TreasuryVault';
export { PayoutRouterABI } from './abis/PayoutRouter';
export { BudgetManagerABI } from './abis/BudgetManager';
```

**Required environment variables** (add to `.env.local`):
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
NEXT_PUBLIC_ARC_CHAIN_ID=1397
NEXT_PUBLIC_ARC_RPC_URL=https://testnet-rpc.arc.io
NEXT_PUBLIC_ARC_EXPLORER_URL=https://testnet-explorer.arc.io
NEXT_PUBLIC_TREASURY_VAULT_ADDRESS=0x...
NEXT_PUBLIC_PAYOUT_ROUTER_ADDRESS=0x...
NEXT_PUBLIC_BUDGET_MANAGER_ADDRESS=0x...
NEXT_PUBLIC_USDC_ADDRESS=0x...
```

---

## 12. API Client

**File:** `packages/frontend/src/lib/api.ts`

A thin fetch wrapper that all page-level data fetching hooks call through. The base URL points to the Next.js API routes (`/api`).

```typescript
const API_BASE = '/api';

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API Error ${res.status}: ${errorText}`);
  }
  return res.json();
}

export const api = {
  // Dashboard
  dashboard: {
    getStats: () => fetchAPI<DashboardStats>('/dashboard'),
  },

  // Treasury Vault
  vault: {
    getStatus: () => fetchAPI<VaultStatus>('/vault/status'),
    getHistory: (params: Record<string, string>) =>
      fetchAPI<VaultHistory>(`/vault/history?${new URLSearchParams(params)}`),
  },

  // FX Conversion
  fx: {
    getQuote: (params: Record<string, string>) =>
      fetchAPI<FXQuote>(`/fx/quote?${new URLSearchParams(params)}`),
    executeSwap: (quoteId: string) =>
      fetchAPI<FXExecution>('/fx/execute', {
        method: 'POST',
        body: JSON.stringify({ quoteId }),
      }),
    getHistory: (params: Record<string, string>) =>
      fetchAPI<FXHistory>(`/fx/history?${new URLSearchParams(params)}`),
  },

  // Payouts
  payouts: {
    create: (data: CreatePayoutRequest) =>
      fetchAPI<Payout>('/payouts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    createBatch: (data: CreateBatchPayoutRequest) =>
      fetchAPI<BatchPayoutResult>('/payouts/batch', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    list: (params: Record<string, string>) =>
      fetchAPI<PayoutList>(`/payouts?${new URLSearchParams(params)}`),
    get: (id: string) => fetchAPI<Payout>(`/payouts/${id}`),
  },

  // Pipelines
  pipelines: {
    list: () => fetchAPI<Pipeline[]>('/pipelines'),
    get: (id: string) => fetchAPI<Pipeline>(`/pipelines/${id}`),
    create: (data: CreatePipelineRequest) =>
      fetchAPI<Pipeline>('/pipelines', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdatePipelineRequest) =>
      fetchAPI<Pipeline>(`/pipelines/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchAPI<void>(`/pipelines/${id}`, { method: 'DELETE' }),
    execute: (id: string, data: ExecutePipelineRequest) =>
      fetchAPI<PipelineExecution>(`/pipelines/${id}/execute`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getHistory: (id: string) =>
      fetchAPI<PipelineHistory>(`/pipelines/${id}/history`),
  },

  // Transactions
  transactions: {
    list: (params: Record<string, string>) =>
      fetchAPI<TransactionList>(`/transactions?${new URLSearchParams(params)}`),
  },
};
```

> **Note:** The type generics (`DashboardStats`, `VaultStatus`, etc.) should be defined in `packages/frontend/src/types/` or imported from a shared types package. For the hackathon, they can start as simple interfaces co-located in a `types.ts` file and be refined later.

---

## 13. Files to Create or Modify

| File | Action |
|------|--------|
| `packages/frontend/src/app/layout.tsx` | New -- root layout with shell structure |
| `packages/frontend/src/app/globals.css` | Modify -- add theme variables (shared with 01-design-system) |
| `packages/frontend/src/providers/index.tsx` | New -- provider composition |
| `packages/frontend/src/providers/wagmi.ts` | New -- wagmi + RainbowKit config |
| `packages/frontend/src/components/layout/Sidebar.tsx` | New -- sidebar navigation |
| `packages/frontend/src/components/layout/Header.tsx` | New -- top header bar |
| `packages/frontend/src/components/layout/ThemeToggle.tsx` | New -- dark/light toggle |
| `packages/frontend/src/components/layout/QuickPayFAB.tsx` | New -- floating action button |
| `packages/frontend/src/lib/chains.ts` | New -- Arc testnet chain definition |
| `packages/frontend/src/lib/contracts.ts` | New -- contract addresses and ABI exports |
| `packages/frontend/src/lib/api.ts` | New -- API client wrapper |

---

## 14. Cross-References

- **`docs/frontend/01-design-system.md`** -- Theme tokens, CSS variables, and all shared component primitives used throughout the shell.
- **`docs/frontend/03-dashboard-page.md`** -- Dashboard page rendered at `/`.
- **`docs/frontend/04-vault-page.md`** -- Treasury Vault page rendered at `/vault`.
- **`docs/frontend/05-fx-page.md`** -- FX Conversion page rendered at `/fx`.
- **`docs/frontend/06-pipeline-builder.md`** -- Pipeline Builder page rendered at `/pipeline`.
- **`docs/frontend/07-quick-pay.md`** -- Quick Pay modal triggered by the FAB.
- **`docs/frontend/08-hooks-and-state.md`** -- React hooks and Zustand stores that power data fetching and state.
- **`docs/technical/01-monorepo-setup.md`** -- Environment variables, package structure, and initial scaffolding.
- **`docs/technical/07-api-routes.md`** -- API endpoint specifications that the `api` client maps to.
