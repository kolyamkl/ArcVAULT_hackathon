import { NextRequest, NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ executionId: string }> };

/**
 * POST /api/pipelines/executions/[executionId]/process
 *
 * Background processor — invoked fire-and-forget by the execute trigger.
 * Runs the pipeline engine synchronously, writing progress to DB after each node.
 * The response is ignored by the caller; all state is persisted via DB.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { executionId } = await params;

  try {
    const { default: prisma } = await import('@/lib/prisma');
    const { executePipeline } = await import('@/lib/pipeline-engine');

    const body = await req.json();
    const { pipelineId, triggeredBy } = body;
    console.log(`[POST /api/pipelines/executions/${executionId}/process] Received: pipelineId=${pipelineId}, triggeredBy=${triggeredBy}`);

    if (!pipelineId || !executionId) {
      return NextResponse.json({ error: 'Missing pipelineId or executionId' }, { status: 400 });
    }

    // Idempotency guard: atomically claim this execution by transitioning
    // RUNNING → PROCESSING (or AWAITING_APPROVAL/PAUSED for resumption).
    const claimed = await prisma.pipelineExecution.updateMany({
      where: {
        id: executionId,
        status: { in: ['RUNNING', 'AWAITING_APPROVAL', 'PAUSED'] },
      },
      data: { status: 'PROCESSING' },
    });

    if (claimed.count === 0) {
      console.log(`[POST /api/pipelines/executions/${executionId}/process] Already claimed or not resumable`);
      // Already claimed by another invocation or not in a resumable state
      return NextResponse.json({ error: 'Execution already claimed or not in a resumable state' }, { status: 409 });
    }
    console.log(`[POST /api/pipelines/executions/${executionId}/process] Claimed execution, transitioning to RUNNING`);

    // Set back to RUNNING so the polling endpoint shows correct status
    await prisma.pipelineExecution.update({
      where: { id: executionId },
      data: { status: 'RUNNING' },
    });

    // Fetch pipeline
    const pipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId },
    });

    if (!pipeline) {
      await prisma.pipelineExecution.update({
        where: { id: executionId },
        data: {
          status: 'FAILED',
          results: { steps: [], logs: [{ timestamp: new Date().toISOString(), message: 'Pipeline not found', status: 'error' }] },
          completedAt: new Date(),
        },
      });
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    // Run the engine — this writes progress to DB after each node
    console.log(`[POST /api/pipelines/executions/${executionId}/process] Starting pipeline engine for "${pipeline.name}"`);
    await executePipeline(pipeline, executionId, triggeredBy || 'unknown');
    console.log(`[POST /api/pipelines/executions/${executionId}/process] Pipeline engine finished`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[POST /api/pipelines/executions/[executionId]/process]', error);

    // Best-effort: mark execution as failed
    try {
      const { default: prisma } = await import('@/lib/prisma');
      await prisma.pipelineExecution.update({
        where: { id: executionId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
