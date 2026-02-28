/** Dashboard API types */
export interface DashboardStats {
  totalBalance: number;
  liquidBalance: number;
  yieldAccrued: number;
  pendingPayouts: number;
  recentTransactions: Transaction[];
  balanceChange: number;
  payoutChange: number;
  yieldChange: number;
}

/** Treasury Vault API types */
export interface VaultStatus {
  totalValue: number;
  liquidBalance: number;
  usycBalance: number;
  yieldAccrued: number;
  liquidityThreshold: number;
  allocationPercentage: number;
}

export interface VaultHistoryEntry {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'YIELD' | 'REBALANCE';
  amount: number;
  timestamp: string;
  txHash: string;
  status: string;
}

export interface VaultHistory {
  entries: VaultHistoryEntry[];
  total: number;
}

/** FX Conversion API types */
export interface FXQuote {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  spread: number;
  expiresAt: string;
  status: string;
}

export interface FXExecution {
  txHash: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  status: string;
}

export interface FXHistoryEntry {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  status: string;
  txHash: string;
  createdAt: string;
}

export interface FXHistory {
  entries: FXHistoryEntry[];
  total: number;
}

/** Payout API types */
export interface Payout {
  id: string;
  recipient: string;
  amount: number;
  currency: string;
  reference: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  txHash?: string;
  createdAt: string;
  completedAt?: string;
}

export interface CreatePayoutRequest {
  recipient: string;
  amount: number;
  currency: string;
  reference?: string;
}

export interface CreateBatchPayoutRequest {
  payouts: CreatePayoutRequest[];
}

export interface BatchPayoutResult {
  successful: number;
  failed: number;
  payouts: Payout[];
}

export interface PayoutList {
  payouts: Payout[];
  total: number;
}

/** Pipeline API types */
export interface PipelineStep {
  id: string;
  type: 'FX_CONVERT' | 'PAYOUT' | 'APPROVAL' | 'DELAY' | 'CONDITION';
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface PipelineConnection {
  from: string;
  to: string;
}

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  steps: PipelineStep[];
  connections: PipelineConnection[];
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED';
  createdAt: string;
  updatedAt: string;
}

export interface CreatePipelineRequest {
  name: string;
  description?: string;
  steps: PipelineStep[];
  connections: PipelineConnection[];
}

export interface UpdatePipelineRequest {
  name?: string;
  description?: string;
  steps?: PipelineStep[];
  connections?: PipelineConnection[];
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED';
}

export interface ExecutePipelineRequest {
  triggeredBy: string;
}

export interface ExecutePipelineResponse {
  execution: { id: string; status: string };
}

export interface ExecutionStep {
  nodeId: string;
  nodeType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped' | 'awaiting_approval' | 'paused';
  payoutId?: number;
  txHash?: string;
  amount?: number;
  currency?: string;
  fxQuoteId?: string;
  fxRate?: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  approvalCount?: number;
  approvalThreshold?: number;
  delayUntil?: string;
  conditionResult?: boolean;
}

export interface ExecutionLogEntry {
  timestamp: string;
  message: string;
  status: 'info' | 'success' | 'error' | 'pending';
  nodeId?: string;
}

export interface PipelineExecution {
  id: string;
  pipelineId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL_FAILURE' | 'FAILED' | 'AWAITING_APPROVAL' | 'PAUSED';
  steps: ExecutionStep[];
  newLogs: ExecutionLogEntry[];
  startedAt: string;
  completedAt?: string;
  totalCost?: number;
  fxCost?: number;
  results?: Record<string, unknown>;
}

export interface PipelineHistoryEntry {
  id: string;
  status: string;
  totalCost?: number;
  fxCost?: number;
  triggeredBy?: string;
  startedAt: string;
  completedAt?: string;
  results: Record<string, unknown>;
}

export interface PipelineHistory {
  executions: PipelineHistoryEntry[];
  total: number;
  page: number;
  limit: number;
}

/** Transaction types */
export interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'PAYOUT' | 'FX_SWAP' | 'YIELD';
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  txHash?: string;
  from?: string;
  to?: string;
  description?: string;
  createdAt: string;
}

export interface TransactionList {
  transactions: Transaction[];
  total: number;
}

/** Approval types */
export interface SubmitApprovalRequest {
  approverAddress: string;
  nodeId: string;
}

export interface ApprovalStatus {
  nodeId: string;
  approvals: { address: string; status: string }[];
  threshold: number;
  met: boolean;
}
