import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parsePagination, serializeDecimals } from "@/lib/validations/api";

export const dynamic = "force-dynamic";

// GET /api/fx/history — list FX quotes with pagination
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const { page, limit, skip } = parsePagination(searchParams);

    const [quotes, total] = await Promise.all([
      prisma.fXQuote.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.fXQuote.count(),
    ]);

    return NextResponse.json({
      quotes: quotes.map(serializeDecimals),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[GET /api/fx/history]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
