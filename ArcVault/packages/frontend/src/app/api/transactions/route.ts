import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  transactionsQuerySchema,
  parsePagination,
  serializeDecimals,
} from "@/lib/validations/api";

// GET /api/transactions — list transactions with optional filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    // Extract filter params
    const raw = {
      type: searchParams.get("type") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    };

    const parsed = transactionsQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { type, status, from: fromDate, to: toDate } = parsed.data;
    const { page, limit, skip, order } = parsePagination(searchParams);

    // Build where clause
    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (status) where.status = status;

    if (fromDate || toDate) {
      const createdAtFilter: Record<string, Date> = {};
      if (fromDate) createdAtFilter.gte = new Date(fromDate);
      if (toDate) createdAtFilter.lte = new Date(toDate);
      where.createdAt = createdAtFilter;
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
      transactions: transactions.map(serializeDecimals),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[GET /api/transactions]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
