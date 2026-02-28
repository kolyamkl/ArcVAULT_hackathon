// ── Common ───────────────────────────────────────────────────────────

export type TxResult = {
  txHash: string;
  blockNumber: number;
  status: "success" | "failed";
};

// ── USYC ─────────────────────────────────────────────────────────────

export type YieldDataPoint = {
  timestamp: Date;
  apy: number;
  totalValue: number;
};

export interface IUSYCAdapter {
  deposit(amount: bigint): Promise<TxResult>;
  redeem(amount: bigint): Promise<TxResult>;
  getBalance(address: string): Promise<bigint>;
  getCurrentRate(): Promise<number>;
  getYieldHistory(days: number): Promise<YieldDataPoint[]>;
}

// ── StableFX ─────────────────────────────────────────────────────────

export type FXQuoteResult = {
  quoteId: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  toAmount: string;
  rate: number;
  spread: number;
  expiresAt: Date;
};

export type SwapResult = {
  txHash: string;
  fromAmount: string;
  toAmount: string;
  rate: number;
  status: "success" | "failed";
};

export type CurrencyPair = {
  from: string;
  to: string;
  rate: number;
  spread: number;
};

export interface IStableFXAdapter {
  getQuote(from: string, to: string, amount: bigint): Promise<FXQuoteResult>;
  executeSwap(quoteId: string): Promise<SwapResult>;
  getSupportedPairs(): Promise<CurrencyPair[]>;
}

// ── CPN ──────────────────────────────────────────────────────────────

export type CPNPaymentParams = {
  recipient: string;
  amount: string;
  currency: string;
  reference: string;
  metadata?: Record<string, string>;
};

export type CPNPaymentResult = {
  paymentId: string;
  status: "initiated" | "processing" | "completed" | "failed";
  estimatedCompletion: Date;
};

export type CPNStatus = {
  paymentId: string;
  status: "initiated" | "processing" | "settled" | "failed";
  settledAt?: Date;
  failureReason?: string;
};

export type ComplianceResult = {
  address: string;
  compliant: boolean;
  riskScore: number;
  checks: string[];
};

export interface ICPNAdapter {
  sendPayment(params: CPNPaymentParams): Promise<CPNPaymentResult>;
  getPaymentStatus(paymentId: string): Promise<CPNStatus>;
  verifyCompliance(address: string): Promise<ComplianceResult>;
}
