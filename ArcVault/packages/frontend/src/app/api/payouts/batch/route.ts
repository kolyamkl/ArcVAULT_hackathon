import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { batchPayoutSchema, serializeDecimals } from "@/lib/validations/api";

export const dynamic = "force-dynamic";

// POST /api/payouts/batch — create multiple payouts atomically
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = batchPayoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { payouts: payoutInputs } = parsed.data;
    const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 5042002);
    const baseOnChainId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

    // Build prisma operations for the batch
    const operations = payoutInputs.flatMap((input, idx) => {
      const txHash = `0x${randomUUID().replace(/-/g, "")}${"0".repeat(32)}`.slice(0, 66);
      const onChainId = baseOnChainId + idx;

      return [
        prisma.payout.create({
          data: {
            onChainId,
            recipient: input.recipient,
            amount: input.amount,
            sourceCurrency: input.sourceCurrency,
            targetCurrency: input.targetCurrency,
            reference: input.reference ?? null,
            status: "PENDING",
            txHash,
          },
        }),
        prisma.transaction.create({
          data: {
            type: "PAYOUT",
            txHash,
            fromAddress: null,
            toAddress: input.recipient,
            amount: input.amount,
            currency: input.sourceCurrency,
            status: "PENDING",
            metadata: {
              reference: input.reference,
              targetCurrency: input.targetCurrency,
              batchIndex: idx,
            },
            chainId,
          },
        }),
      ];
    });

    const results = await prisma.$transaction(operations);

    // Extract only the Payout records (every other result, starting at index 0)
    const createdPayouts = results.filter((_, i) => i % 2 === 0);

    return NextResponse.json({
      payouts: createdPayouts.map(serializeDecimals),
      summary: {
        total: createdPayouts.length,
        successful: createdPayouts.length,
        failed: 0,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/payouts/batch]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
