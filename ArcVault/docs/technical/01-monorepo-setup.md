# 01 — Monorepo Setup

> **Scope:** Bootstrap the entire ArcVault project from an empty directory to a
> runnable monorepo with a Foundry contracts workspace and a Next.js frontend
> workspace, all wired together with pnpm.
>
> **Audience:** Any agent or developer who needs to stand up the project from
> scratch. This document is self-contained; follow it top-to-bottom.

---

## Table of Contents

1. [Directory Structure](#1-directory-structure)
2. [pnpm Workspace](#2-pnpm-workspace)
3. [Root package.json](#3-root-packagejson)
4. [.gitignore](#4-gitignore)
5. [.env.example](#5-envexample)
6. [Contracts Workspace (Foundry)](#6-contracts-workspace-foundry)
7. [Frontend Workspace (Next.js)](#7-frontend-workspace-nextjs)
8. [TypeScript Configuration](#8-typescript-configuration)
9. [Tailwind Configuration](#9-tailwind-configuration)
10. [Next.js Configuration](#10-nextjs-configuration)
11. [Arc Testnet Chain Definition](#11-arc-testnet-chain-definition)
12. [Providers Setup](#12-providers-setup)
13. [Bootstrap Checklist](#13-bootstrap-checklist)
14. [Files to Create/Modify](#14-files-to-createmodify)
15. [Cross-references](#15-cross-references)

---

## 1. Directory Structure

```
arcvault/
├── pnpm-workspace.yaml
├── package.json                    # root — workspace scripts only
├── .gitignore
├── .env.example
├── docs/
│   └── technical/                  # you are here
├── packages/
│   ├── contracts/                  # Foundry project
│   │   ├── foundry.toml
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── TreasuryVault.sol
│   │   │   ├── PayoutRouter.sol
│   │   │   ├── BudgetManager.sol
│   │   │   ├── ArcVaultAccessControl.sol
│   │   │   ├── interfaces/
│   │   │   │   ├── IUSYC.sol
│   │   │   │   └── IStableFX.sol
│   │   │   └── mocks/
│   │   │       ├── MockERC20.sol
│   │   │       ├── MockUSYC.sol
│   │   │       └── MockStableFX.sol
│   │   ├── test/
│   │   │   ├── TreasuryVault.t.sol
│   │   │   ├── PayoutRouter.t.sol
│   │   │   └── BudgetManager.t.sol
│   │   ├── script/
│   │   │   └── Deploy.s.sol
│   │   └── deployments/
│   │       └── .gitkeep
│   └── frontend/                   # Next.js 14 App Router
│       ├── package.json
│       ├── next.config.js
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       ├── tsconfig.json
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts
│       └── src/
│           ├── app/                # App Router pages & layouts
│           │   ├── layout.tsx
│           │   ├── globals.css
│           │   ├── page.tsx              # Dashboard (/)
│           │   ├── vault/page.tsx        # Treasury Vault (/vault)
│           │   ├── fx/page.tsx           # FX Conversion (/fx)
│           │   ├── pipeline/page.tsx     # Pipeline Builder (/pipeline)
│           │   └── api/                  # API routes
│           ├── components/
│           │   ├── layout/         # AppShell, Sidebar, Header, ThemeToggle
│           │   ├── shared/         # StatCard, Card, Button, DataTable, etc.
│           │   ├── vault/          # DepositModal, WithdrawModal, ThresholdSlider, etc.
│           │   ├── fx/             # FXSwapCard, CurrencySelector, QuoteDisplay, etc.
│           │   ├── pipeline/       # PipelineCanvas, BlockPalette, nodes/, etc.
│           │   └── quick-pay/      # QuickPayFAB, QuickPayModal, PaymentSummary
│           ├── hooks/              # 21 custom React hooks
│           ├── services/           # Integration adapters (real + mock)
│           │   ├── stablefx.service.ts
│           │   ├── cpn.service.ts
│           │   ├── usyc.service.ts
│           │   ├── chain.service.ts
│           │   └── index.ts        # Service factory
│           ├── lib/
│           │   ├── chains.ts       # Arc Testnet chain definition
│           │   ├── contracts.ts    # Contract addresses + ABI re-exports
│           │   ├── abis/           # Contract ABI JSON files
│           │   ├── prisma.ts       # Prisma client singleton
│           │   └── utils.ts
│           ├── providers/          # React context providers
│           │   ├── index.tsx       # Main Providers component (active)
│           │   ├── wagmi.ts        # Wagmi config
│           │   ├── query.ts        # TanStack Query client
│           │   └── Web3Provider.tsx # Legacy (unused)
│           ├── stores/             # Zustand stores
│           │   ├── pipeline.store.ts
│           │   └── ui.store.ts
│           └── types/
│               └── index.ts
```

---

## 2. pnpm Workspace

### `pnpm-workspace.yaml`

```yaml
packages:
  - "packages/*"
```

This tells pnpm to treat every direct child of `packages/` as a workspace
member. No additional configuration is required.

**Prerequisites:**
- Node.js >= 18.17 (LTS recommended)
- pnpm >= 8.0 (`corepack enable && corepack prepare pnpm@latest --activate`)
- Foundry toolchain (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)

---

## 3. Root package.json

### `package.json` (root)

```jsonc
{
  "name": "arcvault",
  "version": "0.1.0",
  "private": true,
  "description": "Enterprise Treasury & FX Operations Platform on Arc Blockchain",
  "scripts": {
    // ---------- development ----------
    "dev": "pnpm --filter frontend dev",
    "build": "pnpm --filter frontend build",

    // ---------- contracts ----------
    "contracts:build": "cd packages/contracts && forge build",
    "contracts:test": "cd packages/contracts && forge test -vvv",
    "contracts:deploy": "cd packages/contracts && forge script script/Deploy.s.sol --broadcast --rpc-url $ARC_RPC_URL",

    // ---------- database ----------
    "db:migrate": "pnpm --filter frontend exec prisma migrate dev",
    "db:migrate:prod": "pnpm --filter frontend exec prisma migrate deploy",
    "db:seed": "pnpm --filter frontend exec prisma db seed",
    "db:studio": "pnpm --filter frontend exec prisma studio",
    "db:generate": "pnpm --filter frontend exec prisma generate",

    // ---------- quality ----------
    "test": "pnpm --filter frontend test && pnpm contracts:test",
    "lint": "pnpm --filter frontend lint",
    "typecheck": "pnpm --filter frontend exec tsc --noEmit",

    // ---------- utilities ----------
    "clean": "rm -rf packages/frontend/.next packages/contracts/out packages/contracts/cache node_modules/.cache",
    "postinstall": "pnpm db:generate"
  },
  "engines": {
    "node": ">=18.17.0",
    "pnpm": ">=8.0.0"
  },
  "packageManager": "pnpm@9.1.0"
}
```

> **Note:** The root `package.json` contains NO dependencies. All deps live in
> the respective workspace packages.

---

## 4. .gitignore

### `.gitignore`

```gitignore
# ---------- general ----------
node_modules/
.env
.env.local
.env.*.local
.DS_Store
*.log

# ---------- Next.js ----------
.next/
out/

# ---------- Foundry ----------
cache/
out/
broadcast/
deployments/

# ---------- Prisma ----------
packages/frontend/prisma/migrations/*.sql.bak

# ---------- Vercel ----------
.vercel/

# ---------- IDE ----------
.idea/
.vscode/
*.swp
*.swo

# ---------- testing ----------
coverage/
```

---

## 5. .env.example

### `.env.example`

```bash
# ──────────────────────────────────────────────
# Database (Railway PostgreSQL)
# ──────────────────────────────────────────────
DATABASE_URL="postgresql://user:password@host:5432/arcvault?schema=public"

# ──────────────────────────────────────────────
# Arc Blockchain
# ──────────────────────────────────────────────
NEXT_PUBLIC_ARC_RPC_URL="https://testnet-rpc.arc.io"
NEXT_PUBLIC_ARC_CHAIN_ID="1397"
NEXT_PUBLIC_ARC_EXPLORER_URL="https://testnet-explorer.arc.io"

# ──────────────────────────────────────────────
# Deployed Contract Addresses (populated after deploy)
# ──────────────────────────────────────────────
NEXT_PUBLIC_TREASURY_VAULT_ADDRESS="0x..."
NEXT_PUBLIC_PAYOUT_ROUTER_ADDRESS="0x..."
NEXT_PUBLIC_BUDGET_MANAGER_ADDRESS="0x..."
NEXT_PUBLIC_USDC_ADDRESS="0x..."

# ──────────────────────────────────────────────
# CPN (Cross-border Payment Network) Integration
# ──────────────────────────────────────────────
CPN_API_KEY="cpn_..."
CPN_API_URL="https://api.cpn.example.com/v1"

# ──────────────────────────────────────────────
# StableFX Integration
# ──────────────────────────────────────────────
STABLEFX_API_KEY="sfx_..."
STABLEFX_API_URL="https://api.stablefx.example.com/v1"

# ──────────────────────────────────────────────
# Integration Mode — "real" uses live APIs, "mock" uses local stubs
# ──────────────────────────────────────────────
INTEGRATION_MODE="mock"

# ──────────────────────────────────────────────
# WalletConnect
# ──────────────────────────────────────────────
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="your_walletconnect_project_id"

# ──────────────────────────────────────────────
# Deployer (NEVER commit the real key)
# ──────────────────────────────────────────────
DEPLOYER_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
```

---

## 6. Contracts Workspace (Foundry)

### `packages/contracts/foundry.toml`

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
test = "test"
script = "script"

solc_version = "0.8.20"
optimizer = true
optimizer_runs = 200
via_ir = false
evm_version = "paris"

remappings = [
    "@openzeppelin/=lib/openzeppelin-contracts/",
]

[profile.default.fuzz]
runs = 256

[fmt]
line_length = 120
tab_width = 4
bracket_spacing = false
```

### `packages/contracts/package.json`

```json
{
  "name": "@arcvault/contracts",
  "version": "0.1.0",
  "private": true,
  "description": "ArcVault Solidity smart contracts (Foundry)",
  "scripts": {
    "build": "forge build",
    "test": "forge test -vvv",
    "test:gas": "forge test --gas-report",
    "deploy:testnet": "forge script script/Deploy.s.sol --broadcast --rpc-url $ARC_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY",
    "fmt": "forge fmt",
    "snapshot": "forge snapshot"
  }
}
```

**Installing OpenZeppelin:**

```bash
cd packages/contracts
forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

This creates `lib/openzeppelin-contracts/` which the remappings reference.

---

## 7. Frontend Workspace (Next.js)

### `packages/frontend/package.json`

```json
{
  "name": "@arcvault/frontend",
  "version": "0.1.0",
  "private": true,
  "description": "ArcVault frontend — Next.js App Router",
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",

    "@rainbow-me/rainbowkit": "^2.1.0",
    "wagmi": "^2.9.0",
    "viem": "^2.13.0",
    "@tanstack/react-query": "^5.40.0",

    "@prisma/client": "^5.14.0",

    "recharts": "^2.12.0",
    "reactflow": "^11.11.0",
    "zustand": "^4.5.0",
    "next-themes": "^0.3.0",
    "zod": "^3.23.0",
    "date-fns": "^3.6.0",

    "tailwindcss": "^3.4.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0",
    "class-variance-authority": "^0.7.0",
    "lucide-react": "^0.378.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/node": "^20.12.0",

    "prisma": "^5.14.0",
    "tsx": "^4.11.0",

    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",

    "vitest": "^1.6.0",
    "@testing-library/react": "^15.0.0",

    "eslint": "^8.57.0",
    "eslint-config-next": "^14.2.0"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

### `packages/frontend/postcss.config.js`

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

## 8. TypeScript Configuration

### `packages/frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    },
    "baseUrl": "."
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

The `@/*` path alias allows clean imports like:

```ts
import { cn } from "@/lib/utils";
import { TreasuryStore } from "@/stores/treasury";
```

---

## 9. Tailwind Configuration

### `packages/frontend/tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background:    'var(--color-background)',
        surface:       'var(--color-surface)',
        'card-border': 'var(--color-card-border)',
        primary:       'var(--color-primary)',
        secondary:     'var(--color-secondary)',
        success:       'var(--color-success)',
        warning:       'var(--color-warning)',
        error:         'var(--color-error)',
        foreground:    'var(--color-foreground)',
        muted:         'var(--color-muted)',
        gold:          'var(--color-gold)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #D4A853, #B08D3E)',
      },
      fontFamily: {
        sans:    ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      keyframes: {
        shimmer:          { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'fade-in':        { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up':       { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'pulse-status':   { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
        'slide-in-left':  { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(0)' } },
        'slide-in-right': { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        'flow-dash':      { to: { strokeDashoffset: '-20' } },
      },
      animation: {
        shimmer:          'shimmer 1.5s infinite linear',
        'fade-in':        'fade-in 200ms ease-out',
        'slide-up':       'slide-up 250ms ease-out',
        'pulse-status':   'pulse-status 1.5s ease-in-out infinite',
        'slide-in-left':  'slide-in-left 200ms ease-out',
        'slide-in-right': 'slide-in-right 200ms ease-out',
        'flow-dash':      'flow-dash 0.6s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
```

> **Note:** All color tokens map to CSS custom properties defined in `globals.css`,
> enabling seamless dark/light mode switching via `next-themes`.
> Design system tokens are further documented in `docs/frontend/01-design-system.md`.

---

## 10. Next.js Configuration

### `packages/frontend/next.config.js`

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Required for wagmi / viem WASM
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },

  // Allow images from explorer domains (optional)
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.arc-testnet.example.com" },
    ],
  },

  // Env validation at build time
  env: {
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
  },
};

module.exports = nextConfig;
```

---

## 11. Arc Testnet Chain Definition

### `packages/frontend/src/lib/chains.ts`

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

### `packages/frontend/src/lib/contracts.ts`

```typescript
// Contract addresses loaded from environment variables
export const TREASURY_VAULT_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_VAULT_ADDRESS as `0x${string}`;
export const PAYOUT_ROUTER_ADDRESS  = process.env.NEXT_PUBLIC_PAYOUT_ROUTER_ADDRESS  as `0x${string}`;
export const BUDGET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_BUDGET_MANAGER_ADDRESS as `0x${string}`;
export const USDC_ADDRESS           = process.env.NEXT_PUBLIC_USDC_ADDRESS           as `0x${string}`;

// ABI re-exports
export { TreasuryVaultABI } from './abis/TreasuryVault';
export { PayoutRouterABI }  from './abis/PayoutRouter';
export { BudgetManagerABI } from './abis/BudgetManager';
```

---

## 12. Providers Setup

The provider setup is split across multiple files for modularity:

### `packages/frontend/src/providers/wagmi.ts`

```typescript
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { arcTestnet } from '@/lib/chains';

export const config = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0], {
      timeout: 5_000,
      retryCount: 1,
    }),
  },
  ssr: true,
  multiInjectedProviderDiscovery: false,
});
```

> **Note:** Uses `createConfig` directly (not `getDefaultConfig`) to avoid pulling
> in the WalletConnect SDK. Only `injected()` (MetaMask / browser wallets) is supported.

### `packages/frontend/src/providers/query.ts`

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

### `packages/frontend/src/providers/index.tsx`

```tsx
'use client';

import { Component, type ReactNode, useMemo } from 'react';
import { ThemeProvider } from 'next-themes';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { config } from '@/providers/wagmi';
import { queryClient } from '@/providers/query';
import '@rainbow-me/rainbowkit/styles.css';

class WalletErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const rainbowTheme = useMemo(
    () => ({
      darkMode: darkTheme({ accentColor: '#C9A962' }),
      lightMode: lightTheme({ accentColor: '#C9A962' }),
    }),
    [],
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <WalletErrorBoundary fallback={children}>
          <WagmiProvider config={config} reconnectOnMount={false}>
            <RainbowKitProvider theme={rainbowTheme}>
              {children}
            </RainbowKitProvider>
          </WagmiProvider>
        </WalletErrorBoundary>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
```

Provider stack (outer to inner):
1. `ThemeProvider` (next-themes) — dark mode default, no system theme
2. `QueryClientProvider` (TanStack Query) — shared query client
3. `WalletErrorBoundary` — prevents wallet crashes from breaking the app
4. `WagmiProvider` — configured with Arc Testnet chain
5. `RainbowKitProvider` — gold accent color `#C9A962`

### `packages/frontend/src/app/layout.tsx` (root layout)

```tsx
import { Inter, Cormorant_Garamond } from 'next/font/google';
import { Providers } from '@/providers';
import { AppShell } from '@/components/layout/AppShell';
import { QuickPayFAB } from '@/components/quick-pay/QuickPayFAB';
import '@/app/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata = {
  title: 'ArcVault — Enterprise Treasury & FX',
  description: 'Enterprise treasury management and FX operations on Arc blockchain',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable} dark`} suppressHydrationWarning>
      <body className="bg-background text-foreground font-sans antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
          <QuickPayFAB />
        </Providers>
      </body>
    </html>
  );
}
```

Key differences from initial plan:
- **Cormorant Garamond** (serif display font) replaces JetBrains Mono (monospace)
- **`Providers`** from `@/providers` (multi-file setup) replaces `Web3Provider`
- **`AppShell`** wraps all page content (sidebar + header)
- **`QuickPayFAB`** rendered globally at root layout level
- `suppressHydrationWarning` for `next-themes` compatibility

---

## 13. Bootstrap Checklist

Run these commands in order to go from zero to running:

```bash
# 1. Clone & install
git clone <repo-url> arcvault && cd arcvault
corepack enable && pnpm install

# 2. Environment
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL

# 3. Database
pnpm db:migrate   # creates tables
pnpm db:seed      # populates demo data

# 4. Contracts
cd packages/contracts
forge install OpenZeppelin/openzeppelin-contracts --no-commit
cd ../..
pnpm contracts:build
pnpm contracts:test

# 5. Frontend
pnpm dev          # http://localhost:3000
```

---

## 14. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `pnpm-workspace.yaml` | Create | Workspace definition |
| `package.json` (root) | Create | Workspace scripts |
| `.gitignore` | Create | Ignore rules |
| `.env.example` | Create | Environment variable template |
| `packages/contracts/foundry.toml` | Create | Foundry configuration |
| `packages/contracts/package.json` | Create | Contracts workspace manifest |
| `packages/frontend/package.json` | Create | Frontend workspace manifest |
| `packages/frontend/tsconfig.json` | Create | TypeScript config |
| `packages/frontend/next.config.js` | Create | Next.js config |
| `packages/frontend/tailwind.config.ts` | Create | Tailwind theme & design tokens |
| `packages/frontend/postcss.config.js` | Create | PostCSS plugins |
| `packages/frontend/src/lib/chains.ts` | Create | Arc Testnet chain definition |
| `packages/frontend/src/lib/contracts.ts` | Create | Contract address constants |
| `packages/frontend/src/providers/Web3Provider.tsx` | Create | RainbowKit + wagmi provider |
| `packages/frontend/src/app/layout.tsx` | Create | Root layout with providers |

---

## 15. Cross-references

| Document | Relevance |
|----------|-----------|
| `docs/technical/06-database-schema.md` | Prisma schema.prisma content and migrations |
| `docs/frontend/01-design-system.md` | Expanded Tailwind tokens, component library, typography scale |
| `docs/technical/09-deployment.md` | Production env var configuration, Vercel project settings, Railway setup |
| `docs/technical/02-treasury-vault-contract.md` | First contract to implement after scaffold |
| `docs/technical/03-payout-router-contract.md` | Second contract |
| `docs/technical/04-budget-manager-contract.md` | Third contract |
