import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { updatePipelineSchema, serializeDecimals } from "@/lib/validations/api";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/pipelines/[id] — get a single pipeline with recent executions
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    const pipeline = await prisma.pipeline.findUnique({
      where: { id },
      include: {
        executions: {
          take: 20,
          orderBy: { startedAt: "desc" },
        },
      },
    });

    if (!pipeline) {
      return NextResponse.json(
        { error: "Pipeline not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ pipeline: serializeDecimals(pipeline) });
  } catch (error) {
    console.error("[GET /api/pipelines/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/pipelines/[id] — update a pipeline
export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updatePipelineSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check existence
    const existing = await prisma.pipeline.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Pipeline not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.nodes !== undefined)
      updateData.nodes = parsed.data.nodes as unknown as Record<string, unknown>[];
    if (parsed.data.edges !== undefined)
      updateData.edges = parsed.data.edges as unknown as Record<string, unknown>[];
    if (parsed.data.metadata !== undefined)
      updateData.metadata = parsed.data.metadata as Record<string, unknown>;

    const pipeline = await prisma.pipeline.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ pipeline: serializeDecimals(pipeline) });
  } catch (error) {
    console.error("[PUT /api/pipelines/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/pipelines/[id] — delete a pipeline
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    const existing = await prisma.pipeline.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Pipeline not found" },
        { status: 404 }
      );
    }

    // Delete executions first (cascade), then the pipeline
    await prisma.$transaction([
      prisma.pipelineExecution.deleteMany({ where: { pipelineId: id } }),
      prisma.pipeline.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/pipelines/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
