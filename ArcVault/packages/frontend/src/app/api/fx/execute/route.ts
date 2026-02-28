import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStableFXAdapter } from "@/services/index";
import { fxExecuteSchema, serializeDecimals } from "@/lib/validations/api";

// POST /api/fx/execute — execute a previously quoted FX swap
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = fxExecuteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { quoteId } = parsed.data;
    console.log(`[POST /api/fx/execute] Executing swap for quoteId: ${quoteId}`);

    // Look up the quote from DB — gracefully handle DB being offline
    let fxQuote: {
      id: string;
      fromCurrency: string;
      toCurrency: string;
      fromAmount: unknown;
      toAmount: unknown;
      rate: unknown;
      status: string;
      expiresAt: Date;
    } | null = null;
    let dbAvailable = true;

    try {
      fxQuote = await prisma.fXQuote.findFirst({
        where: { id: quoteId },
      });
    } catch (dbError) {
      console.warn("[POST /api/fx/execute] DB unavailable, proceeding without quote validation:", dbError);
      dbAvailable = false;
    }

    console.log(`[POST /api/fx/execute] DB available: ${dbAvailable}, quote found: ${!!fxQuote}`);

    if (dbAvailable && fxQuote) {
      if (fxQuote.status === "EXECUTED") {
        return NextResponse.json(
          { error: "Quote already executed" },
          { status: 409 }
        );
      }

      if (fxQuote.status === "EXPIRED" || new Date() > fxQuote.expiresAt) {
        if (fxQuote.status !== "EXPIRED") {
          await prisma.fXQuote.update({
            where: { id: fxQuote.id },
            data: { status: "EXPIRED" },
          });
        }
        return NextResponse.json(
          { error: "Quote has expired" },
          { status: 410 }
        );
      }
    } else if (dbAvailable && !fxQuote) {
      return NextResponse.json(
        { error: "Quote not found" },
        { status: 404 }
      );
    }
    // If !dbAvailable: skip DB validation, let the adapter handle quote lookup

    // Execute via adapter
    const adapter = getStableFXAdapter();
    console.log(`[POST /api/fx/execute] Adapter: ${adapter.constructor.name}, calling executeSwap(${quoteId})`);
    const result = await adapter.executeSwap(quoteId);
    console.log("[POST /api/fx/execute] Swap result:", result);

    // Persist to DB if available
    const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 5042002);

    if (dbAvailable && fxQuote) {
      console.log("[POST /api/fx/execute] Persisting swap result to DB...");
      try {
        const [updatedQuote] = await prisma.$transaction([
          prisma.fXQuote.update({
            where: { id: fxQuote.id },
            data: {
              status: "EXECUTED",
              txHash: result.txHash,
            },
          }),
          prisma.transaction.create({
            data: {
              type: "FX_SWAP",
              txHash: result.txHash,
              fromAddress: null,
              toAddress: null,
              amount: fxQuote.fromAmount,
              currency: fxQuote.fromCurrency,
              status: result.status === "success" ? "COMPLETED" : "FAILED",
              metadata: {
                fromCurrency: fxQuote.fromCurrency,
                toCurrency: fxQuote.toCurrency,
                fromAmount: fxQuote.fromAmount.toString(),
                toAmount: fxQuote.toAmount.toString(),
                rate: fxQuote.rate.toString(),
              },
              chainId,
            },
          }),
        ]);

        console.log("[POST /api/fx/execute] DB persisted successfully, returning result");
        return NextResponse.json({
          ...serializeDecimals(updatedQuote),
          ...result,
        });
      } catch (dbError) {
        console.warn("[POST /api/fx/execute] DB write failed, returning swap result without persistence:", dbError);
      }
    }

    return NextResponse.json({
      ...result,
      fromAmount: parseFloat(result.fromAmount),
      toAmount: parseFloat(result.toAmount),
    });
  } catch (error) {
    console.error("[POST /api/fx/execute]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
