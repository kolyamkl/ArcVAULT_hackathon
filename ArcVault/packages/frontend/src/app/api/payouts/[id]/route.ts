import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/payouts/[id] — get a single payout by ID
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { default: prisma } = await import("@/lib/prisma");
    const { serializeDecimals } = await import("@/lib/validations/api");

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
