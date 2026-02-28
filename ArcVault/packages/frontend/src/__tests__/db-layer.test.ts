import { describe, it, expect } from 'vitest';

// ── Type imports (compile-time validation) ────────────────────
import type {
  Transaction,
  TransactionType,
  TransactionStatus,
  Payout,
  PayoutStatus,
  FXQuote,
  FXQuoteStatus,
  Pipeline,
  PipelineNode,
  PipelineEdge,
  PipelineExecution,
  PipelineExecutionStatus,
  Budget,
  VaultSnapshot,
  DashboardStats,
  TreasuryChartPoint,
  ApiResponse,
  PaginatedResponse,
} from '@/types/index';

import type {
  TxResult,
  YieldDataPoint,
  IUSYCAdapter,
  FXQuoteResult,
  SwapResult,
  CurrencyPair,
  IStableFXAdapter,
  CPNPaymentParams,
  CPNPaymentResult,
  CPNStatus,
  ComplianceResult,
  ICPNAdapter,
} from '@/types/integrations';

// ── Service imports ───────────────────────────────────────────
import { MockUSYCAdapter } from '@/services/usyc.service';
import { MockCPNAdapter } from '@/services/cpn.service';

// ── Utility imports ───────────────────────────────────────────
import { cn, formatCurrency, shortenAddress } from '@/lib/utils';

// ══════════════════════════════════════════════════════════════
// Type Structure Tests
// ══════════════════════════════════════════════════════════════

describe('TypeScript Types', () => {
  it('Transaction type has all required fields', () => {
    const tx: Transaction = {
      id: 'test-id',
      type: 'DEPOSIT',
      txHash: '0xabc',
      fromAddress: '0x123',
      toAddress: '0x456',
      amount: 1000,
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { memo: 'test' },
      chainId: 421614,
      blockNumber: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(tx.id).toBe('test-id');
    expect(tx.type).toBe('DEPOSIT');
  });

  it('TransactionType covers all valid values', () => {
    const types: TransactionType[] = [
      'DEPOSIT', 'WITHDRAW', 'SWEEP', 'REDEEM', 'PAYOUT', 'FX_SWAP', 'BUDGET_SPEND',
    ];
    expect(types).toHaveLength(7);
  });

  it('TransactionStatus covers all valid values', () => {
    const statuses: TransactionStatus[] = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];
    expect(statuses).toHaveLength(4);
  });

  it('Payout type has all required fields', () => {
    const payout: Payout = {
      id: 'p1',
      onChainId: 1,
      recipient: '0xabc',
      amount: 5000,
      sourceCurrency: 'USDC',
      targetCurrency: 'EURC',
      reference: 'INV-001',
      status: 'COMPLETED',
      cpnPaymentId: null,
      txHash: '0xdef',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(payout.onChainId).toBe(1);
  });

  it('PayoutStatus covers all valid values', () => {
    const statuses: PayoutStatus[] = [
      'PENDING', 'PROCESSING', 'CONVERTING', 'SETTLING', 'COMPLETED', 'FAILED',
    ];
    expect(statuses).toHaveLength(6);
  });

  it('FXQuote type has all required fields', () => {
    const quote: FXQuote = {
      id: 'q1',
      fromCurrency: 'USDC',
      toCurrency: 'EURC',
      fromAmount: 10000,
      toAmount: 9235,
      rate: 0.9235,
      spread: 15,
      expiresAt: new Date().toISOString(),
      status: 'EXECUTED',
      txHash: '0x123',
      createdAt: new Date().toISOString(),
    };
    expect(quote.rate).toBe(0.9235);
  });

  it('Pipeline type supports nodes and edges', () => {
    const node: PipelineNode = {
      id: 'n1',
      type: 'trigger',
      position: { x: 100, y: 200 },
      data: { label: 'Test', config: { cron: '* * * * *' } },
    };
    const edge: PipelineEdge = {
      id: 'e1',
      source: 'n1',
      target: 'n2',
      label: 'success',
    };
    const pipeline: Pipeline = {
      id: 'pl1',
      name: 'Test Pipeline',
      nodes: [node],
      edges: [edge],
      metadata: null,
      ownerWallet: '0xabc',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(pipeline.nodes).toHaveLength(1);
    expect(pipeline.edges).toHaveLength(1);
  });

  it('PipelineExecutionStatus covers all valid values', () => {
    const statuses: PipelineExecutionStatus[] = [
      'PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL_FAILURE', 'FAILED',
    ];
    expect(statuses).toHaveLength(5);
  });

  it('Budget type has all required fields', () => {
    const budget: Budget = {
      id: 'b1',
      onChainId: 1,
      name: 'Engineering',
      departmentHead: '0xabc',
      totalAllocation: 500000,
      spent: 195000,
      periodStart: new Date().toISOString(),
      periodEnd: new Date().toISOString(),
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(budget.totalAllocation - budget.spent).toBe(305000);
  });

  it('VaultSnapshot type has all required fields', () => {
    const snap: VaultSnapshot = {
      id: 's1',
      liquidUSDC: 373500,
      usycBalance: 871500,
      totalValue: 1245000,
      yieldAccrued: 45000,
      apy: 4.85,
      timestamp: new Date().toISOString(),
    };
    expect(snap.liquidUSDC + snap.usycBalance).toBe(snap.totalValue);
  });

  it('DashboardStats type has all required fields', () => {
    const stats: DashboardStats = {
      totalTreasuryValue: 1245000,
      liquidUSDC: 373500,
      usycBalance: 871500,
      currentAPY: 4.85,
      yieldAccrued30d: 45000,
      pendingPayouts: 3,
      pendingPayoutsValue: 50000,
      totalBudgetAllocated: 950000,
      totalBudgetSpent: 332000,
    };
    expect(stats.totalTreasuryValue).toBe(1245000);
  });

  it('ApiResponse and PaginatedResponse work with generics', () => {
    const resp: ApiResponse<Payout> = {
      data: {
        id: 'p1', onChainId: 1, recipient: '0x1', amount: 100,
        sourceCurrency: 'USDC', targetCurrency: 'USDC', reference: null,
        status: 'COMPLETED', cpnPaymentId: null, txHash: null,
        createdAt: '', updatedAt: '',
      },
    };
    expect(resp.data.id).toBe('p1');

    const paginated: PaginatedResponse<Transaction> = {
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
      hasMore: false,
    };
    expect(paginated.data).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════
// Integration Types Tests
// ══════════════════════════════════════════════════════════════

describe('Integration Types', () => {
  it('TxResult shape is correct', () => {
    const result: TxResult = {
      txHash: '0xabc',
      blockNumber: 100,
      status: 'success',
    };
    expect(result.status).toBe('success');
  });

  it('YieldDataPoint shape is correct', () => {
    const point: YieldDataPoint = {
      timestamp: new Date(),
      apy: 4.85,
      totalValue: 1245000,
    };
    expect(point.apy).toBe(4.85);
  });

  it('FXQuoteResult shape is correct', () => {
    const quote: FXQuoteResult = {
      quoteId: 'q1',
      fromCurrency: 'USDC',
      toCurrency: 'EURC',
      fromAmount: '10000',
      toAmount: '9235',
      rate: 0.9235,
      spread: 0.0005,
      expiresAt: new Date(),
    };
    expect(quote.rate).toBeLessThan(1);
  });

  it('CPNPaymentParams shape is correct', () => {
    const params: CPNPaymentParams = {
      recipient: '0xabc',
      amount: '5000',
      currency: 'USDC',
      reference: 'INV-001',
      metadata: { department: 'Engineering' },
    };
    expect(params.reference).toBe('INV-001');
  });
});

// ══════════════════════════════════════════════════════════════
// Mock Service Adapter Tests
// ══════════════════════════════════════════════════════════════

describe('MockUSYCAdapter', () => {
  it('deposit increases balance and returns success', async () => {
    const adapter = new MockUSYCAdapter();
    const before = await adapter.getBalance('0x1');
    const result = await adapter.deposit(1_000_000n);
    const after = await adapter.getBalance('0x1');

    expect(result.status).toBe('success');
    expect(result.txHash).toMatch(/^0x/);
    expect(result.blockNumber).toBeGreaterThan(0);
    expect(after).toBe(before + 1_000_000n);
  });

  it('redeem decreases balance and returns success', async () => {
    const adapter = new MockUSYCAdapter();
    const before = await adapter.getBalance('0x1');
    const result = await adapter.redeem(1_000_000n);
    const after = await adapter.getBalance('0x1');

    expect(result.status).toBe('success');
    expect(after).toBe(before - 1_000_000n);
  });

  it('redeem over balance returns failed', async () => {
    const adapter = new MockUSYCAdapter();
    const balance = await adapter.getBalance('0x1');
    const result = await adapter.redeem(balance + 1n);
    expect(result.status).toBe('failed');
  });

  it('getCurrentRate returns a positive number', async () => {
    const adapter = new MockUSYCAdapter();
    const rate = await adapter.getCurrentRate();
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBe(4.85);
  });

  it('getYieldHistory returns correct number of points', async () => {
    const adapter = new MockUSYCAdapter();
    const history = await adapter.getYieldHistory(30);
    expect(history).toHaveLength(31); // 30 days + today
    for (const point of history) {
      expect(point.timestamp).toBeInstanceOf(Date);
      expect(point.apy).toBeGreaterThan(0);
      expect(point.totalValue).toBeGreaterThan(0);
    }
  });
});

describe('MockCPNAdapter', () => {
  it('sendPayment returns initiated status', async () => {
    const adapter = new MockCPNAdapter();
    const result = await adapter.sendPayment({
      recipient: '0xabc',
      amount: '5000',
      currency: 'USDC',
      reference: 'INV-001',
    });

    expect(result.paymentId).toBeTruthy();
    expect(result.status).toBe('initiated');
    expect(result.estimatedCompletion).toBeInstanceOf(Date);
    expect(result.estimatedCompletion.getTime()).toBeGreaterThan(Date.now());
  });

  it('getPaymentStatus returns initiated for fresh payment', async () => {
    const adapter = new MockCPNAdapter();
    const payment = await adapter.sendPayment({
      recipient: '0xabc',
      amount: '5000',
      currency: 'USDC',
      reference: 'INV-001',
    });
    const status = await adapter.getPaymentStatus(payment.paymentId);

    expect(status.paymentId).toBe(payment.paymentId);
    expect(status.status).toBe('initiated');
  });

  it('getPaymentStatus throws for unknown payment', async () => {
    const adapter = new MockCPNAdapter();
    await expect(
      adapter.getPaymentStatus('unknown-id')
    ).rejects.toThrow('Payment not found');
  });

  it('verifyCompliance returns compliant for any address', async () => {
    const adapter = new MockCPNAdapter();
    const result = await adapter.verifyCompliance('0xabc123');

    expect(result.address).toBe('0xabc123');
    expect(result.compliant).toBe(true);
    expect(result.riskScore).toBeLessThan(100);
    expect(result.checks).toHaveLength(4);
    for (const check of result.checks) {
      expect(check).toContain('PASS');
    }
  });
});

// ══════════════════════════════════════════════════════════════
// Utility Function Tests
// ══════════════════════════════════════════════════════════════

describe('Utils', () => {
  describe('cn()', () => {
    it('merges class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('handles conditional classes', () => {
      expect(cn('base', false && 'hidden', 'extra')).toBe('base extra');
    });

    it('deduplicates tailwind classes', () => {
      expect(cn('p-4', 'p-8')).toBe('p-8');
    });
  });

  describe('formatCurrency()', () => {
    it('formats number as USD', () => {
      const result = formatCurrency(1234.56);
      expect(result).toContain('1,234.56');
    });

    it('formats string amount', () => {
      const result = formatCurrency('50000.00');
      expect(result).toContain('50,000.00');
    });

    it('formats with custom currency', () => {
      const result = formatCurrency(1000, 'EUR');
      expect(result).toContain('1,000.00');
    });
  });

  describe('shortenAddress()', () => {
    it('shortens a full address', () => {
      const result = shortenAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18');
      expect(result).toBe('0x742d...bD18');
    });

    it('respects custom char count', () => {
      const result = shortenAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18', 6);
      expect(result).toBe('0x742d35...f2bD18');
    });

    it('returns empty string for empty input', () => {
      expect(shortenAddress('')).toBe('');
    });
  });
});
