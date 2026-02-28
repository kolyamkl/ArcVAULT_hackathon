import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createPipelineSchema, serializeDecimals } from "@/lib/validations/api";

// GET /api/pipelines — list all pipelines ordered by most recently updated
export async function GET() {
  try {
    const pipelines = await prisma.pipeline.findMany({
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ pipelines: pipelines.map(serializeDecimals) });
  } catch (error) {
    console.error("[GET /api/pipelines]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/pipelines — create a new pipeline
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createPipelineSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, nodes, edges, metadata, ownerWallet } = parsed.data;

    const pipeline = await prisma.pipeline.create({
      data: {
        name,
        nodes: nodes as unknown as Prisma.InputJsonValue,
        edges: edges as unknown as Prisma.InputJsonValue,
        metadata: metadata ? (metadata as unknown as Prisma.InputJsonValue) : undefined,
        ownerWallet,
      },
    });

    return NextResponse.json(
      { pipeline: serializeDecimals(pipeline) },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/pipelines]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
