import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { executePipeline } from '@/lib/pipeline-engine';

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ executionId: string }> };

/**
 * POST /api/pipelines/executions/[executionId]/resume
 *
 * Resume a paused or awaiting-approval execution.
 * For approval gates: marks the approval step as completed, then re-runs the pipeline
 *   from the paused node onward.
 * For delays: marks the delay step as completed, then re-runs.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { executionId } = await params;

    const execution = await prisma.pipelineExecution.findUnique({
      where: { id: executionId },
      include: { pipeline: true },
    });

    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    if (execution.status !== 'AWAITING_APPROVAL' && execution.status !== 'PAUSED') {
      return NextResponse.json(
        { error: `Cannot resume execution in status: ${execution.status}` },
        { status: 409 },
      );
    }

    // Get the paused node ID from results
    const results = (execution.results as Record<string, unknown>) || {};
    const pausedAtNodeId = results.pausedAtNodeId as string | undefined;

    if (pausedAtNodeId) {
      // Mark the paused step as completed in the results
      const steps = (results.steps as Array<{ nodeId: string; status: string }>) || [];
      const step = steps.find((s) => s.nodeId === pausedAtNodeId);
      if (step) {
        step.status = 'completed';
      }

      // If it was a delay, mark the DelaySchedule as RESUMED
      if (execution.status === 'PAUSED') {
        await prisma.delaySchedule.updateMany({
          where: { executionId, nodeId: pausedAtNodeId },
          data: { status: 'RESUMED' },
        });
      }

      // Persist updated results
      await prisma.pipelineExecution.update({
        where: { id: executionId },
        data: {
          results: { ...results, steps } as unknown as import('@prisma/client').Prisma.InputJsonValue,
        },
      });
    }

    // Set status back to RUNNING and re-execute
    await prisma.pipelineExecution.update({
      where: { id: executionId },
      data: { status: 'RUNNING' },
    });

    // Fire and forget: re-execute the pipeline (it will pick up from where it left off
    // since completed steps won't re-execute)
    executePipeline(
      execution.pipeline,
      executionId,
      execution.triggeredBy,
    ).catch((err) => {
      console.error('[resume] Pipeline execution error:', err);
    });

    return NextResponse.json({ ok: true, resumedFrom: pausedAtNodeId });
  } catch (error) {
    console.error('[POST /api/pipelines/executions/[executionId]/resume]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
