import { randomUUID } from "crypto";
import type {
  IStableFXAdapter,
  FXQuoteResult,
  SwapResult,
  CurrencyPair,
} from "@/types/integrations";

// ---------------------------------------------------------------------------
// Circle StableFX API adapter — full 4-part trade flow
// Docs: https://developers.circle.com/stablefx
// Base: https://api.circle.com/v1/exchange/stablefx
// Auth: Bearer <API_KEY> (format PREFIX:ID:SECRET)
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;

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
    return [
      { from: "USDC", to: "EURC", rate: 0, spread: 0 },
      { from: "EURC", to: "USDC", rate: 0, spread: 0 },
    ];
  }

  async getQuote(
    from: string,
    to: string,
    amount: bigint,
  ): Promise<FXQuoteResult> {
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
    const { getDeployerAccount } = await import("@/lib/viem-server");
    const { createWalletClient, http } = await import("viem");
    const { arcTestnet } = await import("@/lib/chains");

    const account = getDeployerAccount();
    const walletClient = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http(),
    });

    // Step 1: Create trade from accepted quote
    const trade = await this.request<{
      id: string;
      status: string;
      rate: number;
      from: { currency: string; amount: string };
      to: { currency: string; amount: string };
    }>("/v1/exchange/stablefx/trades", {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: randomUUID(), quoteId }),
    });

    const tradeId = trade.id;

    // Step 2: Get presign data (EIP-712 typed data for taker signature)
    const presign = await this.request<{
      typedData: {
        domain: Record<string, unknown>;
        types: Record<string, Array<{ name: string; type: string }>>;
        primaryType: string;
        message: Record<string, unknown>;
      };
    }>(`/v1/exchange/stablefx/signatures/presign/taker/${tradeId}`);

    // Step 3: Sign the EIP-712 typed data with deployer wallet
    const signature = await walletClient.signTypedData({
      domain: presign.typedData.domain as Parameters<
        typeof walletClient.signTypedData
      >[0]["domain"],
      types: presign.typedData.types as Parameters<
        typeof walletClient.signTypedData
      >[0]["types"],
      primaryType: presign.typedData.primaryType,
      message: presign.typedData.message,
    });

    // Step 4: Submit taker signature
    await this.request("/v1/exchange/stablefx/signatures", {
      method: "POST",
      body: JSON.stringify({
        tradeId,
        role: "taker",
        signature,
        signerAddress: account.address,
      }),
    });

    // Step 5: Poll for pending_settlement
    await this.pollTradeStatus(tradeId, ["pending_settlement", "completed", "taker_funded"]);

    // Step 6: Get funding presign data
    const fundingPresign = await this.request<{
      typedData: {
        domain: Record<string, unknown>;
        types: Record<string, Array<{ name: string; type: string }>>;
        primaryType: string;
        message: Record<string, unknown>;
      };
    }>("/v1/exchange/stablefx/signatures/funding/presign", {
      method: "POST",
      body: JSON.stringify({ tradeId }),
    });

    // Step 7: Sign funding EIP-712 data
    const fundingSignature = await walletClient.signTypedData({
      domain: fundingPresign.typedData.domain as Parameters<
        typeof walletClient.signTypedData
      >[0]["domain"],
      types: fundingPresign.typedData.types as Parameters<
        typeof walletClient.signTypedData
      >[0]["types"],
      primaryType: fundingPresign.typedData.primaryType,
      message: fundingPresign.typedData.message,
    });

    // Step 8: Submit funding
    await this.request("/v1/exchange/stablefx/fund", {
      method: "POST",
      body: JSON.stringify({
        tradeId,
        signature: fundingSignature,
        signerAddress: account.address,
      }),
    });

    // Step 9: Poll for completed / taker_funded
    const finalTrade = await this.pollTradeStatus(tradeId, [
      "completed",
      "taker_funded",
    ]);

    return {
      txHash: finalTrade.settlementTransactionHash ?? tradeId,
      fromAmount: trade.from.amount,
      toAmount: trade.to.amount,
      rate: trade.rate,
      status: "success",
    };
  }

  private async pollTradeStatus(
    tradeId: string,
    targetStatuses: string[],
  ): Promise<{ status: string; settlementTransactionHash: string | null }> {
    const deadline = Date.now() + TIMEOUT_MS;

    while (Date.now() < deadline) {
      const result = await this.request<{
        status: string;
        settlementTransactionHash: string | null;
      }>(`/v1/exchange/stablefx/trades/${tradeId}`);

      if (targetStatuses.includes(result.status)) {
        return result;
      }

      if (result.status === "breached" || result.status === "breaching") {
        throw new Error(`Trade ${tradeId} failed with status: ${result.status}`);
      }

      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    throw new Error(
      `Trade ${tradeId} did not reach ${targetStatuses.join("/")} within ${TIMEOUT_MS / 1000}s`,
    );
  }
}

// ---------------------------------------------------------------------------
// Mock adapter — works without Circle API credentials
// ---------------------------------------------------------------------------

const MOCK_RATES: Record<string, number> = {
  "USDC/EURC": 0.92,
  "EURC/USDC": 1.087,
  "USDC/GBPC": 0.79,
  "GBPC/USDC": 1.27,
  "USDC/JPYC": 149.5,
  "JPYC/USDC": 0.00643,
  "USDC/CADC": 1.36,
  "CADC/USDC": 0.735,
};

export class MockStableFXAdapter implements IStableFXAdapter {
  private quotes = new Map<
    string,
    FXQuoteResult & { expired: boolean }
  >();

  async getSupportedPairs(): Promise<CurrencyPair[]> {
    return Object.entries(MOCK_RATES).map(([pair, rate]) => {
      const [from, to] = pair.split("/");
      return { from, to, rate, spread: 0.001 };
    });
  }

  async getQuote(
    from: string,
    to: string,
    amount: bigint,
  ): Promise<FXQuoteResult> {
    const key = `${from}/${to}`;
    const baseRate = MOCK_RATES[key];
    if (!baseRate) {
      throw new Error(`Unsupported pair: ${key}`);
    }

    // Add small random spread (±0.3%)
    const spread = (Math.random() - 0.5) * 0.006;
    const rate = baseRate * (1 + spread);

    const decimalFrom = (Number(amount) / 1e6).toFixed(6);
    const decimalTo = ((Number(amount) / 1e6) * rate).toFixed(6);

    const quoteId = randomUUID();
    const expiresAt = new Date(Date.now() + 30_000); // 30s expiry

    const result: FXQuoteResult = {
      quoteId,
      fromCurrency: from,
      toCurrency: to,
      fromAmount: decimalFrom,
      toAmount: decimalTo,
      rate,
      spread: 0.001,
      expiresAt,
    };

    this.quotes.set(quoteId, { ...result, expired: false });

    // Expire quote after 30s
    setTimeout(() => {
      const q = this.quotes.get(quoteId);
      if (q) q.expired = true;
    }, 30_000);

    return result;
  }

  async executeSwap(quoteId: string): Promise<SwapResult> {
    const quote = this.quotes.get(quoteId);
    if (!quote) {
      throw new Error(`Quote not found: ${quoteId}`);
    }
    if (quote.expired) {
      throw new Error(`Quote expired: ${quoteId}`);
    }

    // Simulate 1-3s processing delay
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));

    // Clean up used quote
    this.quotes.delete(quoteId);

    // Generate fake tx hash
    const txHash = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("")}`;

    return {
      txHash,
      fromAmount: quote.fromAmount,
      toAmount: quote.toAmount,
      rate: quote.rate,
      status: "success",
    };
  }
}
