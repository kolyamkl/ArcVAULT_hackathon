import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { executePipelineSchema } from "@/lib/validations/api";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/pipelines/[id]/execute — trigger pipeline execution
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await req.json();
    console.log(`[POST /api/pipelines/${id}/execute] Trigger received, body:`, body);
    const parsed = executePipelineSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { triggeredBy } = parsed.data;

    // Fetch the pipeline
    const pipeline = await prisma.pipeline.findUnique({ where: { id } });
    if (!pipeline) {
      return NextResponse.json(
        { error: "Pipeline not found" },
        { status: 404 }
      );
    }

    console.log(`[POST /api/pipelines/${id}/execute] Pipeline found: "${pipeline.name}", nodes: ${(pipeline.nodes as unknown[])?.length}`);

    // Create execution record with RUNNING status and empty results
    const execution = await prisma.pipelineExecution.create({
      data: {
        pipelineId: id,
        status: "RUNNING",
        totalCost: "0",
        fxCost: "0",
        results: { steps: [], logs: [] } as unknown as Prisma.InputJsonValue,
        triggeredBy,
        startedAt: new Date(),
      },
    });

    console.log(`[POST /api/pipelines/${id}/execute] Execution created: ${execution.id}, status: ${execution.status}`);

    // Fire-and-forget: trigger the background processor
    const origin = req.nextUrl.origin;
    fetch(`${origin}/api/pipelines/executions/${execution.id}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pipelineId: id,
        triggeredBy,
      }),
    }).catch((err) => {
      console.error("[execute] Failed to trigger process endpoint:", err);
    });

    return NextResponse.json(
      { execution: { id: execution.id, status: execution.status } },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/pipelines/[id]/execute]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
