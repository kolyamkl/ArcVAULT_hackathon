import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parsePagination, serializeDecimals } from "@/lib/validations/api";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/pipelines/[id]/history — execution history for a pipeline
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    // Verify pipeline exists
    const pipeline = await prisma.pipeline.findUnique({ where: { id } });
    if (!pipeline) {
      return NextResponse.json(
        { error: "Pipeline not found" },
        { status: 404 }
      );
    }

    const { searchParams } = req.nextUrl;
    const { page, limit, skip } = parsePagination(searchParams);

    const where = { pipelineId: id };

    const [executions, total] = await Promise.all([
      prisma.pipelineExecution.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.pipelineExecution.count({ where }),
    ]);

    return NextResponse.json({
      executions: executions.map(serializeDecimals),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[GET /api/pipelines/[id]/history]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
