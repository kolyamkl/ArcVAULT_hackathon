// ---------------------------------------------------------------------------
// Centralized query key factory
// All query keys MUST go through this factory -- no inline key arrays anywhere.
// ---------------------------------------------------------------------------

export interface VaultHistoryParams {
  type?: 'deposit' | 'withdraw' | 'yield' | 'rebalance';
  page: number;
  limit: number;
}

export interface FXHistoryParams {
  page: number;
  limit: number;
}

export interface PayoutListParams {
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PipelineHistoryParams {
  page: number;
  limit: number;
}

export const queryKeys = {
  // Dashboard
  dashboard: ['dashboard'] as const,

  // Vault
  vault: {
    status: ['vault', 'status'] as const,
    history: (params: VaultHistoryParams) =>
      ['vault', 'history', params] as const,
    balances: ['vault', 'balances'] as const,
    yieldBreakdown: ['vault', 'yield-breakdown'] as const,
    snapshots: ['vault', 'snapshots'] as const,
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
    history: (id: string, params: PipelineHistoryParams) =>
      ['pipelines', 'history', id, params] as const,
    execution: (executionId: string) =>
      ['pipelines', 'execution', executionId] as const,
  },

  // Budgets
  budgets: {
    list: ['budgets', 'list'] as const,
    detail: (id: string) =>
      ['budgets', 'detail', id] as const,
  },
} as const;
