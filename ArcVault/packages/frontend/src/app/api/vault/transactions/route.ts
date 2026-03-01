import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["DEPOSIT", "WITHDRAW", "SWEEP", "REDEEM"];

// POST /api/vault/transactions — record a vault transaction after on-chain confirmation
export async function POST(req: NextRequest) {
  try {
    const { default: prisma } = await import("@/lib/prisma");
    const body = await req.json();

    const { type, txHash, amount, currency, chainId, blockNumber, fromAddress, toAddress } = body;

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (!txHash) {
      return NextResponse.json({ error: "txHash is required" }, { status: 400 });
    }

    if (amount === undefined || amount === null) {
      return NextResponse.json({ error: "amount is required" }, { status: 400 });
    }

    const transaction = await prisma.transaction.upsert({
      where: { txHash },
      create: {
        type,
        txHash,
        amount,
        currency: currency ?? "USDC",
        status: "COMPLETED",
        chainId: chainId ?? 5042002,
        blockNumber: blockNumber ?? null,
        fromAddress: fromAddress ?? null,
        toAddress: toAddress ?? null,
      },
      update: {},
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/vault/transactions]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
