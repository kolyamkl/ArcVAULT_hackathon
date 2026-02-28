# ArcVault Frontend Architecture Notes

## Database Models (Prisma)
- Transaction (universal ledger), Payout, FXQuote, Pipeline, PipelineExecution, Budget, VaultSnapshot
- All use cuid() IDs, string-based status/type enums (not Prisma enums)
- Decimal fields for monetary values, Json fields for flexible data (nodes, edges, metadata, results)

## Adapter Pattern
- Interfaces in `src/types/integrations.ts`: IUSYCAdapter, IStableFXAdapter, ICPNAdapter
- Each has Real + Mock implementation in `src/services/*.service.ts`
- Factory functions in `src/services/index.ts` with lazy singleton init
- `chain.service.ts` breaks the pattern -- no interface, direct prisma coupling

## Duplication Hotspots
1. Try/catch + console.error + 500 response: every route handler (14x)
2. Zod safeParse + 400 validation response: 7 routes
3. Paginated response construction: 5 routes
4. Mock txHash generation: 3 locations (payouts/route, payouts/batch/route, stablefx.service)
5. Payout+Transaction creation: payouts/route POST and payouts/batch/route
6. HTTP request<T> method: RealStableFXAdapter and RealCPNAdapter (identical)

## Security Concerns
- Zero auth/authz on all routes
- `sort` param from user input not validated against allowlist
- Non-null assertions on env vars could lead to silent undefined usage
