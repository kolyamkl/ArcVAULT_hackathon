import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ── Helper Constants ──────────────────────────────────────────

const TREASURY_WALLET = '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18';
const CFO_WALLET = '0x8ba1f109551bD432803012645Ac136ddd64DBA72';
const ENGINEERING_HEAD = '0xdD2FD4581271e230360230F9337D5c0430Bf44C0';
const MARKETING_HEAD = '0xbDA5747bFD65F08deb54cb465eB87D40e51B197E';
const OPERATIONS_HEAD = '0x2546BcD3c84621e976D8185a91A922aE77ECEc30';
const HR_HEAD = '0xcd3B766CCDd6AE721141F452C550Ca635964ce71';

const RECIPIENT_1 = '0xFABB0ac9d68B0B445fB7357272Ff202C5651694a';
const RECIPIENT_2 = '0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec';
const RECIPIENT_3 = '0x71bE63f3384f5fb98995898A86B02Fb2426c5788';
const RECIPIENT_4 = '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720';
const RECIPIENT_5 = '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f';

const CHAIN_ID = 421614;

// ── Seed Functions ────────────────────────────────────────────

async function seedVaultSnapshots() {
  console.log('Seeding VaultSnapshots (30 days)...');

  const snapshots: Prisma.VaultSnapshotCreateManyInput[] = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const dayIndex = 29 - i;
    const apy = 4.5 + (dayIndex / 29) * 0.35;

    const baseValue = 900000;
    const depositGrowth = (dayIndex / 29) * 300000;
    const yieldGrowth = (dayIndex / 29) * 45000;
    const totalValue = baseValue + depositGrowth + yieldGrowth;

    const liquidUSDC = totalValue * 0.3;
    const usycBalance = totalValue * 0.7;
    const yieldAccrued = yieldGrowth;

    snapshots.push({
      liquidUSDC: new Prisma.Decimal(liquidUSDC.toFixed(2)),
      usycBalance: new Prisma.Decimal(usycBalance.toFixed(2)),
      totalValue: new Prisma.Decimal(totalValue.toFixed(2)),
      yieldAccrued: new Prisma.Decimal(yieldAccrued.toFixed(2)),
      apy: new Prisma.Decimal(apy.toFixed(2)),
      timestamp: date,
    });
  }

  await prisma.vaultSnapshot.createMany({ data: snapshots });
  console.log(`  Created ${snapshots.length} VaultSnapshots`);
}

async function seedTransactions() {
  console.log('Seeding Transactions...');

  const now = new Date();
  const daysAgo = (d: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    return date;
  };

  const transactions: Prisma.TransactionCreateManyInput[] = [
    {
      type: 'DEPOSIT',
      txHash: '0xabc001def001abc001def001abc001def001abc001def001abc001def001ab01',
      fromAddress: CFO_WALLET,
      toAddress: TREASURY_WALLET,
      amount: new Prisma.Decimal('500000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { source: 'Circle mint', memo: 'Initial treasury funding' },
      chainId: CHAIN_ID,
      blockNumber: 18500001,
      createdAt: daysAgo(28),
    },
    {
      type: 'DEPOSIT',
      txHash: '0xabc002def002abc002def002abc002def002abc002def002abc002def002ab02',
      fromAddress: CFO_WALLET,
      toAddress: TREASURY_WALLET,
      amount: new Prisma.Decimal('200000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { source: 'Wire transfer', memo: 'Q1 operating budget' },
      chainId: CHAIN_ID,
      blockNumber: 18520050,
      createdAt: daysAgo(20),
    },
    {
      type: 'DEPOSIT',
      txHash: '0xabc003def003abc003def003abc003def003abc003def003abc003def003ab03',
      fromAddress: CFO_WALLET,
      toAddress: TREASURY_WALLET,
      amount: new Prisma.Decimal('150000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { source: 'Revenue deposit' },
      chainId: CHAIN_ID,
      blockNumber: 18545100,
      createdAt: daysAgo(10),
    },
    {
      type: 'WITHDRAW',
      txHash: '0xdef001abc001def001abc001def001abc001def001abc001def001abc001de01',
      fromAddress: TREASURY_WALLET,
      toAddress: CFO_WALLET,
      amount: new Prisma.Decimal('50000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { reason: 'Emergency operating funds' },
      chainId: CHAIN_ID,
      blockNumber: 18510030,
      createdAt: daysAgo(25),
    },
    {
      type: 'SWEEP',
      txHash: '0xfed001abc001fed001abc001fed001abc001fed001abc001fed001abc001fe01',
      fromAddress: TREASURY_WALLET,
      toAddress: TREASURY_WALLET,
      amount: new Prisma.Decimal('400000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { targetAsset: 'USYC', usycReceived: '399200.50' },
      chainId: CHAIN_ID,
      blockNumber: 18502000,
      createdAt: daysAgo(27),
    },
    {
      type: 'SWEEP',
      txHash: '0xfed002abc002fed002abc002fed002abc002fed002abc002fed002abc002fe02',
      fromAddress: TREASURY_WALLET,
      toAddress: TREASURY_WALLET,
      amount: new Prisma.Decimal('150000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { targetAsset: 'USYC', usycReceived: '149700.25' },
      chainId: CHAIN_ID,
      blockNumber: 18522000,
      createdAt: daysAgo(18),
    },
    {
      type: 'REDEEM',
      txHash: '0xcba001def001cba001def001cba001def001cba001def001cba001def001cb01',
      fromAddress: TREASURY_WALLET,
      toAddress: TREASURY_WALLET,
      amount: new Prisma.Decimal('100000.00'),
      currency: 'USYC',
      status: 'COMPLETED',
      metadata: { usdcReceived: '101250.00', exchangeRate: '1.0125' },
      chainId: CHAIN_ID,
      blockNumber: 18535000,
      createdAt: daysAgo(14),
    },
    {
      type: 'PAYOUT',
      txHash: '0xpay001def001pay001def001pay001def001pay001def001pay001def001pa01',
      fromAddress: TREASURY_WALLET,
      toAddress: RECIPIENT_1,
      amount: new Prisma.Decimal('25000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { payoutId: 1, reference: 'INV-2025-001' },
      chainId: CHAIN_ID,
      blockNumber: 18540000,
      createdAt: daysAgo(12),
    },
    {
      type: 'PAYOUT',
      txHash: '0xpay002def002pay002def002pay002def002pay002def002pay002def002pa02',
      fromAddress: TREASURY_WALLET,
      toAddress: RECIPIENT_2,
      amount: new Prisma.Decimal('18500.00'),
      currency: 'EURC',
      status: 'COMPLETED',
      metadata: { payoutId: 2, reference: 'INV-2025-002', fxRate: '0.9235' },
      chainId: CHAIN_ID,
      blockNumber: 18541000,
      createdAt: daysAgo(11),
    },
    {
      type: 'PAYOUT',
      txHash: '0xpay003def003pay003def003pay003def003pay003def003pay003def003pa03',
      fromAddress: TREASURY_WALLET,
      toAddress: RECIPIENT_3,
      amount: new Prisma.Decimal('42000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { payoutId: 3, reference: 'PO-2025-015' },
      chainId: CHAIN_ID,
      blockNumber: 18543000,
      createdAt: daysAgo(8),
    },
    {
      type: 'PAYOUT',
      txHash: null,
      fromAddress: TREASURY_WALLET,
      toAddress: RECIPIENT_4,
      amount: new Prisma.Decimal('15000.00'),
      currency: 'USDC',
      status: 'PENDING',
      metadata: { payoutId: 4, reference: 'INV-2025-003' },
      chainId: CHAIN_ID,
      blockNumber: null,
      createdAt: daysAgo(2),
    },
    {
      type: 'PAYOUT',
      txHash: null,
      fromAddress: TREASURY_WALLET,
      toAddress: RECIPIENT_5,
      amount: new Prisma.Decimal('8750.00'),
      currency: 'EURC',
      status: 'PROCESSING',
      metadata: { payoutId: 5, reference: 'INV-2025-004', fxRate: '0.9240' },
      chainId: CHAIN_ID,
      blockNumber: null,
      createdAt: daysAgo(1),
    },
    {
      type: 'FX_SWAP',
      txHash: '0xfx001abc001fx001abc001fx001abc001fx001abc001fx001abc001fx001fx01',
      fromAddress: TREASURY_WALLET,
      toAddress: TREASURY_WALLET,
      amount: new Prisma.Decimal('50000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { toCurrency: 'EURC', toAmount: '46175.00', rate: '0.9235', quoteId: 'q1' },
      chainId: CHAIN_ID,
      blockNumber: 18538000,
      createdAt: daysAgo(13),
    },
    {
      type: 'FX_SWAP',
      txHash: '0xfx002abc002fx002abc002fx002abc002fx002abc002fx002abc002fx002fx02',
      fromAddress: TREASURY_WALLET,
      toAddress: TREASURY_WALLET,
      amount: new Prisma.Decimal('30000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { toCurrency: 'EURC', toAmount: '27720.00', rate: '0.9240', quoteId: 'q2' },
      chainId: CHAIN_ID,
      blockNumber: 18542000,
      createdAt: daysAgo(9),
    },
    {
      type: 'BUDGET_SPEND',
      txHash: '0xbud001abc001bud001abc001bud001abc001bud001abc001bud001abc001bu01',
      fromAddress: TREASURY_WALLET,
      toAddress: ENGINEERING_HEAD,
      amount: new Prisma.Decimal('75000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { budgetId: 1, department: 'Engineering', reference: 'Cloud infrastructure Q1' },
      chainId: CHAIN_ID,
      blockNumber: 18530000,
      createdAt: daysAgo(15),
    },
    {
      type: 'BUDGET_SPEND',
      txHash: '0xbud002abc002bud002abc002bud002abc002bud002abc002bud002abc002bu02',
      fromAddress: TREASURY_WALLET,
      toAddress: ENGINEERING_HEAD,
      amount: new Prisma.Decimal('120000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { budgetId: 1, department: 'Engineering', reference: 'Contractor payments Feb' },
      chainId: CHAIN_ID,
      blockNumber: 18548000,
      createdAt: daysAgo(5),
    },
    {
      type: 'BUDGET_SPEND',
      txHash: '0xbud003abc003bud003abc003bud003abc003bud003abc003bud003abc003bu03',
      fromAddress: TREASURY_WALLET,
      toAddress: MARKETING_HEAD,
      amount: new Prisma.Decimal('45000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { budgetId: 2, department: 'Marketing', reference: 'Ad campaigns Feb' },
      chainId: CHAIN_ID,
      blockNumber: 18547000,
      createdAt: daysAgo(6),
    },
    {
      type: 'BUDGET_SPEND',
      txHash: '0xbud004abc004bud004abc004bud004abc004bud004abc004bud004abc004bu04',
      fromAddress: TREASURY_WALLET,
      toAddress: OPERATIONS_HEAD,
      amount: new Prisma.Decimal('30000.00'),
      currency: 'USDC',
      status: 'COMPLETED',
      metadata: { budgetId: 3, department: 'Operations', reference: 'Office lease + utilities' },
      chainId: CHAIN_ID,
      blockNumber: 18549000,
      createdAt: daysAgo(3),
    },
  ];

  await prisma.transaction.createMany({ data: transactions });
  console.log(`  Created ${transactions.length} Transactions`);
}

async function seedPayouts() {
  console.log('Seeding Payouts...');

  const now = new Date();
  const daysAgo = (d: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    return date;
  };

  const payouts: Prisma.PayoutCreateManyInput[] = [
    {
      onChainId: 1,
      recipient: RECIPIENT_1,
      amount: new Prisma.Decimal('25000.00'),
      sourceCurrency: 'USDC',
      targetCurrency: 'USDC',
      reference: 'INV-2025-001',
      status: 'COMPLETED',
      txHash: '0xpay001def001pay001def001pay001def001pay001def001pay001def001pa01',
      createdAt: daysAgo(12),
    },
    {
      onChainId: 2,
      recipient: RECIPIENT_2,
      amount: new Prisma.Decimal('20000.00'),
      sourceCurrency: 'USDC',
      targetCurrency: 'EURC',
      reference: 'INV-2025-002',
      status: 'COMPLETED',
      cpnPaymentId: 'cpn_pay_abc123',
      txHash: '0xpay002def002pay002def002pay002def002pay002def002pay002def002pa02',
      createdAt: daysAgo(11),
    },
    {
      onChainId: 3,
      recipient: RECIPIENT_3,
      amount: new Prisma.Decimal('42000.00'),
      sourceCurrency: 'USDC',
      targetCurrency: 'USDC',
      reference: 'PO-2025-015',
      status: 'COMPLETED',
      txHash: '0xpay003def003pay003def003pay003def003pay003def003pay003def003pa03',
      createdAt: daysAgo(8),
    },
    {
      onChainId: 4,
      recipient: RECIPIENT_4,
      amount: new Prisma.Decimal('15000.00'),
      sourceCurrency: 'USDC',
      targetCurrency: 'USDC',
      reference: 'INV-2025-003',
      status: 'PENDING',
      createdAt: daysAgo(2),
    },
    {
      onChainId: 5,
      recipient: RECIPIENT_5,
      amount: new Prisma.Decimal('35000.00'),
      sourceCurrency: 'USDC',
      targetCurrency: 'EURC',
      reference: 'INV-2025-005',
      status: 'PENDING',
      createdAt: daysAgo(1),
    },
    {
      onChainId: 6,
      recipient: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
      amount: new Prisma.Decimal('8750.00'),
      sourceCurrency: 'USDC',
      targetCurrency: 'EURC',
      reference: 'INV-2025-004',
      status: 'PROCESSING',
      createdAt: daysAgo(1),
    },
    {
      onChainId: 7,
      recipient: '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
      amount: new Prisma.Decimal('62000.00'),
      sourceCurrency: 'USDC',
      targetCurrency: 'EURC',
      reference: 'PO-2025-022',
      status: 'CONVERTING',
      cpnPaymentId: 'cpn_pay_def456',
      createdAt: daysAgo(1),
    },
    {
      onChainId: 8,
      recipient: '0x14dC79964da2C08dda4C1086fB19a03801a4e0d5',
      amount: new Prisma.Decimal('28500.00'),
      sourceCurrency: 'USDC',
      targetCurrency: 'USDC',
      reference: 'INV-2025-006',
      status: 'SETTLING',
      txHash: '0xset001abc001set001abc001set001abc001set001abc001set001abc001se01',
      createdAt: daysAgo(1),
    },
  ];

  await prisma.payout.createMany({ data: payouts });
  console.log(`  Created ${payouts.length} Payouts`);
}

async function seedFXQuotes() {
  console.log('Seeding FXQuotes...');

  const now = new Date();
  const daysAgo = (d: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    return date;
  };

  const quotes: Prisma.FXQuoteCreateManyInput[] = [
    {
      fromCurrency: 'USDC',
      toCurrency: 'EURC',
      fromAmount: new Prisma.Decimal('50000.00'),
      toAmount: new Prisma.Decimal('46175.00'),
      rate: new Prisma.Decimal('0.9235'),
      spread: new Prisma.Decimal('15'),
      expiresAt: daysAgo(13),
      status: 'EXECUTED',
      txHash: '0xfx001abc001fx001abc001fx001abc001fx001abc001fx001abc001fx001fx01',
      createdAt: daysAgo(13),
    },
    {
      fromCurrency: 'USDC',
      toCurrency: 'EURC',
      fromAmount: new Prisma.Decimal('30000.00'),
      toAmount: new Prisma.Decimal('27720.00'),
      rate: new Prisma.Decimal('0.9240'),
      spread: new Prisma.Decimal('12'),
      expiresAt: daysAgo(9),
      status: 'EXECUTED',
      txHash: '0xfx002abc002fx002abc002fx002abc002fx002abc002fx002abc002fx002fx02',
      createdAt: daysAgo(9),
    },
    {
      fromCurrency: 'EURC',
      toCurrency: 'USDC',
      fromAmount: new Prisma.Decimal('20000.00'),
      toAmount: new Prisma.Decimal('21656.00'),
      rate: new Prisma.Decimal('1.0828'),
      spread: new Prisma.Decimal('18'),
      expiresAt: daysAgo(5),
      status: 'EXECUTED',
      txHash: '0xfx003abc003fx003abc003fx003abc003fx003abc003fx003abc003fx003fx03',
      createdAt: daysAgo(5),
    },
    {
      fromCurrency: 'USDC',
      toCurrency: 'EURC',
      fromAmount: new Prisma.Decimal('75000.00'),
      toAmount: new Prisma.Decimal('69262.50'),
      rate: new Prisma.Decimal('0.9235'),
      spread: new Prisma.Decimal('15'),
      expiresAt: new Date(now.getTime() + 25 * 1000),
      status: 'PENDING',
      createdAt: now,
    },
    {
      fromCurrency: 'USDC',
      toCurrency: 'EURC',
      fromAmount: new Prisma.Decimal('100000.00'),
      toAmount: new Prisma.Decimal('92350.00'),
      rate: new Prisma.Decimal('0.9235'),
      spread: new Prisma.Decimal('15'),
      expiresAt: daysAgo(3),
      status: 'EXPIRED',
      createdAt: daysAgo(3),
    },
  ];

  await prisma.fXQuote.createMany({ data: quotes });
  console.log(`  Created ${quotes.length} FXQuotes`);
}

async function seedPipelines() {
  console.log('Seeding Pipelines...');

  const monthlyPayroll = await prisma.pipeline.create({
    data: {
      name: 'Monthly Payroll',
      ownerWallet: CFO_WALLET,
      nodes: [
        {
          id: 'node-1',
          type: 'trigger',
          position: { x: 100, y: 200 },
          data: { label: 'Monthly Schedule', config: { cron: '0 9 1 * *' } },
        },
        {
          id: 'node-2',
          type: 'check-balance',
          position: { x: 350, y: 200 },
          data: { label: 'Check Vault Balance', config: { minBalance: 200000 } },
        },
        {
          id: 'node-3',
          type: 'redeem-usyc',
          position: { x: 600, y: 100 },
          data: { label: 'Redeem USYC if Needed', config: { amount: 'dynamic' } },
        },
        {
          id: 'node-4',
          type: 'batch-payout',
          position: { x: 850, y: 200 },
          data: {
            label: 'Execute Payroll',
            config: {
              recipients: [
                { address: RECIPIENT_1, amount: 12000, currency: 'USDC' },
                { address: RECIPIENT_2, amount: 10500, currency: 'EURC' },
                { address: RECIPIENT_3, amount: 15000, currency: 'USDC' },
                { address: RECIPIENT_4, amount: 8000, currency: 'USDC' },
              ],
            },
          },
        },
        {
          id: 'node-5',
          type: 'notification',
          position: { x: 1100, y: 200 },
          data: { label: 'Notify CFO', config: { channel: 'email', to: 'cfo@arcvault.io' } },
        },
      ],
      edges: [
        { id: 'e1-2', source: 'node-1', target: 'node-2' },
        { id: 'e2-3', source: 'node-2', target: 'node-3', label: 'Insufficient' },
        { id: 'e2-4', source: 'node-2', target: 'node-4', label: 'Sufficient' },
        { id: 'e3-4', source: 'node-3', target: 'node-4' },
        { id: 'e4-5', source: 'node-4', target: 'node-5' },
      ],
      metadata: {
        description: 'Automated monthly payroll disbursement',
        totalMonthly: 45500,
        lastRun: null,
      },
    },
  });

  const q1Contractors = await prisma.pipeline.create({
    data: {
      name: 'Q1 Contractor Payments',
      ownerWallet: CFO_WALLET,
      nodes: [
        {
          id: 'node-1',
          type: 'trigger',
          position: { x: 100, y: 200 },
          data: { label: 'Manual Trigger', config: { type: 'manual' } },
        },
        {
          id: 'node-2',
          type: 'fx-convert',
          position: { x: 350, y: 150 },
          data: { label: 'Convert USDC->EURC', config: { amount: 30000, slippageBps: 50 } },
        },
        {
          id: 'node-3',
          type: 'batch-payout',
          position: { x: 600, y: 200 },
          data: {
            label: 'Pay Contractors',
            config: {
              recipients: [
                { address: RECIPIENT_5, amount: 18000, currency: 'EURC' },
                { address: RECIPIENT_2, amount: 12000, currency: 'EURC' },
              ],
            },
          },
        },
      ],
      edges: [
        { id: 'e1-2', source: 'node-1', target: 'node-2' },
        { id: 'e2-3', source: 'node-2', target: 'node-3' },
      ],
      metadata: {
        description: 'Quarterly contractor payment pipeline with FX conversion',
        totalQuarterly: 30000,
      },
    },
  });

  await prisma.pipeline.create({
    data: {
      name: 'Weekly Yield Sweep',
      ownerWallet: TREASURY_WALLET,
      nodes: [
        {
          id: 'node-1',
          type: 'trigger',
          position: { x: 100, y: 200 },
          data: { label: 'Weekly Schedule', config: { cron: '0 0 * * 1' } },
        },
        {
          id: 'node-2',
          type: 'check-balance',
          position: { x: 350, y: 200 },
          data: { label: 'Check Idle USDC', config: { threshold: 100000 } },
        },
        {
          id: 'node-3',
          type: 'sweep-to-yield',
          position: { x: 600, y: 200 },
          data: { label: 'Sweep to USYC', config: { keepLiquid: 100000 } },
        },
      ],
      edges: [
        { id: 'e1-2', source: 'node-1', target: 'node-2' },
        { id: 'e2-3', source: 'node-2', target: 'node-3', label: 'Above threshold' },
      ],
      metadata: {
        description: 'Automatically sweep excess USDC into USYC yield position',
      },
    },
  });

  console.log('  Created 3 Pipelines');

  const now = new Date();
  const daysAgo = (d: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    return date;
  };

  await prisma.pipelineExecution.createMany({
    data: [
      {
        pipelineId: monthlyPayroll.id,
        status: 'COMPLETED',
        totalCost: new Prisma.Decimal('45500.00'),
        fxCost: new Prisma.Decimal('48.25'),
        results: {
          nodes: {
            'node-1': { status: 'success', output: 'Triggered on schedule' },
            'node-2': { status: 'success', output: 'Balance: $380,000 (sufficient)' },
            'node-4': { status: 'success', output: '4 payouts executed', txHashes: ['0xaaa...', '0xbbb...', '0xccc...', '0xddd...'] },
            'node-5': { status: 'success', output: 'Email sent to cfo@arcvault.io' },
          },
        },
        triggeredBy: 'CRON',
        startedAt: daysAgo(30),
        completedAt: daysAgo(30),
      },
      {
        pipelineId: q1Contractors.id,
        status: 'COMPLETED',
        totalCost: new Prisma.Decimal('30000.00'),
        fxCost: new Prisma.Decimal('135.00'),
        results: {
          nodes: {
            'node-1': { status: 'success', output: 'Manually triggered by CFO' },
            'node-2': { status: 'success', output: 'Converted 30000 USDC to 27720 EURC' },
            'node-3': { status: 'success', output: '2 payouts executed' },
          },
        },
        triggeredBy: CFO_WALLET,
        startedAt: daysAgo(7),
        completedAt: daysAgo(7),
      },
    ],
  });

  console.log('  Created 2 PipelineExecutions');
}

async function seedBudgets() {
  console.log('Seeding Budgets...');

  const now = new Date();
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0, 23, 59, 59);

  const budgets: Prisma.BudgetCreateManyInput[] = [
    {
      onChainId: 1,
      name: 'Engineering',
      departmentHead: ENGINEERING_HEAD,
      totalAllocation: new Prisma.Decimal('500000.00'),
      spent: new Prisma.Decimal('195000.00'),
      periodStart: quarterStart,
      periodEnd: quarterEnd,
      active: true,
    },
    {
      onChainId: 2,
      name: 'Marketing',
      departmentHead: MARKETING_HEAD,
      totalAllocation: new Prisma.Decimal('200000.00'),
      spent: new Prisma.Decimal('45000.00'),
      periodStart: quarterStart,
      periodEnd: quarterEnd,
      active: true,
    },
    {
      onChainId: 3,
      name: 'Operations',
      departmentHead: OPERATIONS_HEAD,
      totalAllocation: new Prisma.Decimal('150000.00'),
      spent: new Prisma.Decimal('30000.00'),
      periodStart: quarterStart,
      periodEnd: quarterEnd,
      active: true,
    },
    {
      onChainId: 4,
      name: 'Human Resources',
      departmentHead: HR_HEAD,
      totalAllocation: new Prisma.Decimal('100000.00'),
      spent: new Prisma.Decimal('62000.00'),
      periodStart: quarterStart,
      periodEnd: quarterEnd,
      active: true,
    },
  ];

  await prisma.budget.createMany({ data: budgets });
  console.log(`  Created ${budgets.length} Budgets`);
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('Starting ArcVault seed...\n');

  await prisma.pipelineExecution.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.vaultSnapshot.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.fXQuote.deleteMany();
  await prisma.budget.deleteMany();

  console.log('Cleared existing data.\n');

  await seedVaultSnapshots();
  await seedTransactions();
  await seedPayouts();
  await seedFXQuotes();
  await seedPipelines();
  await seedBudgets();

  console.log('\nSeed complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
