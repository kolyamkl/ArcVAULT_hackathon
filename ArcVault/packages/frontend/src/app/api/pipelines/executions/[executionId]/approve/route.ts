import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage } from 'viem';
import prisma from '@/lib/prisma';

export const dynamic = "force-dynamic";

/**
 * Build the approval message server-side (must match the client version).
 */
function buildApprovalMessage(executionId: string, nodeId: string): string {
  return [
    'ArcVault Pipeline Approval',
    '',
    `Execution: ${executionId}`,
    `Node: ${nodeId}`,
    '',
    'I approve the continuation of this pipeline execution.',
  ].join('\n');
}

type RouteContext = { params: Promise<{ executionId: string }> };

/**
 * POST /api/pipelines/executions/[executionId]/approve
 *
 * Submit an approval for a specific node in the execution.
 * Body: { approverAddress: string, nodeId: string, signature: string }
 *
 * If the approval threshold is met, triggers pipeline resumption.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { executionId } = await params;
    const { approverAddress, nodeId, signature } = await req.json();

    if (!approverAddress || !nodeId || !signature) {
      return NextResponse.json(
        { error: 'Missing approverAddress, nodeId, or signature' },
        { status: 400 },
      );
    }

    // Verify wallet signature matches the approver address
    const message = buildApprovalMessage(executionId, nodeId);
    const valid = await verifyMessage({
      address: approverAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid signature — signer does not match approver address' },
        { status: 403 },
      );
    }

    // Upsert approval with verified signature
    await prisma.approvalRequest.upsert({
      where: {
        executionId_nodeId_approverAddress: {
          executionId,
          nodeId,
          approverAddress,
        },
      },
      create: {
        executionId,
        nodeId,
        approverAddress,
        status: 'APPROVED',
        signature,
      },
      update: {
        status: 'APPROVED',
        signature,
      },
    });

    // Count approvals for this node
    const approvedCount = await prisma.approvalRequest.count({
      where: { executionId, nodeId, status: 'APPROVED' },
    });

    // Get execution to check threshold from node data
    const execution = await prisma.pipelineExecution.findUnique({
      where: { id: executionId },
      include: { pipeline: true },
    });

    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    const nodes = execution.pipeline.nodes as Array<{ id: string; data: Record<string, unknown> }>;
    const node = nodes.find((n) => n.id === nodeId);
    const threshold = Number(node?.data?.threshold) || 1;

    const met = approvedCount >= threshold;

    if (met && execution.status === 'AWAITING_APPROVAL') {
      // Trigger resume by calling the resume endpoint internally
      const baseUrl = req.nextUrl.origin;
      fetch(`${baseUrl}/api/pipelines/executions/${executionId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId }),
      }).catch(console.error);
    }

    return NextResponse.json({
      nodeId,
      approvalCount: approvedCount,
      threshold,
      met,
    });
  } catch (error) {
    console.error('[POST /api/pipelines/executions/[executionId]/approve]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/pipelines/executions/[executionId]/approve?nodeId=xxx
 *
 * Get approval status for a specific node.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { executionId } = await params;
    const nodeId = req.nextUrl.searchParams.get('nodeId');

    if (!nodeId) {
      return NextResponse.json({ error: 'Missing nodeId query param' }, { status: 400 });
    }

    const approvals = await prisma.approvalRequest.findMany({
      where: { executionId, nodeId },
    });

    // Get threshold from pipeline
    const execution = await prisma.pipelineExecution.findUnique({
      where: { id: executionId },
      include: { pipeline: true },
    });

    const nodes = (execution?.pipeline.nodes as Array<{ id: string; data: Record<string, unknown> }>) || [];
    const node = nodes.find((n) => n.id === nodeId);
    const threshold = Number(node?.data?.threshold) || 1;
    const approvedCount = approvals.filter((a) => a.status === 'APPROVED').length;

    return NextResponse.json({
      nodeId,
      approvals: approvals.map((a) => ({
        address: a.approverAddress,
        status: a.status,
      })),
      threshold,
      met: approvedCount >= threshold,
    });
  } catch (error) {
    console.error('[GET /api/pipelines/executions/[executionId]/approve]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
