# Hooks, Zustand Stores, and TanStack Query Configuration

> **Purpose:** Defines all custom hooks, Zustand state stores, TanStack Query configuration, and utility functions used across the ArcVault frontend. Each page-level doc references hooks defined here; this document is the single source of truth for data-fetching patterns and shared state.
>
> **Tech stack:** TanStack Query v5, Zustand v4, wagmi v2, viem v2

---

## Table of Contents

1. [TanStack Query Configuration](#tanstack-query-configuration)
2. [Query Key Conventions](#query-key-conventions)
3. [Data Fetching Hooks (TanStack Query + API)](#data-fetching-hooks-tanstack-query--api)
4. [Contract Write Hooks (wagmi)](#contract-write-hooks-wagmi)
5. [Zustand Stores](#zustand-stores)
6. [Utility Functions](#utility-functions)
7. [Files to Create](#files-to-create)
8. [Cross-references](#cross-references)

---

## TanStack Query Configuration

**File:** `packages/frontend/src/providers/query.ts`

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,        // 10 seconds — data considered fresh
      refetchInterval: 10_000,  // Poll every 10s for live data
      retry: 2,                 // Retry failed requests twice
      refetchOnWindowFocus: true,
    },
  },
});
```

**Provider setup** (in `packages/frontend/src/app/layout.tsx` or a dedicated Providers wrapper):

```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/providers/query';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* WagmiProvider, RainbowKitProvider, etc. */}
      {children}
    </QueryClientProvider>
  );
}
```

---

## Query Key Conventions

**File:** `packages/frontend/src/lib/queryKeys.ts`

All query keys are centralized for consistency. This prevents key collisions and makes invalidation predictable.

```typescript
export const queryKeys = {
  // Dashboard
  dashboard: ['dashboard'] as const,

  // Vault
  vault: {
    status: ['vault', 'status'] as const,
    history: (params: VaultHistoryParams) =>
      ['vault', 'history', params] as const,
    balances: ['vault', 'balances'] as const,
  },

  // FX
  fx: {
    quote: (pair: string, amount: string) =>
      ['fx', 'quote', pair, amount] as const,
    history: (params: FXHistoryParams) =>
      ['fx', 'history', params] as const,
  },

  // Payouts
  payouts: {
    list: (params: PayoutListParams) =>
      ['payouts', 'list', params] as const,
    detail: (id: string) =>
      ['payouts', 'detail', id] as const,
  },

  // Pipelines
  pipelines: {
    list: ['pipelines', 'list'] as const,
    detail: (id: string) =>
      ['pipelines', 'detail', id] as const,
    history: (id: string) =>
      ['pipelines', 'history', id] as const,
  },

  // Budgets
  budgets: {
    list: ['budgets', 'list'] as const,
    detail: (id: string) =>
      ['budgets', 'detail', id] as const,
  },
} as const;
```

**Parameter types:**

```typescript
interface VaultHistoryParams {
  type?: 'deposit' | 'withdraw' | 'yield' | 'rebalance';
  page: number;
  limit: number;
}

interface FXHistoryParams {
  page: number;
  limit: number;
}

interface PayoutListParams {
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}
```

---

## Data Fetching Hooks (TanStack Query + API)

All data-fetching hooks follow this pattern:

```typescript
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { api } from '@/lib/api'; // API client (see docs/frontend/02-app-shell.md)

export function useHookName(params) {
  return useQuery({
    queryKey: queryKeys.xxx,
    queryFn: () => api.xxx(params),
    // hook-specific options
  });
}
```

---

### 1. useDashboardStats

**File:** `packages/frontend/src/hooks/useDashboardStats.ts`

```typescript
export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => api.get('/api/dashboard'),
    // Uses default staleTime (10s) and refetchInterval (10s)
  });
}
```

**Endpoint:** `GET /api/dashboard`

**Returns:**

```typescript
interface DashboardStats {
  totalAUM: number;           // Total assets under management
  liquidUSDC: number;         // Available USDC balance
  usycPosition: number;       // USYC yield position value
  yieldEarned: number;        // Cumulative yield earned
  currentAPY: number;         // Current USYC APY percentage
  pendingPayouts: number;     // Count of pending payouts
  recentActivity: Activity[]; // Last N activity items
}
```

**Used by:** Dashboard page (`docs/frontend/03-dashboard-page.md`).

---

### 2. useVaultBalances

**File:** `packages/frontend/src/hooks/useVaultBalances.ts`

```typescript
import { useReadContracts } from 'wagmi';
import { treasuryVaultAbi, treasuryVaultAddress } from '@/lib/contracts';

export function useVaultBalances() {
  const { data, isLoading, error } = useReadContracts({
    contracts: [
      {
        address: treasuryVaultAddress,
        abi: treasuryVaultAbi,
        functionName: 'getLiquidBalance',
      },
      {
        address: treasuryVaultAddress,
        abi: treasuryVaultAbi,
        functionName: 'getUSYCBalance',
      },
      {
        address: treasuryVaultAddress,
        abi: treasuryVaultAbi,
        functionName: 'getTotalValue',
      },
      {
        address: treasuryVaultAddress,
        abi: treasuryVaultAbi,
        functionName: 'getYieldAccrued',
      },
      {
        address: treasuryVaultAddress,
        abi: treasuryVaultAbi,
        functionName: 'liquidityThreshold',
      },
    ],
    query: {
      refetchInterval: 10_000, // Poll every 10s
    },
  });

  return {
    liquidUSDC: data?.[0]?.result ?? 0n,
    usycBalance: data?.[1]?.result ?? 0n,
    totalValue: data?.[2]?.result ?? 0n,
    yieldAccrued: data?.[3]?.result ?? 0n,
    threshold: data?.[4]?.result ?? 0n,
    isLoading,
    error,
  };
}
```

**Source:** On-chain reads via wagmi (TreasuryVault contract).

**Used by:** Dashboard, Vault page, FX page (balance display), Pipeline Builder (TreasurySourceNode), Quick Pay (balance hint).

---

### 3. useVaultHistory

**File:** `packages/frontend/src/hooks/useVaultHistory.ts`

```typescript
export function useVaultHistory(params: VaultHistoryParams) {
  return useQuery({
    queryKey: queryKeys.vault.history(params),
    queryFn: () => api.get('/api/vault/history', { params }),
  });
}
```

**Endpoint:** `GET /api/vault/history`

**Params:** `{ type?: string, page: number, limit: number }`

**Returns:** `{ events: VaultEvent[], total: number, page: number, limit: number }`

**Used by:** Vault page (`docs/frontend/04-vault-page.md`).

---

### 4. useYieldBreakdown

**File:** `packages/frontend/src/hooks/useYieldBreakdown.ts`

```typescript
export function useYieldBreakdown() {
  return useQuery({
    queryKey: ['vault', 'yield-breakdown'],
    queryFn: async () => {
      const snapshots = await api.get('/api/vault/snapshots');
      return computeYieldBreakdown(snapshots);
    },
    staleTime: 60_000, // Yield data doesn't change rapidly
  });
}

function computeYieldBreakdown(snapshots: VaultSnapshot[]) {
  // Calculate daily, weekly, monthly yield from snapshot deltas
  return {
    daily: number,
    weekly: number,
    monthly: number,
    projectedAnnual: number,
    currentAPY: number,
  };
}
```

**Used by:** Dashboard (yield card), Vault page (yield chart).

---

### 5. useFXQuote

**File:** `packages/frontend/src/hooks/useFXQuote.ts`

```typescript
export function useFXQuote(pair: string, amount: string) {
  return useQuery({
    queryKey: queryKeys.fx.quote(pair, amount),
    queryFn: () => api.get('/api/fx/quote', { params: { pair, amount } }),
    enabled: Boolean(pair) && Boolean(amount) && Number(amount) > 0,
    staleTime: 25_000,       // Quote valid for 30s; refetch at 25s
    refetchInterval: 25_000, // Auto-refresh before expiry
  });
}
```

**Endpoint:** `GET /api/fx/quote?pair={pair}&amount={amount}`

**Returns:**

```typescript
interface FXQuote {
  quoteId: string;
  rate: number;
  spread: number;       // e.g., 0.0005 for 0.05%
  fromAmount: string;
  toAmount: string;
  expiresAt: string;    // ISO timestamp
}
```

**Countdown logic (consumer side):**

The consuming component (QuoteDisplay) manages the countdown via a `useEffect`:

```typescript
const [countdown, setCountdown] = useState(30);

useEffect(() => {
  if (!quote?.expiresAt) return;
  const interval = setInterval(() => {
    const remaining = Math.max(
      0,
      Math.floor((new Date(quote.expiresAt).getTime() - Date.now()) / 1000)
    );
    setCountdown(remaining);
  }, 1000);
  return () => clearInterval(interval);
}, [quote?.expiresAt]);
```

**Debouncing:** The consuming component should debounce the `amount` input by 500ms before passing it to this hook. Use a `useDebounce` utility:

```typescript
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}
```

**Used by:** FX page, Quick Pay modal.

---

### 6. useFXHistory

**File:** `packages/frontend/src/hooks/useFXHistory.ts`

```typescript
export function useFXHistory(params: FXHistoryParams) {
  return useQuery({
    queryKey: queryKeys.fx.history(params),
    queryFn: () => api.get('/api/fx/history', { params }),
  });
}
```

**Endpoint:** `GET /api/fx/history?page={page}&limit={limit}`

**Returns:** `{ quotes: FXHistoryEntry[], total: number, page: number, limit: number }`

**Used by:** FX page (FXHistoryTable).

---

### 7. usePayouts

**File:** `packages/frontend/src/hooks/usePayouts.ts`

```typescript
export function usePayouts(params: PayoutListParams) {
  return useQuery({
    queryKey: queryKeys.payouts.list(params),
    queryFn: () => api.get('/api/payouts', { params }),
  });
}
```

**Endpoint:** `GET /api/payouts`

**Params:** `{ status?, page, limit, sort?, order? }`

**Returns:** `{ payouts: Payout[], total: number, page: number, limit: number }`

**Used by:** Dashboard (recent payouts), Payout history views.

---

### 8. usePayoutStatus

**File:** `packages/frontend/src/hooks/usePayoutStatus.ts`

```typescript
export function usePayoutStatus(id: string) {
  return useQuery({
    queryKey: queryKeys.payouts.detail(id),
    queryFn: () => api.get(`/api/payouts/${id}`),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Poll every 5s while not terminal
      if (status === 'COMPLETED' || status === 'FAILED') return false;
      return 5_000;
    },
  });
}
```

**Endpoint:** `GET /api/payouts/[id]`

**Returns:** Full payout details including transaction history.

**Polling behavior:** Polls every 5 seconds while status is PENDING or PROCESSING. Stops polling when COMPLETED or FAILED.

**Used by:** Payout detail views, status tracking.

---

### 9. usePipelines

**File:** `packages/frontend/src/hooks/usePipelines.ts`

```typescript
export function usePipelines() {
  return useQuery({
    queryKey: queryKeys.pipelines.list,
    queryFn: () => api.get('/api/pipelines'),
  });
}
```

**Endpoint:** `GET /api/pipelines`

**Returns:** `Pipeline[]` (list of saved pipeline configs with id, name, metadata).

**Used by:** Pipeline Builder (SavedConfigs panel).

---

### 10. usePipeline

**File:** `packages/frontend/src/hooks/usePipeline.ts`

```typescript
export function usePipeline(id: string | null) {
  return useQuery({
    queryKey: queryKeys.pipelines.detail(id!),
    queryFn: () => api.get(`/api/pipelines/${id}`),
    enabled: Boolean(id),
  });
}
```

**Endpoint:** `GET /api/pipelines/[id]`

**Returns:** Full pipeline definition including React Flow `nodes[]`, `edges[]`, and execution history.

**Used by:** Pipeline Builder (loading a saved pipeline).

---

### 11. usePipelineExecution

**File:** `packages/frontend/src/hooks/usePipelineExecution.ts`

```typescript
export function usePipelineExecution(executionId: string | null) {
  const pipelineStore = usePipelineStore();

  return useQuery({
    queryKey: ['pipelines', 'execution', executionId],
    queryFn: () => api.get(`/api/pipelines/executions/${executionId}`),
    enabled: Boolean(executionId),
    refetchInterval: (query) => {
      const execution = query.state.data;
      if (!execution || execution.status === 'COMPLETED' || execution.status === 'FAILED') {
        return false;
      }
      return 2_000; // Poll every 2s during execution
    },
    // Update store on each poll
    select: (data) => {
      if (data) {
        // Update node statuses in the pipeline store for animation
        for (const step of data.steps) {
          pipelineStore.updateNodeStatus(step.nodeId, step.status);
        }
        // Add new log entries
        for (const log of data.newLogs) {
          pipelineStore.addLogEntry(log);
        }
      }
      return {
        execution: data,
        isRunning: data?.status === 'RUNNING',
        progress: data?.steps ?? [],
      };
    },
  });
}
```

**Used by:** Pipeline Builder (ExecutionAnimation, ExecutionLog).

---

## Contract Write Hooks (wagmi)

All contract write hooks follow this pattern:

```typescript
import { useMutation } from '@tanstack/react-query';
import { useWriteContract, usePublicClient } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

export function useContractWriteHook() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ParamType) => {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'functionName',
        args: [params.xxx],
      });
      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return receipt;
    },
    onSuccess: () => {
      // Invalidate relevant queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.xxx });
    },
  });
}
```

---

### 12. useDeposit

**File:** `packages/frontend/src/hooks/useDeposit.ts`

**Contract:** `TreasuryVault.depositFunds(amount)`

**Sequence:**

1. Check if USDC spending is approved for the TreasuryVault address.
2. If not approved (or insufficient allowance), call `USDC.approve(treasuryVaultAddress, amount)` first and wait for confirmation.
3. Call `TreasuryVault.depositFunds(amount)`.
4. Wait for confirmation.

```typescript
export function useDeposit() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ amount }: { amount: bigint }) => {
      // Step 1: Approve USDC spending
      const approveHash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'approve',
        args: [treasuryVaultAddress, amount],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // Step 2: Deposit
      const depositHash = await writeContractAsync({
        address: treasuryVaultAddress,
        abi: treasuryVaultAbi,
        functionName: 'depositFunds',
        args: [amount],
      });
      return await publicClient.waitForTransactionReceipt({ hash: depositHash });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.balances });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
```

**Used by:** Vault page (deposit action).

---

### 13. useWithdraw

**File:** `packages/frontend/src/hooks/useWithdraw.ts`

**Contract:** `TreasuryVault.withdrawFunds(amount)`

**Role required:** `TREASURY_MANAGER_ROLE`

```typescript
export function useWithdraw() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ amount }: { amount: bigint }) => {
      const hash = await writeContractAsync({
        address: treasuryVaultAddress,
        abi: treasuryVaultAbi,
        functionName: 'withdrawFunds',
        args: [amount],
      });
      return await publicClient.waitForTransactionReceipt({ hash });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.balances });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
```

**Used by:** Vault page (withdraw action).

---

### 14. useSetThreshold

**File:** `packages/frontend/src/hooks/useSetThreshold.ts`

**Contract:** `TreasuryVault.setLiquidityThreshold(newThreshold)`

**Role required:** `CFO_ROLE`

```typescript
export function useSetThreshold() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ threshold }: { threshold: bigint }) => {
      const hash = await writeContractAsync({
        address: treasuryVaultAddress,
        abi: treasuryVaultAbi,
        functionName: 'setLiquidityThreshold',
        args: [threshold],
      });
      return await publicClient.waitForTransactionReceipt({ hash });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.balances });
    },
  });
}
```

**Used by:** Vault page (threshold configuration).

---

### 15. useExecutePayout

**File:** `packages/frontend/src/hooks/useExecutePayout.ts`

**Contract:** `PayoutRouter.executePayout(recipient, amount, targetCurrency, reference)`

```typescript
export function useExecutePayout() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recipient,
      amount,
      targetCurrency,
      reference,
    }: ExecutePayoutParams) => {
      const hash = await writeContractAsync({
        address: payoutRouterAddress,
        abi: payoutRouterAbi,
        functionName: 'executePayout',
        args: [recipient, amount, targetCurrency, reference],
      });
      return await publicClient.waitForTransactionReceipt({ hash });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payouts.list({} as any) });
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.balances });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
```

**Used by:** Quick Pay modal.

---

### 16. useBatchPayout

**File:** `packages/frontend/src/hooks/useBatchPayout.ts`

**Contract:** `PayoutRouter.batchPayout(recipients[], amounts[], currencies[], references[])`

```typescript
export function useBatchPayout() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recipients,
      amounts,
      currencies,
      references,
    }: BatchPayoutParams) => {
      const hash = await writeContractAsync({
        address: payoutRouterAddress,
        abi: payoutRouterAbi,
        functionName: 'batchPayout',
        args: [recipients, amounts, currencies, references],
      });
      return await publicClient.waitForTransactionReceipt({ hash });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payouts.list({} as any) });
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.balances });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
```

**Used by:** Pipeline Builder (pipeline execution).

---

### 17. useExecuteSwap

**File:** `packages/frontend/src/hooks/useExecuteSwap.ts`

**Note:** This is NOT a direct contract write. The StableFX interaction is routed through the backend API.

```typescript
export function useExecuteSwap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      quoteId,
      fromCurrency,
      toCurrency,
      fromAmount,
    }: ExecuteSwapParams) => {
      const response = await api.post('/api/fx/execute', {
        quoteId,
        fromCurrency,
        toCurrency,
        fromAmount,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fx', 'history'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.balances });
    },
  });
}
```

**Endpoint:** `POST /api/fx/execute`

**Used by:** FX page, Quick Pay modal (when currency != USDC).

---

### 18. useCreateBudget

**File:** `packages/frontend/src/hooks/useCreateBudget.ts`

**Contract:** `BudgetManager.createBudget(name, departmentHead, allocation, periodEnd)`

**Role required:** `CFO_ROLE`

```typescript
export function useCreateBudget() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      departmentHead,
      allocation,
      periodEnd,
    }: CreateBudgetParams) => {
      const hash = await writeContractAsync({
        address: budgetManagerAddress,
        abi: budgetManagerAbi,
        functionName: 'createBudget',
        args: [name, departmentHead, allocation, periodEnd],
      });
      return await publicClient.waitForTransactionReceipt({ hash });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.list });
    },
  });
}
```

**Used by:** Budget management views.

---

### 19. useSpendBudget

**File:** `packages/frontend/src/hooks/useSpendBudget.ts`

**Contract:** `BudgetManager.spendFromBudget(budgetId, amount, reference)`

```typescript
export function useSpendBudget() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      budgetId,
      amount,
      reference,
    }: SpendBudgetParams) => {
      const hash = await writeContractAsync({
        address: budgetManagerAddress,
        abi: budgetManagerAbi,
        functionName: 'spendFromBudget',
        args: [budgetId, amount, reference],
      });
      return await publicClient.waitForTransactionReceipt({ hash });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.list });
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.balances });
    },
  });
}
```

**Used by:** Budget management views, Pipeline execution (when budget enforcement is active).

---

### 20. useSavePipeline

**File:** `packages/frontend/src/hooks/useSavePipeline.ts`

**Note:** This is an API mutation, not a contract write.

```typescript
export function useSavePipeline() {
  const queryClient = useQueryClient();
  const pipelineStore = usePipelineStore();

  return useMutation({
    mutationFn: async ({
      id,
      name,
      nodes,
      edges,
      metadata,
      ownerWallet,
    }: SavePipelineParams) => {
      if (id) {
        // Update existing pipeline
        return api.put(`/api/pipelines/${id}`, {
          name, nodes, edges, metadata, ownerWallet,
        });
      } else {
        // Create new pipeline
        return api.post('/api/pipelines', {
          name, nodes, edges, metadata, ownerWallet,
        });
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.list });
      pipelineStore.setCurrentPipeline(data.id, data.name);
      pipelineStore.markClean();
    },
  });
}
```

**Endpoint:** `POST /api/pipelines` (create) or `PUT /api/pipelines/[id]` (update).

**Used by:** Pipeline Builder (SavedConfigs panel).

---

## Zustand Stores

### UI Store

**File:** `packages/frontend/src/stores/ui.store.ts`

Manages global UI state that doesn't fit in server state (TanStack Query) or component-local state.

```typescript
import { create } from 'zustand';

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  // Quick Pay modal
  quickPayOpen: boolean;
  openQuickPay: () => void;
  closeQuickPay: () => void;

  // Theme
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Sidebar
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  // Quick Pay
  quickPayOpen: false,
  openQuickPay: () => set({ quickPayOpen: true }),
  closeQuickPay: () => set({ quickPayOpen: false }),

  // Theme
  theme: 'dark',
  setTheme: (theme) => set({ theme }),
}));
```

**Used by:**
- App shell (`docs/frontend/02-app-shell.md`) for sidebar toggle and theme.
- Quick Pay (`docs/frontend/07-quick-pay.md`) for modal open/close.

---

### Pipeline Store

**File:** `packages/frontend/src/stores/pipeline.store.ts`

Manages pipeline editor state and execution progress. This store is separate from the React Flow node/edge state (which lives in `useNodesState` / `useEdgesState`) to avoid coupling the visual canvas state with execution logic.

```typescript
import { create } from 'zustand';

type NodeStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface ExecutionLogEntry {
  timestamp: Date;
  message: string;
  status: 'info' | 'success' | 'error' | 'pending';
  nodeId?: string;
}

interface PipelineState {
  // Current pipeline being edited
  currentPipelineId: string | null;
  currentPipelineName: string;
  isDirty: boolean;

  // Execution state
  isExecuting: boolean;
  executionProgress: Map<string, NodeStatus>;
  executionLog: ExecutionLogEntry[];

  // Actions — Pipeline management
  setCurrentPipeline: (id: string | null, name: string) => void;
  markDirty: () => void;
  markClean: () => void;
  resetPipeline: () => void;

  // Actions — Execution
  startExecution: () => void;
  updateNodeStatus: (nodeId: string, status: NodeStatus) => void;
  addLogEntry: (entry: ExecutionLogEntry) => void;
  finishExecution: () => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  // Initial state
  currentPipelineId: null,
  currentPipelineName: 'Untitled Pipeline',
  isDirty: false,
  isExecuting: false,
  executionProgress: new Map(),
  executionLog: [],

  // Pipeline management
  setCurrentPipeline: (id, name) =>
    set({ currentPipelineId: id, currentPipelineName: name, isDirty: false }),

  markDirty: () => set({ isDirty: true }),

  markClean: () => set({ isDirty: false }),

  resetPipeline: () =>
    set({
      currentPipelineId: null,
      currentPipelineName: 'Untitled Pipeline',
      isDirty: false,
      isExecuting: false,
      executionProgress: new Map(),
      executionLog: [],
    }),

  // Execution
  startExecution: () =>
    set({
      isExecuting: true,
      executionProgress: new Map(),
      executionLog: [],
    }),

  updateNodeStatus: (nodeId, status) =>
    set((state) => {
      const newProgress = new Map(state.executionProgress);
      newProgress.set(nodeId, status);
      return { executionProgress: newProgress };
    }),

  addLogEntry: (entry) =>
    set((state) => ({
      executionLog: [...state.executionLog, entry],
    })),

  finishExecution: () => set({ isExecuting: false }),
}));
```

**Used by:** Pipeline Builder (`docs/frontend/06-pipeline-builder.md`) for edit tracking and execution animation.

---

## Utility Functions

**File:** `packages/frontend/src/lib/utils.ts`

Shared formatting and helper functions used across all pages.

```typescript
/**
 * Format a number as currency with appropriate symbol.
 * @example formatCurrency(1245000) => "$1,245,000.00"
 * @example formatCurrency(9234.5, 'EURC') => "EUR9,234.50"
 */
export function formatCurrency(
  amount: number | string | bigint,
  currency: string = 'USDC'
): string {
  const num = typeof amount === 'bigint'
    ? Number(amount) / 1e6  // Assume 6 decimals for stablecoins
    : Number(amount);

  const symbols: Record<string, string> = {
    USDC: '$',
    EURC: '\u20AC',  // Euro sign
    GBPC: '\u00A3',  // Pound sign
    JPYC: '\u00A5',  // Yen sign
    CADC: 'CA$',
  };

  const symbol = symbols[currency] ?? '$';
  return `${symbol}${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format a number in compact notation.
 * @example formatCompact(1245000) => "$1.2M"
 * @example formatCompact(5000) => "$5.0K"
 */
export function formatCompact(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(2)}`;
}

/**
 * Shorten an Ethereum address for display.
 * @example shortenAddress("0xABCDEF1234567890ABCDEF1234567890ABCDEF12") => "0xABCD...EF12"
 */
export function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format a date as relative time.
 * @example formatRelativeTime(twoMinutesAgo) => "2 min ago"
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

/**
 * Format an APY percentage.
 * @example formatAPY(4.85) => "4.85%"
 */
export function formatAPY(apy: number): string {
  return `${apy.toFixed(2)}%`;
}

/**
 * Debounce hook for delaying value updates.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}
```

**Note:** `useDebounce` is a React hook and should be exported from a hooks file or kept in `utils.ts` with the understanding that it requires React imports (`useState`, `useEffect`).

---

## Files to Create

### Hooks

| File                                                          | Hook                  | Type           |
| ------------------------------------------------------------- | --------------------- | -------------- |
| `packages/frontend/src/hooks/useDashboardStats.ts`            | useDashboardStats     | Query          |
| `packages/frontend/src/hooks/useVaultBalances.ts`             | useVaultBalances      | Contract Read  |
| `packages/frontend/src/hooks/useVaultHistory.ts`              | useVaultHistory       | Query          |
| `packages/frontend/src/hooks/useYieldBreakdown.ts`            | useYieldBreakdown     | Query+Compute  |
| `packages/frontend/src/hooks/useFXQuote.ts`                   | useFXQuote            | Query          |
| `packages/frontend/src/hooks/useFXHistory.ts`                 | useFXHistory          | Query          |
| `packages/frontend/src/hooks/usePayouts.ts`                   | usePayouts            | Query          |
| `packages/frontend/src/hooks/usePayoutStatus.ts`              | usePayoutStatus       | Query+Poll     |
| `packages/frontend/src/hooks/usePipelines.ts`                 | usePipelines          | Query          |
| `packages/frontend/src/hooks/usePipeline.ts`                  | usePipeline           | Query          |
| `packages/frontend/src/hooks/usePipelineExecution.ts`         | usePipelineExecution  | Query+Poll     |
| `packages/frontend/src/hooks/useDeposit.ts`                   | useDeposit            | Contract Write |
| `packages/frontend/src/hooks/useWithdraw.ts`                  | useWithdraw           | Contract Write |
| `packages/frontend/src/hooks/useSetThreshold.ts`              | useSetThreshold       | Contract Write |
| `packages/frontend/src/hooks/useExecutePayout.ts`             | useExecutePayout      | Contract Write |
| `packages/frontend/src/hooks/useBatchPayout.ts`               | useBatchPayout        | Contract Write |
| `packages/frontend/src/hooks/useExecuteSwap.ts`               | useExecuteSwap        | API Mutation   |
| `packages/frontend/src/hooks/useCreateBudget.ts`              | useCreateBudget       | Contract Write |
| `packages/frontend/src/hooks/useSpendBudget.ts`               | useSpendBudget        | Contract Write |
| `packages/frontend/src/hooks/useSavePipeline.ts`              | useSavePipeline       | API Mutation   |

### Stores

| File                                                          | Store          |
| ------------------------------------------------------------- | -------------- |
| `packages/frontend/src/stores/ui.store.ts`                    | useUIStore     |
| `packages/frontend/src/stores/pipeline.store.ts`              | usePipelineStore |

### Configuration & Utilities

| File                                                          | Purpose                  |
| ------------------------------------------------------------- | ------------------------ |
| `packages/frontend/src/providers/query.ts`                    | QueryClient setup        |
| `packages/frontend/src/lib/queryKeys.ts`                      | Centralized query keys   |
| `packages/frontend/src/lib/utils.ts`                          | Formatting utilities     |

---

## Cross-references

| Document                                       | Relevance                                                    |
| ---------------------------------------------- | ------------------------------------------------------------ |
| `docs/frontend/02-app-shell.md`                | Provider setup, API client configuration                     |
| `docs/frontend/03-dashboard-page.md`           | Uses useDashboardStats, useVaultBalances                     |
| `docs/frontend/04-vault-page.md`               | Uses vault hooks (balances, history, yield) + write hooks    |
| `docs/frontend/05-fx-page.md`                  | Uses useFXQuote, useExecuteSwap, useFXHistory                |
| `docs/frontend/06-pipeline-builder.md`         | Uses pipeline hooks + Pipeline Zustand store + useBatchPayout|
| `docs/frontend/07-quick-pay.md`                | Uses useExecutePayout, useFXQuote, useExecuteSwap, UI store  |
| `docs/technical/02-treasury-vault-contract.md` | Contract ABIs for vault read/write hooks                     |
| `docs/technical/03-payout-router-contract.md`  | Contract ABIs for payout hooks                               |
| `docs/technical/07-api-routes.md`              | API endpoint specifications for all query hooks              |
