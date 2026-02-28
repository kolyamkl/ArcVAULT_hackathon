// ── Transaction ───────────────────────────────────────────────

export type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAW'
  | 'SWEEP'
  | 'REDEEM'
  | 'PAYOUT'
  | 'FX_SWAP'
  | 'BUDGET_SPEND';

export type TransactionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Transaction {
  id: string;
  type: TransactionType;
  txHash: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  amount: number;
  currency: string;
  status: TransactionStatus;
  metadata: Record<string, unknown> | null;
  chainId: number;
  blockNumber: number | null;
  createdAt: string;
  updatedAt: string;
}

// ── Payout ────────────────────────────────────────────────────

export type PayoutStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'CONVERTING'
  | 'SETTLING'
  | 'COMPLETED'
  | 'FAILED';

export interface Payout {
  id: string;
  onChainId: number;
  recipient: string;
  amount: number;
  sourceCurrency: string;
  targetCurrency: string;
  reference: string | null;
  status: PayoutStatus;
  cpnPaymentId: string | null;
  txHash: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── FX Quote ──────────────────────────────────────────────────

export type FXQuoteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'EXECUTED';

export interface FXQuote {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  spread: number;
  expiresAt: string;
  status: FXQuoteStatus;
  txHash: string | null;
  createdAt: string;
}

// ── Pipeline ──────────────────────────────────────────────────

export interface PipelineNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    config: Record<string, unknown>;
  };
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface Pipeline {
  id: string;
  name: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  metadata: Record<string, unknown> | null;
  ownerWallet: string;
  createdAt: string;
  updatedAt: string;
  executions?: PipelineExecution[];
}

// ── Pipeline Execution ────────────────────────────────────────

export type PipelineExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'PARTIAL_FAILURE'
  | 'FAILED';

export interface PipelineExecution {
  id: string;
  pipelineId: string;
  status: PipelineExecutionStatus;
  totalCost: number;
  fxCost: number;
  results: Record<string, unknown>;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
}

// ── Budget ────────────────────────────────────────────────────

export interface Budget {
  id: string;
  onChainId: number;
  name: string;
  departmentHead: string;
  totalAllocation: number;
  spent: number;
  periodStart: string;
  periodEnd: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Vault Snapshot ────────────────────────────────────────────

export interface VaultSnapshot {
  id: string;
  liquidUSDC: number;
  usycBalance: number;
  totalValue: number;
  yieldAccrued: number;
  apy: number;
  timestamp: string;
}

// ── API Response Wrappers ─────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ── Dashboard Aggregates ──────────────────────────────────────

export interface DashboardStats {
  totalTreasuryValue: number;
  liquidUSDC: number;
  usycBalance: number;
  currentAPY: number;
  yieldAccrued30d: number;
  pendingPayouts: number;
  pendingPayoutsValue: number;
  totalBudgetAllocated: number;
  totalBudgetSpent: number;
}

export interface TreasuryChartPoint {
  date: string;
  totalValue: number;
  liquidUSDC: number;
  usycBalance: number;
  apy: number;
}
