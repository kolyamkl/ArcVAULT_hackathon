import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { serializeDecimals } from "@/lib/validations/api";

// GET /api/payouts/[id] — get a single payout by ID
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const payout = await prisma.payout.findUnique({ where: { id } });

    if (!payout) {
      return NextResponse.json(
        { error: "Payout not found" },
        { status: 404 }
      );
    }

    // Find related transactions
    const transactions = payout.txHash
      ? await prisma.transaction.findMany({ where: { txHash: payout.txHash } })
      : [];

    return NextResponse.json({
      payout: {
        ...serializeDecimals(payout),
        transactions: transactions.map(serializeDecimals),
      },
    });
  } catch (error) {
    console.error("[GET /api/payouts/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
