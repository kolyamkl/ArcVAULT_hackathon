import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VAULT_EVENT_TYPES = ["SWEEP", "REDEEM", "DEPOSIT", "WITHDRAW"];

// GET /api/vault/history — vault-related transactions with optional type filter
export async function GET(req: NextRequest) {
  try {
    const { default: prisma } = await import("@/lib/prisma");
    const { parsePagination, serializeDecimals } = await import("@/lib/validations/api");

    const { searchParams } = req.nextUrl;
    const { page, limit, skip, order } = parsePagination(searchParams);
    const typeFilter = searchParams.get("type") ?? undefined;

    const where: Record<string, unknown> = {
      type: { in: VAULT_EVENT_TYPES },
    };

    // If a specific type is requested and it's a valid vault event type, narrow the filter
    if (typeFilter && VAULT_EVENT_TYPES.includes(typeFilter)) {
      where.type = typeFilter;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: order },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return NextResponse.json({
      events: transactions.map(serializeDecimals),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[GET /api/vault/history]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
