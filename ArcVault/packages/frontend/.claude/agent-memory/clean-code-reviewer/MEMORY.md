# ArcVault Clean Code Review Memory

## Project Structure
- Monorepo: `D:\ArcVault\ArcVault\packages\`
- Contracts: `packages/contracts/` (Foundry project, Solidity ^0.8.20, OZ v5)
- Frontend: `packages/frontend/` (Next.js App Router, React Query, Zustand, Prisma, viem)

## Contracts Architecture
- **TreasuryVault**: Core vault for USDC, auto-sweeps to USYC (yield), OZ AccessControl + Pausable + ReentrancyGuard
- **PayoutRouter**: Pulls from TreasuryVault, optional FX via IStableFX, batch payouts
- **BudgetManager**: Department budget allocation, pulls from TreasuryVault
- **ArcVaultAccessControl**: Centralized role definitions (UNUSED - dead code as of initial commit)
- Interfaces: IUSYC, IStableFX in `src/interfaces/`
- Mocks: MockERC20, MockUSYC, MockStableFX in `src/mocks/`

## Frontend Architecture (as of 2026-02-25)
- State: Zustand store at `stores/pipeline.store.ts` for pipeline editor + execution state
- Queries: React Query with centralized key factory at `lib/queryKeys.ts`
- API client: `lib/api.ts` -- typed fetch wrapper
- Validation: Zod schemas at `lib/validations/api.ts`
- Chain interaction: `lib/viem-server.ts` (server-side wallet/public clients), `lib/chains.ts`
- Pipeline engine: `lib/pipeline-engine.ts` -- server-side DAG executor
- FX service: `services/stablefx.service.ts` -- Mock + Real adapters behind IStableFXAdapter

## Pipeline Execution Pattern
- Fire-and-forget: execute route creates DB record, HTTP-calls process route internally
- Process route runs pipeline-engine synchronously, persisting progress after each node
- Frontend polls GET `/api/pipelines/executions/[executionId]` every 2s
- ExecutionAnimation component orchestrates polling lifecycle

## Known Issues (Contract Review 2026-02-25)
- Duplicate ITreasuryVault interface inline in PayoutRouter.sol AND BudgetManager.sol
- ArcVaultAccessControl.sol is dead code
- Role constants duplicated across contracts
- TreasuryVault.sweepToUSYC() and redeemFromUSYC() have no access control
- PayoutRouter.budgetManager stored but never used
- getPayoutsByStatus() iterates entire array - gas bomb on-chain

## Known Issues (Frontend Pipeline Review 2026-02-25)
- NO AUTH on any pipeline API routes (critical: process endpoint publicly callable)
- No idempotency guard on process endpoint (can re-execute same pipeline)
- No staleness recovery for orphaned RUNNING executions
- ExecutionStep/ExecutionLogEntry types duplicated 3x (types/api, engine, hook)
- Store ExecutionLogEntry uses Date vs API string for timestamp
- FX adapter always Mock regardless of INTEGRATION_MODE (bug at engine line 211)
- Side effects in React Query select callback (should be useEffect)
- Full Zustand store subscription in usePipelineExecution hook (perf)

## Naming Conventions
- Custom errors preferred over require strings in production contracts
- Events use past tense (FundsDeposited, FundsWithdrawn)
- Role constants: SCREAMING_SNAKE_CASE with _ROLE suffix
- Frontend: camelCase functions, PascalCase components/types

## Testing Patterns
- Foundry forge-std/Test.sol for contracts
- Mock vaults duplicated inline in test files
- No fuzz tests despite fuzz config in foundry.toml

## Recurring Patterns to Watch
- Type duplication across layers (server/hook/store)
- Missing auth on internal API routes
- Mock adapters hardcoded instead of config-injected
