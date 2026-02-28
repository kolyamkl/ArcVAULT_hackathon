import { NextRequest, NextResponse } from 'next/server';
import {
  mockDashboard,
  mockVaultStatus,
  mockVaultHistory,
  mockVaultSnapshots,
  getMockFXQuote,
  mockFXHistory,
  mockPayouts,
  mockPipelines,
  mockTransactionList,
} from '@/lib/mock-data';
import type {
  FXExecution,
  Payout,
  BatchPayoutResult,
  Pipeline,
  PipelineExecution,
} from '@/types/api';

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const joined = path.join('/');

  // GET /api/dashboard
  if (joined === 'dashboard') {
    return NextResponse.json(mockDashboard);
  }

  // GET /api/vault/status
  if (joined === 'vault/status') {
    return NextResponse.json(mockVaultStatus);
  }

  // GET /api/vault/history
  if (joined === 'vault/history') {
    return NextResponse.json(mockVaultHistory);
  }

  // GET /api/vault/snapshots
  if (joined === 'vault/snapshots') {
    return NextResponse.json(mockVaultSnapshots);
  }

  // GET /api/fx/quote?pair=USDC/EURC&amount=1000
  if (joined === 'fx/quote') {
    const pair = req.nextUrl.searchParams.get('pair') ?? 'USDC/EURC';
    const amount = Number(req.nextUrl.searchParams.get('amount') ?? '1000');
    const [from, to] = pair.split('/');
    return NextResponse.json(getMockFXQuote(from ?? 'USDC', to ?? 'EURC', amount));
  }

  // GET /api/fx/history
  if (joined === 'fx/history') {
    return NextResponse.json(mockFXHistory);
  }

  // GET /api/payouts
  if (joined === 'payouts') {
    return NextResponse.json(mockPayouts);
  }

  // GET /api/pipelines
  if (joined === 'pipelines') {
    return NextResponse.json(mockPipelines);
  }

  // GET /api/pipelines/[id]
  if (path[0] === 'pipelines' && path.length === 2) {
    const pipeline = mockPipelines.find((p) => p.id === path[1]);
    if (pipeline) return NextResponse.json(pipeline);
    return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
  }

  // GET /api/transactions
  if (joined === 'transactions') {
    return NextResponse.json(mockTransactionList);
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const joined = path.join('/');

  // POST /api/fx/execute
  if (joined === 'fx/execute') {
    const body = await req.json();
    const execution: FXExecution = {
      id: `exec-${Date.now()}`,
      quoteId: body.quoteId ?? 'unknown',
      status: 'COMPLETED',
      txHash: `0x${Date.now().toString(16)}${'0'.repeat(48)}`.slice(0, 66),
      fromAmount: Number(body.fromAmount ?? 0),
      toAmount: Number(body.fromAmount ?? 0) * 0.92,
      executedAt: new Date().toISOString(),
    };
    return NextResponse.json(execution);
  }

  // POST /api/payouts
  if (joined === 'payouts') {
    const body = await req.json();
    const payout: Payout = {
      id: `pay-${Date.now()}`,
      recipient: body.recipient ?? '0x0',
      amount: body.amount ?? 0,
      currency: body.currency ?? 'USDC',
      reference: body.reference ?? '',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    return NextResponse.json(payout, { status: 201 });
  }

  // POST /api/payouts/batch
  if (joined === 'payouts/batch') {
    const body = await req.json();
    const payoutRequests = body.payouts ?? [];
    const payouts: Payout[] = payoutRequests.map(
      (p: { recipient?: string; amount?: number; currency?: string; reference?: string }, i: number) => ({
        id: `pay-batch-${Date.now()}-${i}`,
        recipient: p.recipient ?? '0x0',
        amount: p.amount ?? 0,
        currency: p.currency ?? 'USDC',
        reference: p.reference ?? '',
        status: 'PENDING' as const,
        createdAt: new Date().toISOString(),
      })
    );
    const result: BatchPayoutResult = {
      successful: payouts.length,
      failed: 0,
      payouts,
    };
    return NextResponse.json(result, { status: 201 });
  }

  // POST /api/pipelines
  if (joined === 'pipelines') {
    const body = await req.json();
    const pipeline: Pipeline = {
      id: `pipe-${Date.now()}`,
      name: body.name ?? 'Untitled Pipeline',
      description: body.description,
      steps: body.steps ?? [],
      connections: body.connections ?? [],
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json(pipeline, { status: 201 });
  }

  // POST /api/pipelines/[id]/execute
  if (path[0] === 'pipelines' && path.length === 3 && path[2] === 'execute') {
    const execution: PipelineExecution = {
      id: `pexec-${Date.now()}`,
      pipelineId: path[1],
      status: 'RUNNING',
      steps: [],
      newLogs: [],
      startedAt: new Date().toISOString(),
    };
    return NextResponse.json({ execution: { id: execution.id, status: execution.status } });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// ---------------------------------------------------------------------------
// PUT handler (for pipeline updates)
// ---------------------------------------------------------------------------

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;

  // PUT /api/pipelines/[id]
  if (path[0] === 'pipelines' && path.length === 2) {
    const body = await req.json();
    const existing = mockPipelines.find((p) => p.id === path[1]);
    const pipeline: Pipeline = {
      id: path[1],
      name: body.name ?? existing?.name ?? 'Untitled',
      description: body.description ?? existing?.description,
      steps: body.steps ?? existing?.steps ?? [],
      connections: body.connections ?? existing?.connections ?? [],
      status: body.status ?? existing?.status ?? 'DRAFT',
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json(pipeline);
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// ---------------------------------------------------------------------------
// DELETE handler
// ---------------------------------------------------------------------------

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;

  // DELETE /api/pipelines/[id]
  if (path[0] === 'pipelines' && path.length === 2) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
