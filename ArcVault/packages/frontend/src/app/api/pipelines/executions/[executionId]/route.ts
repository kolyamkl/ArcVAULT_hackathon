import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { serializeDecimals } from '@/lib/validations/api';

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ executionId: string }> };

/**
 * GET /api/pipelines/executions/[executionId]
 *
 * Polling endpoint — returns the current execution state including per-node
 * steps and log entries. The frontend polls this every 2s via usePipelineExecution.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { executionId } = await params;

    const execution = await prisma.pipelineExecution.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    const results = (execution.results as Record<string, unknown>) || {};
    const steps = (results.steps as unknown[]) || [];
    const logs = (results.logs as unknown[]) || [];

    return NextResponse.json({
      id: execution.id,
      pipelineId: execution.pipelineId,
      status: execution.status,
      steps,
      newLogs: logs,
      startedAt: execution.startedAt.toISOString(),
      completedAt: execution.completedAt?.toISOString() ?? null,
      totalCost: serializeDecimals(execution.totalCost),
      fxCost: serializeDecimals(execution.fxCost),
    });
  } catch (error) {
    console.error('[GET /api/pipelines/executions/[executionId]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
