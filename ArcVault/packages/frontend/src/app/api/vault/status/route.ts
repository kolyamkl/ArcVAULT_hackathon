import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { serializeDecimals } from "@/lib/validations/api";

export const dynamic = "force-dynamic";

// GET /api/vault/status — latest vault snapshot
export async function GET() {
  try {
    const snapshot = await prisma.vaultSnapshot.findFirst({
      orderBy: { timestamp: "desc" },
    });

    if (!snapshot) {
      return NextResponse.json({
        liquidUSDC: 0,
        usycBalance: 0,
        totalValue: 0,
        yieldAccrued: 0,
        apy: 0,
        threshold: 0,
      });
    }

    return NextResponse.json(serializeDecimals(snapshot));
  } catch (error) {
    console.error("[GET /api/vault/status]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
