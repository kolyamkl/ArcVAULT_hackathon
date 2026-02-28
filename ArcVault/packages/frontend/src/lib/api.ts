import type {
  DashboardStats,
  VaultStatus,
  VaultHistory,
  FXQuote,
  FXExecution,
  FXHistory,
  Payout,
  BatchPayoutResult,
  PayoutList,
  Pipeline,
  PipelineExecution,
  ExecutePipelineResponse,
  PipelineHistory,
  TransactionList,
  CreatePayoutRequest,
  CreateBatchPayoutRequest,
  CreatePipelineRequest,
  UpdatePipelineRequest,
} from '@/types/api';

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
    list: () => fetchAPI<{ pipelines: Pipeline[] }>('/pipelines').then(res => res.pipelines),
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
    execute: (id: string, triggeredBy: string) =>
      fetchAPI<ExecutePipelineResponse>(`/pipelines/${id}/execute`, {
        method: 'POST',
        body: JSON.stringify({ triggeredBy }),
      }),
    getHistory: (id: string, params?: Record<string, string>) =>
      fetchAPI<PipelineHistory>(
        `/pipelines/${id}/history${params ? `?${new URLSearchParams(params)}` : ''}`
      ),
  },

  // Transactions
  transactions: {
    list: (params: Record<string, string>) =>
      fetchAPI<TransactionList>(`/transactions?${new URLSearchParams(params)}`),
  },
};
