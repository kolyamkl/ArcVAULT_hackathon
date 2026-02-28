import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { createPayoutSchema, parsePagination, serializeDecimals } from "@/lib/validations/api";

// GET /api/payouts — list payouts with pagination & optional status filter
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const { page, limit, skip, order } = parsePagination(searchParams);
    const status = searchParams.get("status") ?? undefined;

    const where = status ? { status } : {};

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { createdAt: order },
        skip,
        take: limit,
      }),
      prisma.payout.count({ where }),
    ]);

    return NextResponse.json({
      payouts: payouts.map(serializeDecimals),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[GET /api/payouts]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/payouts — create a single payout
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createPayoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { recipient, amount, sourceCurrency, targetCurrency, reference } =
      parsed.data;

    // Generate mock on-chain ID and tx hash
    const onChainId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    const txHash = `0x${randomUUID().replace(/-/g, "")}${"0".repeat(32)}`.slice(
      0,
      66
    );

    // Create payout and corresponding transaction atomically
    const [payout] = await prisma.$transaction([
      prisma.payout.create({
        data: {
          onChainId,
          recipient,
          amount,
          sourceCurrency,
          targetCurrency,
          reference: reference ?? null,
          status: "PENDING",
          txHash,
        },
      }),
      prisma.transaction.create({
        data: {
          type: "PAYOUT",
          txHash,
          fromAddress: null,
          toAddress: recipient,
          amount,
          currency: sourceCurrency,
          status: "PENDING",
          metadata: { reference, targetCurrency },
          chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 5042002),
        },
      }),
    ]);

    return NextResponse.json(serializeDecimals(payout), { status: 201 });
  } catch (error) {
    console.error("[POST /api/payouts]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
