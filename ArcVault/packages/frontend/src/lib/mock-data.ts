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
  TransactionList,
  Transaction,
} from '@/types/api';
import type { VaultSnapshot } from '@/hooks/useYieldBreakdown';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function hoursAgo(n: number): string {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

function minutesAgo(n: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - n);
  return d.toISOString();
}

function randomTxHash(): string {
  const hex = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) hash += hex[Math.floor(Math.random() * 16)];
  return hash;
}

// ---------------------------------------------------------------------------
// Transactions (shared between dashboard + transactions endpoint)
// ---------------------------------------------------------------------------

const mockTransactions: Transaction[] = [
  {
    id: 'tx-001',
    type: 'DEPOSIT',
    amount: 500000,
    currency: 'USDC',
    status: 'COMPLETED',
    txHash: '0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    to: '0xVault',
    description: 'Treasury deposit from multisig',
    createdAt: hoursAgo(2),
  },
  {
    id: 'tx-002',
    type: 'YIELD',
    amount: 342.18,
    currency: 'USDC',
    status: 'COMPLETED',
    txHash: '0xb2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
    description: 'USYC yield accrual',
    createdAt: hoursAgo(6),
  },
  {
    id: 'tx-003',
    type: 'FX_SWAP',
    amount: 25000,
    currency: 'USDC',
    status: 'COMPLETED',
    txHash: '0xc3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    description: 'USDC → EURC conversion',
    createdAt: hoursAgo(12),
  },
  {
    id: 'tx-004',
    type: 'PAYOUT',
    amount: 15000,
    currency: 'EURC',
    status: 'COMPLETED',
    txHash: '0xd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
    to: '0x7890abcdef1234567890abcdef1234567890abcd',
    description: 'Berlin office rent',
    createdAt: daysAgo(1),
  },
  {
    id: 'tx-005',
    type: 'PAYOUT',
    amount: 8500,
    currency: 'USDC',
    status: 'PROCESSING',
    to: '0xabcdef1234567890abcdef1234567890abcdef12',
    description: 'Contractor payment — Design',
    createdAt: daysAgo(1),
  },
  {
    id: 'tx-006',
    type: 'WITHDRAWAL',
    amount: 100000,
    currency: 'USDC',
    status: 'COMPLETED',
    txHash: '0xe5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
    description: 'Operational withdrawal',
    createdAt: daysAgo(2),
  },
  {
    id: 'tx-007',
    type: 'DEPOSIT',
    amount: 750000,
    currency: 'USDC',
    status: 'COMPLETED',
    txHash: '0xf6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1',
    to: '0xVault',
    description: 'Series A tranche 2',
    createdAt: daysAgo(3),
  },
  {
    id: 'tx-008',
    type: 'FX_SWAP',
    amount: 50000,
    currency: 'USDC',
    status: 'COMPLETED',
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    description: 'USDC → GBPC conversion',
    createdAt: daysAgo(4),
  },
  {
    id: 'tx-009',
    type: 'YIELD',
    amount: 289.44,
    currency: 'USDC',
    status: 'COMPLETED',
    txHash: '0x234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
    description: 'USYC yield accrual',
    createdAt: daysAgo(5),
  },
  {
    id: 'tx-010',
    type: 'PAYOUT',
    amount: 32000,
    currency: 'USDC',
    status: 'FAILED',
    to: '0xcdef1234567890abcdef1234567890abcdef1234',
    description: 'Vendor payment — insufficient liquidity',
    createdAt: daysAgo(6),
  },
];

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const mockDashboard: DashboardStats = {
  totalBalance: 2_547_832.41,
  liquidBalance: 1_223_416.20,
  yieldAccrued: 12_847.63,
  pendingPayouts: 7,
  recentTransactions: mockTransactions.slice(0, 5),
  balanceChange: 3.2,
  payoutChange: -12.5,
  yieldChange: 8.7,
};

// ---------------------------------------------------------------------------
// Vault
// ---------------------------------------------------------------------------

export const mockVaultStatus: VaultStatus = {
  totalValue: 2_547_832.41,
  liquidBalance: 1_223_416.20,
  usycBalance: 1_324_416.21,
  yieldAccrued: 12_847.63,
  liquidityThreshold: 500_000,
  allocationPercentage: 48,
};

export const mockVaultHistory: VaultHistory = {
  entries: [
    { id: 'vh-001', type: 'DEPOSIT', amount: 500_000, timestamp: hoursAgo(2), txHash: '0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', status: 'COMPLETED' },
    { id: 'vh-002', type: 'SWEEP', amount: 342.18, timestamp: hoursAgo(6), txHash: '0xb2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3', status: 'COMPLETED' },
    { id: 'vh-003', type: 'REDEEM', amount: 200_000, timestamp: daysAgo(1), txHash: '0xc3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', status: 'COMPLETED' },
    { id: 'vh-004', type: 'WITHDRAW', amount: 100_000, timestamp: daysAgo(2), txHash: '0xd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5', status: 'COMPLETED' },
    { id: 'vh-005', type: 'DEPOSIT', amount: 750_000, timestamp: daysAgo(3), txHash: '0xe5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6', status: 'COMPLETED' },
    { id: 'vh-006', type: 'SWEEP', amount: 289.44, timestamp: daysAgo(5), txHash: '0xf6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1', status: 'COMPLETED' },
    { id: 'vh-007', type: 'REDEEM', amount: 150_000, timestamp: daysAgo(8), txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', status: 'COMPLETED' },
    { id: 'vh-008', type: 'DEPOSIT', amount: 1_000_000, timestamp: daysAgo(14), txHash: '0x234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12', status: 'COMPLETED' },
  ],
  total: 8,
};

// ---------------------------------------------------------------------------
// Vault Snapshots (for yield chart)
// ---------------------------------------------------------------------------

export const mockVaultSnapshots: VaultSnapshot[] = Array.from({ length: 30 }, (_, i) => {
  const day = 29 - i;
  const baseValue = 2_200_000 + i * 11_500 + Math.sin(i * 0.5) * 15_000;
  const yieldBase = 8_000 + i * 165 + Math.sin(i * 0.3) * 200;
  return {
    timestamp: daysAgo(day),
    totalValue: Math.round(baseValue * 100) / 100,
    yieldAccrued: Math.round(yieldBase * 100) / 100,
    apy: 4.2 + Math.sin(i * 0.2) * 0.3,
  };
});

// ---------------------------------------------------------------------------
// FX
// ---------------------------------------------------------------------------

const FX_RATES: Record<string, number> = {
  'USDC/EURC': 0.92,
  'USDC/GBPC': 0.79,
  'USDC/JPYC': 155.4,
  'USDC/CADC': 1.36,
  'EURC/USDC': 1.087,
  'GBPC/USDC': 1.266,
  'JPYC/USDC': 0.00643,
  'CADC/USDC': 0.735,
};

export function getMockFXQuote(from: string, to: string, amount: number): FXQuote {
  const pair = `${from}/${to}`;
  const rate = FX_RATES[pair] ?? 1;
  const expiresAt = new Date(Date.now() + 30_000).toISOString();
  return {
    id: `quote-${Date.now()}`,
    fromCurrency: from,
    toCurrency: to,
    fromAmount: amount,
    toAmount: Math.round(amount * rate * 100) / 100,
    rate,
    spread: 0.001,
    expiresAt,
    status: 'PENDING',
  };
}

export const mockFXHistory: FXHistory = {
  entries: [
    { id: 'fx-001', fromCurrency: 'USDC', toCurrency: 'EURC', fromAmount: 25_000, toAmount: 23_000, rate: 0.92, status: 'COMPLETED', txHash: '0xc3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', createdAt: hoursAgo(12) },
    { id: 'fx-002', fromCurrency: 'USDC', toCurrency: 'GBPC', fromAmount: 50_000, toAmount: 39_500, rate: 0.79, status: 'COMPLETED', txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', createdAt: daysAgo(4) },
    { id: 'fx-003', fromCurrency: 'EURC', toCurrency: 'USDC', fromAmount: 10_000, toAmount: 10_870, rate: 1.087, status: 'COMPLETED', txHash: '0x3456789abcdef01234567890abcdef1234567890abcdef1234567890abcdef0123', createdAt: daysAgo(7) },
    { id: 'fx-004', fromCurrency: 'USDC', toCurrency: 'JPYC', fromAmount: 5_000, toAmount: 777_000, rate: 155.4, status: 'COMPLETED', txHash: '0x456789abcdef01234567890abcdef1234567890abcdef1234567890abcdef012345', createdAt: daysAgo(10) },
    { id: 'fx-005', fromCurrency: 'USDC', toCurrency: 'CADC', fromAmount: 20_000, toAmount: 27_200, rate: 1.36, status: 'COMPLETED', txHash: '0x56789abcdef01234567890abcdef1234567890abcdef1234567890abcdef01234567', createdAt: daysAgo(12) },
    { id: 'fx-006', fromCurrency: 'GBPC', toCurrency: 'USDC', fromAmount: 15_000, toAmount: 18_990, rate: 1.266, status: 'FAILED', txHash: '0x6789abcdef01234567890abcdef1234567890abcdef1234567890abcdef0123456789', createdAt: daysAgo(15) },
  ],
  total: 6,
};

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

export const mockPayouts: PayoutList = {
  payouts: [
    { id: 'pay-001', recipient: '0x7890abcdef1234567890abcdef1234567890abcd', amount: 15_000, currency: 'EURC', reference: 'Berlin office rent — Feb', status: 'COMPLETED', txHash: '0xd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5', createdAt: daysAgo(1), completedAt: daysAgo(1) },
    { id: 'pay-002', recipient: '0xabcdef1234567890abcdef1234567890abcdef12', amount: 8_500, currency: 'USDC', reference: 'Contractor — Design work', status: 'PROCESSING', createdAt: daysAgo(1) },
    { id: 'pay-003', recipient: '0x1234abcd5678ef901234abcd5678ef901234abcd', amount: 45_000, currency: 'USDC', reference: 'Monthly payroll batch', status: 'PENDING', createdAt: hoursAgo(3) },
    { id: 'pay-004', recipient: '0xdef0123456789abcdef0123456789abcdef012345', amount: 3_200, currency: 'GBPC', reference: 'London co-working space', status: 'COMPLETED', txHash: '0x789abcdef01234567890abcdef1234567890abcdef1234567890abcdef012345678', createdAt: daysAgo(5), completedAt: daysAgo(5) },
    { id: 'pay-005', recipient: '0xcdef1234567890abcdef1234567890abcdef1234', amount: 32_000, currency: 'USDC', reference: 'Vendor payment — Infrastructure', status: 'FAILED', createdAt: daysAgo(6) },
    { id: 'pay-006', recipient: '0x5678abcdef901234567890abcdef1234567890ab', amount: 12_750, currency: 'USDC', reference: 'Audit fee — Q4', status: 'PENDING', createdAt: hoursAgo(1) },
  ],
  total: 6,
};

// ---------------------------------------------------------------------------
// Pipelines
// ---------------------------------------------------------------------------

export const mockPipelines: Pipeline[] = [
  {
    id: 'pipe-001',
    name: 'Monthly Payroll',
    description: 'Converts USDC to local currencies and distributes payroll to all team wallets',
    steps: [
      { id: 'step-1', type: 'FX_CONVERT', config: { fromCurrency: 'USDC', toCurrency: 'EURC', amount: 30000 }, position: { x: 100, y: 100 } },
      { id: 'step-2', type: 'FX_CONVERT', config: { fromCurrency: 'USDC', toCurrency: 'GBPC', amount: 15000 }, position: { x: 100, y: 250 } },
      { id: 'step-3', type: 'APPROVAL', config: { approvers: ['0xAdmin1'], threshold: 1 }, position: { x: 350, y: 175 } },
      { id: 'step-4', type: 'PAYOUT', config: { recipients: 8, totalAmount: 45000 }, position: { x: 600, y: 175 } },
    ],
    connections: [
      { from: 'step-1', to: 'step-3' },
      { from: 'step-2', to: 'step-3' },
      { from: 'step-3', to: 'step-4' },
    ],
    status: 'ACTIVE',
    createdAt: daysAgo(30),
    updatedAt: daysAgo(2),
  },
  {
    id: 'pipe-002',
    name: 'Contractor Payments',
    description: 'Weekly contractor payout pipeline with conditional approval for amounts > $5K',
    steps: [
      { id: 'step-1', type: 'CONDITION', config: { field: 'amount', operator: '>', value: 5000 }, position: { x: 100, y: 150 } },
      { id: 'step-2', type: 'APPROVAL', config: { approvers: ['0xAdmin1', '0xAdmin2'], threshold: 1 }, position: { x: 350, y: 80 } },
      { id: 'step-3', type: 'PAYOUT', config: { currency: 'USDC' }, position: { x: 600, y: 150 } },
    ],
    connections: [
      { from: 'step-1', to: 'step-2' },
      { from: 'step-1', to: 'step-3' },
      { from: 'step-2', to: 'step-3' },
    ],
    status: 'DRAFT',
    createdAt: daysAgo(7),
    updatedAt: daysAgo(1),
  },
  {
    id: 'pipe-003',
    name: 'Guarded Payroll with Delay',
    description: 'Full pipeline using approval, condition, and delay nodes',
    steps: [
      { id: 'step-1', type: 'FX_CONVERT', config: { fromCurrency: 'USDC', toCurrency: 'EURC', amount: 20000 }, position: { x: 100, y: 100 } },
      { id: 'step-2', type: 'APPROVAL', config: { approvers: ['0xAdmin1', '0xAdmin2'], threshold: 2 }, position: { x: 300, y: 100 } },
      { id: 'step-3', type: 'CONDITION', config: { field: 'amount', operator: '>', value: 10000 }, position: { x: 500, y: 100 } },
      { id: 'step-4', type: 'DELAY', config: { delayType: 'duration', durationHours: 0, durationMinutes: 30 }, position: { x: 700, y: 50 } },
      { id: 'step-5', type: 'PAYOUT', config: { recipients: 5, totalAmount: 20000 }, position: { x: 900, y: 50 } },
      { id: 'step-6', type: 'PAYOUT', config: { recipients: 2, totalAmount: 5000 }, position: { x: 700, y: 200 } },
    ],
    connections: [
      { from: 'step-1', to: 'step-2' },
      { from: 'step-2', to: 'step-3' },
      { from: 'step-3', to: 'step-4' },
      { from: 'step-3', to: 'step-6' },
      { from: 'step-4', to: 'step-5' },
    ],
    status: 'ACTIVE',
    createdAt: daysAgo(5),
    updatedAt: daysAgo(1),
  },
];

// ---------------------------------------------------------------------------
// Transactions list
// ---------------------------------------------------------------------------

export const mockTransactionList: TransactionList = {
  transactions: mockTransactions,
  total: mockTransactions.length,
};
