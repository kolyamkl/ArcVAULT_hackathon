import { randomUUID } from "crypto";
import type { IStableFXAdapter, FXQuoteResult, SwapResult, CurrencyPair } from "@/types/integrations";

// ---------------------------------------------------------------------------
// Circle StableFX API adapter
// Docs: https://developers.circle.com/stablefx
// Base: https://api.circle.com/v1/exchange/stablefx
// Auth: Bearer <API_KEY> (format PREFIX:ID:SECRET)
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 10_000;

export class RealStableFXAdapter implements IStableFXAdapter {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    const url = process.env.STABLEFX_API_URL;
    const key = process.env.STABLEFX_API_KEY;
    if (!url || !key) {
      throw new Error(
        "StableFX requires STABLEFX_API_URL and STABLEFX_API_KEY environment variables",
      );
    }
    this.baseUrl = url.replace(/\/+$/, "");
    this.apiKey = key;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`StableFX API error ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  async getSupportedPairs(): Promise<CurrencyPair[]> {
    // StableFX currently supports USDC <-> EURC
    return [
      { from: "USDC", to: "EURC", rate: 0, spread: 0 },
      { from: "EURC", to: "USDC", rate: 0, spread: 0 },
    ];
  }

  async getQuote(from: string, to: string, amount: bigint): Promise<FXQuoteResult> {
    // Amount in human-readable decimal (6 decimals for stablecoins)
    const decimalAmount = (Number(amount) / 1e6).toFixed(6);

    const quote = await this.request<{
      id: string;
      rate: number;
      from: { currency: string; amount: string };
      to: { currency: string; amount: string };
      createdAt: string;
      expiresAt: string;
      fee: string;
    }>("/v1/exchange/stablefx/quotes", {
      method: "POST",
      body: JSON.stringify({
        from: { currency: from, amount: decimalAmount },
        to: { currency: to },
        tenor: "instant",
      }),
    });

    return {
      quoteId: quote.id,
      fromCurrency: quote.from.currency,
      toCurrency: quote.to.currency,
      fromAmount: quote.from.amount,
      toAmount: quote.to.amount,
      rate: quote.rate,
      spread: parseFloat(quote.fee) || 0,
      expiresAt: new Date(quote.expiresAt),
    };
  }

  async executeSwap(quoteId: string): Promise<SwapResult> {
    // Create trade from accepted quote
    const trade = await this.request<{
      id: string;
      status: string;
      rate: number;
      from: { currency: string; amount: string };
      to: { currency: string; amount: string };
      settlementTransactionHash: string | null;
    }>("/v1/exchange/stablefx/trades", {
      method: "POST",
      body: JSON.stringify({
        idempotencyKey: randomUUID(),
        quoteId,
      }),
    });

    return {
      txHash: trade.settlementTransactionHash ?? trade.id,
      fromAmount: trade.from.amount,
      toAmount: trade.to.amount,
      rate: trade.rate,
      status: trade.status === "breached" || trade.status === "breaching"
        ? "failed"
        : "success",
    };
  }
}
