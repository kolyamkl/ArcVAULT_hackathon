# 09 — Deployment Pipeline Specification

> **Scope:** Complete deployment instructions for smart contracts (Arc Testnet), frontend (Vercel), and database (Railway). Covers build, deploy, seed, and post-deploy verification.

---

## Table of Contents

1. [Overview](#overview)
2. [Contract Deployment (Arc Testnet)](#contract-deployment-arc-testnet)
3. [Seed Data (On-Chain)](#seed-data-on-chain)
4. [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
5. [Database Deployment (Railway)](#database-deployment-railway)
6. [Post-Deploy Verification Checklist](#post-deploy-verification-checklist)
7. [Files to Create / Modify](#files-to-create--modify)
8. [Cross-references](#cross-references)

---

## Overview

ArcVault has three deployment targets that must be set up in order:

```
1. Database (Railway)       ← Prisma schema, migrations, seed
2. Smart Contracts (Arc)    ← Foundry build, deploy, verify
3. Frontend (Vercel)        ← Next.js build, env vars from steps 1 & 2
```

The database must exist first so the frontend can run migrations at build time. Contracts must be deployed before the frontend because the frontend needs deployed contract addresses as environment variables.

---

## Contract Deployment (Arc Testnet)

### Toolchain

- **Foundry** (forge, cast, anvil) — Solidity compilation, testing, scripting, deployment.
- Solidity version: `0.8.x` (match pragma in contracts).

### Prerequisites

```bash
# Install Foundry (if not present)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Verify
forge --version
cast --version
```

### Environment Variables (Local)

Create `packages/contracts/.env`:

```bash
DEPLOYER_PRIVATE_KEY=0x...      # Private key with testnet funds
ARC_RPC_URL=https://...         # Arc testnet RPC endpoint
USDC_ADDRESS=0x...              # Pre-deployed testnet USDC (or deploy MockERC20)
EURC_ADDRESS=0x...              # Pre-deployed testnet EURC (optional)
```

### Deploy Script

**File:** `packages/contracts/script/Deploy.s.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/TreasuryVault.sol";
import "../src/PayoutRouter.sol";
import "../src/BudgetManager.sol";
import "../src/MockUSYC.sol";
import "../src/MockStableFX.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address usdc = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        // ── Step 1: Deploy MockUSYC (yield token) ────────────────
        // In production, replace with the real USYC token address.
        MockUSYC usyc = new MockUSYC(usdc);
        usyc.setYieldRate(485); // 4.85% APY (basis points)

        // ── Step 2: Deploy TreasuryVault ─────────────────────────
        // threshold = $50,000 USDC (6 decimals → 50_000_000_000)
        TreasuryVault vault = new TreasuryVault(
            usdc,
            address(usyc),
            50_000e6,   // liquidityThreshold
            deployer    // initialAdmin
        );

        // ── Step 3: Deploy MockStableFX ──────────────────────────
        MockStableFX stablefx = new MockStableFX();
        // Set initial FX rates (18-decimal fixed point)
        stablefx.setRate(usdc, vm.envOr("EURC_ADDRESS", address(0)), 0.9235e18);

        // ── Step 4: Deploy BudgetManager ─────────────────────────
        BudgetManager budgetMgr = new BudgetManager(
            address(vault),
            usdc,
            deployer    // initialAdmin
        );

        // ── Step 5: Deploy PayoutRouter ──────────────────────────
        PayoutRouter router = new PayoutRouter(
            address(vault),
            address(stablefx),
            address(budgetMgr),
            usdc,
            deployer    // initialAdmin
        );

        // ── Step 6: Grant roles ──────────────────────────────────
        // PayoutRouter and BudgetManager need TREASURY_MANAGER_ROLE
        // to withdraw from the vault.
        bytes32 TREASURY_MANAGER_ROLE = vault.TREASURY_MANAGER_ROLE();
        vault.grantRole(TREASURY_MANAGER_ROLE, address(router));
        vault.grantRole(TREASURY_MANAGER_ROLE, address(budgetMgr));

        vm.stopBroadcast();

        // ── Log deployed addresses ───────────────────────────────
        console.log("=== Deployed Addresses ===");
        console.log("USDC:            ", usdc);
        console.log("MockUSYC:        ", address(usyc));
        console.log("TreasuryVault:   ", address(vault));
        console.log("MockStableFX:    ", address(stablefx));
        console.log("BudgetManager:   ", address(budgetMgr));
        console.log("PayoutRouter:    ", address(router));
        console.log("Deployer:        ", deployer);
    }
}
```

### Build and Deploy Commands

```bash
# ── Navigate to contracts package ─────────────────────────────────
cd packages/contracts

# ── Build all contracts ───────────────────────────────────────────
forge build

# ── Run full test suite ───────────────────────────────────────────
forge test -vvv

# ── Deploy to Arc testnet ─────────────────────────────────────────
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $ARC_RPC_URL \
  --broadcast \
  --verify

# The broadcast output is saved to:
#   packages/contracts/broadcast/Deploy.s.sol/<chainId>/run-latest.json
```

### Deployed Addresses File

After deployment, manually (or via a post-deploy script) create the following file so the frontend and other tooling can reference contract addresses.

**File:** `packages/contracts/deployments/arc-testnet.json`

```json
{
  "chainId": "<ARC_TESTNET_CHAIN_ID>",
  "networkName": "Arc Testnet",
  "contracts": {
    "usdc": "0x...",
    "usyc": "0x...",
    "treasuryVault": "0x...",
    "payoutRouter": "0x...",
    "budgetManager": "0x...",
    "stableFX": "0x...",
    "accessControl": "0x..."
  },
  "deployer": "0x...",
  "deployedAt": "2024-XX-XXTXX:XX:XXZ",
  "blockNumber": 0
}
```

> **Tip:** You can automate this by reading the Foundry broadcast JSON (`broadcast/Deploy.s.sol/<chainId>/run-latest.json`) and extracting the `contractAddress` fields.

---

## Seed Data (On-Chain)

After contracts are deployed, populate the system with demo data so the dashboard is not empty on first load.

### Seed Script (Cast Commands)

```bash
#!/usr/bin/env bash
# packages/contracts/script/seed.sh
# Run: bash packages/contracts/script/seed.sh

set -euo pipefail

# ── Load addresses from deployment ────────────────────────────────
# These should be set as env vars or read from arc-testnet.json.
: "${ARC_RPC_URL:?Set ARC_RPC_URL}"
: "${DEPLOYER_PRIVATE_KEY:?Set DEPLOYER_PRIVATE_KEY}"
: "${USDC:?Set USDC address}"
: "${TREASURY_VAULT:?Set TREASURY_VAULT address}"
: "${BUDGET_MANAGER:?Set BUDGET_MANAGER address}"
: "${DEMO_WALLET:?Set DEMO_WALLET address}"

RPC="--rpc-url $ARC_RPC_URL"
PK="--private-key $DEPLOYER_PRIVATE_KEY"

echo "=== Step 1: Mint testnet USDC ($1M to demo wallet) ==="
cast send $USDC "mint(address,uint256)" \
  $DEMO_WALLET 1000000000000 \
  $RPC $PK
# 1,000,000 USDC = 1_000_000_000_000 (6 decimals)

echo "=== Step 2: Approve TreasuryVault to spend USDC ==="
cast send $USDC "approve(address,uint256)" \
  $TREASURY_VAULT 1000000000000 \
  $RPC $PK

echo "=== Step 3: Deposit $500K into vault ==="
# depositFunds will auto-sweep excess above threshold to USYC
cast send $TREASURY_VAULT "depositFunds(uint256)" \
  500000000000 \
  $RPC $PK
# 500,000 USDC = 500_000_000_000

echo "=== Step 4: Create sample budgets ==="

# Engineering budget: $100K, 90-day window
ENG_HEAD="${ENG_HEAD:-$DEMO_WALLET}"
EXPIRY_90D=$(date -v+90d +%s 2>/dev/null || date -d "+90 days" +%s)

cast send $BUDGET_MANAGER \
  "createBudget(string,address,uint256,uint256)" \
  "Engineering" $ENG_HEAD 100000000000 $EXPIRY_90D \
  $RPC $PK

# Marketing budget: $50K, 90-day window
MKT_HEAD="${MKT_HEAD:-$DEMO_WALLET}"
cast send $BUDGET_MANAGER \
  "createBudget(string,address,uint256,uint256)" \
  "Marketing" $MKT_HEAD 50000000000 $EXPIRY_90D \
  $RPC $PK

# Operations budget: $75K, 90-day window
OPS_HEAD="${OPS_HEAD:-$DEMO_WALLET}"
cast send $BUDGET_MANAGER \
  "createBudget(string,address,uint256,uint256)" \
  "Operations" $OPS_HEAD 75000000000 $EXPIRY_90D \
  $RPC $PK

# HR budget: $40K, 90-day window
HR_HEAD="${HR_HEAD:-$DEMO_WALLET}"
cast send $BUDGET_MANAGER \
  "createBudget(string,address,uint256,uint256)" \
  "Human Resources" $HR_HEAD 40000000000 $EXPIRY_90D \
  $RPC $PK

echo "=== Seeding complete ==="
echo "Vault deposit: 500,000 USDC"
echo "Budgets created: Engineering (100K), Marketing (50K), Operations (75K), HR (40K)"
```

### Foundry-Based Seed Script (Alternative)

**File:** `packages/contracts/script/Seed.s.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/TreasuryVault.sol";
import "../src/BudgetManager.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Seed is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address vault = vm.envAddress("TREASURY_VAULT");
        address budgetMgr = vm.envAddress("BUDGET_MANAGER");
        address demoWallet = vm.envAddress("DEMO_WALLET");

        vm.startBroadcast(deployerPrivateKey);

        // Mint $1M testnet USDC
        // Assumes USDC has a public mint function (testnet only)
        (bool ok, ) = usdc.call(
            abi.encodeWithSignature("mint(address,uint256)", demoWallet, 1_000_000e6)
        );
        require(ok, "Mint failed");

        // Approve vault
        IERC20(usdc).approve(vault, 1_000_000e6);

        // Deposit $500K
        TreasuryVault(vault).depositFunds(500_000e6);

        // Create budgets
        uint256 expiry = block.timestamp + 90 days;
        BudgetManager(budgetMgr).createBudget("Engineering", demoWallet, 100_000e6, expiry);
        BudgetManager(budgetMgr).createBudget("Marketing", demoWallet, 50_000e6, expiry);
        BudgetManager(budgetMgr).createBudget("Operations", demoWallet, 75_000e6, expiry);
        BudgetManager(budgetMgr).createBudget("Human Resources", demoWallet, 40_000e6, expiry);

        vm.stopBroadcast();

        console.log("Seed complete: 500K deposited, 4 budgets created");
    }
}
```

Run:

```bash
forge script script/Seed.s.sol:Seed \
  --rpc-url $ARC_RPC_URL \
  --broadcast
```

---

## Frontend Deployment (Vercel)

### Build Process

The frontend is deployed to Vercel via Git push to the `main` branch.

```
Push to main → Vercel detects change → Runs build → Deploys to edge
```

### Vercel Project Configuration

Configure these settings in the Vercel dashboard (or `vercel.json`):

| Setting | Value |
|---------|-------|
| **Root directory** | `packages/frontend` |
| **Framework preset** | Next.js |
| **Node.js version** | 18.x or 20.x |
| **Build command** | `npx prisma generate && next build` |
| **Output directory** | `.next` (default) |
| **Install command** | `pnpm install` (runs from monorepo root) |

### vercel.json (Optional)

Place at the monorepo root if you need cron jobs or custom configuration.

**File:** `vercel.json`

```json
{
  "buildCommand": "cd packages/frontend && npx prisma generate && next build",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "outputDirectory": "packages/frontend/.next",
  "crons": [
    {
      "path": "/api/cron/index-events",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Environment Variables

Configure all of the following in the Vercel dashboard under **Settings > Environment Variables**:

| Variable | Example Value | Scope | Notes |
|----------|--------------|-------|-------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/arcvault?sslmode=require` | All | Railway connection string |
| `ARC_RPC_URL` | `https://rpc.arc-testnet.io` | Server | Arc testnet JSON-RPC |
| `NEXT_PUBLIC_CHAIN_ID` | `TBD` | All | Arc testnet chain ID (used by wagmi) |
| `NEXT_PUBLIC_TREASURY_VAULT_ADDRESS` | `0x...` | All | From deployment output |
| `NEXT_PUBLIC_PAYOUT_ROUTER_ADDRESS` | `0x...` | All | From deployment output |
| `NEXT_PUBLIC_BUDGET_MANAGER_ADDRESS` | `0x...` | All | From deployment output |
| `NEXT_PUBLIC_USDC_ADDRESS` | `0x...` | All | Testnet USDC token |
| `NEXT_PUBLIC_USYC_ADDRESS` | `0x...` | All | MockUSYC token |
| `NEXT_PUBLIC_STABLEFX_ADDRESS` | `0x...` | All | MockStableFX contract |
| `CPN_API_KEY` | `cpn_test_...` | Server | Circle Payments Network |
| `CPN_API_URL` | `https://api.circle.com/cpn` | Server | CPN base URL |
| `STABLEFX_API_KEY` | `sfx_test_...` | Server | StableFX API key |
| `STABLEFX_API_URL` | `https://api.stablefx.io` | Server | StableFX base URL |
| `INTEGRATION_MODE` | `mock` | Server | Start with `mock`, switch to `real` when APIs are ready |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | `abc123...` | All | From WalletConnect Cloud dashboard |

**Scope definitions:**
- **All** = available in both server-side and client-side code.
- **Server** = only available in server-side code (API routes, server components).

> **Important:** Variables prefixed with `NEXT_PUBLIC_` are embedded into the client bundle at build time. Never put secrets in `NEXT_PUBLIC_` variables.

### Build Verification

After a successful Vercel deployment, the build logs should show:

```
prisma generate        → "Generated Prisma Client"
next build             → "Compiled successfully"
                       → Route (app) listing all pages and API routes
Serverless Functions   → All /api/* routes listed
```

---

## Database Deployment (Railway)

### Setup Steps

1. **Create a Railway account** at [railway.app](https://railway.app).
2. **Create a new project** in Railway.
3. **Add a PostgreSQL service**:
   - Click "New" → "Database" → "PostgreSQL".
   - Railway provisions PostgreSQL 15+ automatically.
4. **Copy the connection string**:
   - Go to the PostgreSQL service → "Variables" tab.
   - Copy `DATABASE_URL` (format: `postgresql://user:pass@host:port/dbname`).
   - Add `?sslmode=require` if Railway requires SSL.

### Railway Configuration

| Setting | Value |
|---------|-------|
| **Database engine** | PostgreSQL 15+ |
| **Region** | US East (match Vercel region for lowest latency) |
| **Backups** | Automatic (Railway default) |
| **Connection pooling** | Enabled (recommended for serverless) |

### Run Migrations

From the monorepo root (or CI pipeline):

```bash
# Ensure DATABASE_URL is set
export DATABASE_URL="postgresql://..."

# Navigate to frontend package (Prisma schema lives here)
cd packages/frontend

# Run migrations in production mode (applies all pending migrations)
npx prisma migrate deploy

# Verify migration status
npx prisma migrate status
```

### Seed the Database

The Prisma seed script populates initial data (optional demo records, reference data).

```bash
cd packages/frontend

# Run the seed script defined in package.json prisma.seed
npx prisma db seed
```

The seed script should be defined in `packages/frontend/package.json`:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

### Database Schema Verification

After migration, verify the tables exist:

```bash
# List all tables
npx prisma db execute --stdin <<< "SELECT tablename FROM pg_tables WHERE schemaname='public';"

# Expected tables:
# - Payout
# - Transaction
# - FXQuote
# - VaultSnapshot
# - Pipeline
# - PipelineExecution
# - _prisma_migrations
```

---

## Post-Deploy Verification Checklist

Run through this checklist after deploying all three components:

### Contracts

- [ ] All contracts deployed to Arc testnet (addresses logged).
- [ ] Contracts verified on block explorer (if available).
- [ ] `arc-testnet.json` created with all addresses.
- [ ] Roles granted correctly:
  ```bash
  # Verify PayoutRouter has TREASURY_MANAGER_ROLE on vault
  cast call $TREASURY_VAULT "hasRole(bytes32,address)(bool)" \
    $(cast call $TREASURY_VAULT "TREASURY_MANAGER_ROLE()(bytes32)" --rpc-url $ARC_RPC_URL) \
    $PAYOUT_ROUTER \
    --rpc-url $ARC_RPC_URL
  # Should return: true
  ```
- [ ] Seed data applied (vault has USDC, budgets created).

### Database

- [ ] Railway PostgreSQL instance running.
- [ ] Migrations applied successfully (`npx prisma migrate status` shows no pending).
- [ ] Seed data loaded (if applicable).
- [ ] Connection from Vercel serverless functions verified (no SSL/timeout issues).

### Frontend

- [ ] Vercel deployment succeeded (green build).
- [ ] Application accessible at Vercel URL.
- [ ] No console errors on initial load.
- [ ] RainbowKit wallet connection modal appears.
- [ ] Can connect wallet (MetaMask / WalletConnect).
- [ ] Dashboard loads with seed data:
  - Total AUM shows ~$500K.
  - Vault breakdown shows USDC + USYC split.
  - Yield chart renders.
- [ ] Contract interactions work:
  - Deposit USDC into vault (test with small amount).
  - Withdraw USDC from vault.
  - Vault auto-sweeps excess to USYC on deposit.
- [ ] API routes return data:
  - `GET /api/dashboard` returns stats.
  - `GET /api/vault/status` returns on-chain data.
  - `GET /api/transactions` returns indexed events.
- [ ] FX module works (mock mode):
  - `GET /api/fx/quote?from=USDC&to=EURC&amount=10000` returns a quote.
  - `POST /api/fx/execute` with valid quoteId succeeds.
- [ ] Pipeline builder:
  - Canvas loads (React Flow renders).
  - Can drag/drop nodes.
  - Can save pipeline (`POST /api/pipelines`).
  - Can load saved pipeline.

### Cron Job (Event Indexing)

- [ ] Vercel cron job configured (visible in Vercel dashboard under "Cron Jobs").
- [ ] Manual trigger works:
  ```bash
  curl https://your-app.vercel.app/api/cron/index-events
  # Should return: {"ok":true,"timestamp":"..."}
  ```
- [ ] After cron runs, new `Transaction` and `VaultSnapshot` records appear in DB.

---

## Files to Create / Modify

| File | Purpose |
|------|---------|
| `packages/contracts/script/Deploy.s.sol` | Foundry deployment script for all contracts |
| `packages/contracts/script/Seed.s.sol` | Foundry-based on-chain seed script |
| `packages/contracts/script/seed.sh` | Shell-based on-chain seed script (alternative) |
| `packages/contracts/deployments/arc-testnet.json` | Template for deployed contract addresses |
| `packages/contracts/.env.example` | Example env vars for contract deployment |
| `vercel.json` | Vercel build config + cron job definition |
| `packages/frontend/prisma/seed.ts` | Prisma database seed script |

---

## Cross-references

| Document | Relevance |
|----------|-----------|
| `docs/technical/01-monorepo-setup.md` | Project structure, pnpm workspace config, env var setup |
| `docs/technical/02-treasury-vault-contract.md` | TreasuryVault constructor params, role constants |
| `docs/technical/03-payout-router-contract.md` | PayoutRouter constructor params, role requirements |
| `docs/technical/04-budget-manager-contract.md` | BudgetManager constructor, createBudget function signature |
| `docs/technical/05-access-control-contract.md` | Role definitions, grantRole patterns |
| `docs/technical/06-database-schema.md` | Prisma schema, migration commands, seed script details |
| `docs/technical/08-external-integrations.md` | INTEGRATION_MODE env var, cron-based event indexing |
