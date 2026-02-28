import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStableFXAdapter } from "@/services/index";
import { fxQuoteQuerySchema, serializeDecimals } from "@/lib/validations/api";

// GET /api/fx/quote — request a new FX quote
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    // Support both ?from=X&to=Y and ?pair=X/Y formats
    let rawFrom = searchParams.get("from") ?? "";
    let rawTo = searchParams.get("to") ?? "";
    const pair = searchParams.get("pair") ?? "";
    if (!rawFrom && !rawTo && pair.includes("/")) {
      [rawFrom, rawTo] = pair.split("/");
    }

    const raw = { from: rawFrom, to: rawTo, amount: searchParams.get("amount") ?? "" };

    const parsed = fxQuoteQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { from, to, amount } = parsed.data;

    // Get live quote from adapter
    const adapter = getStableFXAdapter();
    const quote = await adapter.getQuote(
      from,
      to,
      BigInt(Math.round(parseFloat(amount) * 1e6))
    );

    const quotePayload = {
      id: quote.quoteId,
      fromCurrency: quote.fromCurrency,
      toCurrency: quote.toCurrency,
      fromAmount: quote.fromAmount,
      toAmount: quote.toAmount,
      rate: quote.rate,
      spread: quote.spread,
      expiresAt: quote.expiresAt.toISOString(),
      status: "PENDING",
    };

    // Persist the quote in the database for audit trail
    try {
      const fxQuote = await prisma.fXQuote.create({
        data: {
          id: quote.quoteId,
          fromCurrency: quote.fromCurrency,
          toCurrency: quote.toCurrency,
          fromAmount: quote.fromAmount,
          toAmount: quote.toAmount,
          rate: quote.rate,
          spread: quote.spread,
          expiresAt: quote.expiresAt,
          status: "PENDING",
        },
      });
      return NextResponse.json(serializeDecimals(fxQuote));
    } catch (dbError) {
      console.warn("[GET /api/fx/quote] DB write failed, returning quote without persistence:", dbError);
      return NextResponse.json(quotePayload);
    }
  } catch (error) {
    console.error("[GET /api/fx/quote]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
