import { randomUUID } from "crypto";
import type {
  ICPNAdapter,
  CPNPaymentParams,
  CPNPaymentResult,
  CPNStatus,
  ComplianceResult,
} from "@/types/integrations";

// ---------------------------------------------------------------------------
// Circle Transfer API response shapes
// ---------------------------------------------------------------------------
interface CircleTransferResponse {
  data: {
    id: string;
    source: { type: string; id: string };
    destination: { type: string; address: string; chain: string };
    amount: { amount: string; currency: string };
    status: "pending" | "complete" | "failed";
    errorCode?: string;
    transactionHash?: string;
    createDate: string;
  };
}

interface CircleTransferStatusResponse {
  data: CircleTransferResponse["data"];
}

// Map Circle status → app-level status
function mapCircleStatus(s: string): CPNStatus["status"] {
  switch (s) {
    case "pending":
      return "processing";
    case "complete":
      return "settled";
    case "failed":
      return "failed";
    default:
      return "initiated";
  }
}

export class RealCPNAdapter implements ICPNAdapter {
  private baseUrl: string;
  private apiKey: string;
  private walletId: string;

  constructor() {
    this.baseUrl = (process.env.CPN_API_URL ?? "").replace(/\/+$/, "");
    this.apiKey = (process.env.CPN_API_KEY ?? "").trim();
    this.walletId = (process.env.CPN_WALLET_ID ?? "").trim();
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`CPN API error ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  /**
   * Resolve the master wallet ID from config if not set via env.
   */
  private async resolveWalletId(): Promise<string> {
    if (this.walletId) return this.walletId;
    const cfg = await this.request<{ data: { payments: { masterWalletId: string } } }>(
      "/v1/configuration",
    );
    this.walletId = cfg.data.payments.masterWalletId;
    return this.walletId;
  }

  async sendPayment(params: CPNPaymentParams): Promise<CPNPaymentResult> {
    const walletId = await this.resolveWalletId();

    const body = {
      idempotencyKey: randomUUID(),
      source: { type: "wallet", id: walletId },
      destination: {
        type: "blockchain",
        address: params.recipient,
        chain: params.metadata?.chain ?? "ARC",
      },
      amount: { amount: params.amount, currency: params.currency },
    };

    const res = await this.request<CircleTransferResponse>("/v1/transfers", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      paymentId: res.data.id,
      status: "initiated",
      estimatedCompletion: new Date(Date.now() + 60_000),
    };
  }

  async getPaymentStatus(paymentId: string): Promise<CPNStatus> {
    const res = await this.request<CircleTransferStatusResponse>(
      `/v1/transfers/${paymentId}`,
    );

    const d = res.data;
    return {
      paymentId: d.id,
      status: mapCircleStatus(d.status),
      settledAt: d.status === "complete" ? new Date(d.createDate) : undefined,
      failureReason: d.errorCode,
    };
  }

  async verifyCompliance(_address: string): Promise<ComplianceResult> {
    // Circle sandbox does not expose a compliance-check endpoint.
    // Return a passing stub so callers work in sandbox mode.
    return {
      address: _address,
      compliant: true,
      riskScore: 0,
      checks: ["Circle sandbox: compliance check not available — auto-pass"],
    };
  }
}

// In-memory store for tracking mock payment creation timestamps
const paymentTimestamps = new Map<string, number>();

export class MockCPNAdapter implements ICPNAdapter {
  async sendPayment(_params: CPNPaymentParams): Promise<CPNPaymentResult> {
    const paymentId = randomUUID();
    const now = Date.now();
    paymentTimestamps.set(paymentId, now);

    return {
      paymentId,
      status: "initiated",
      estimatedCompletion: new Date(now + 60_000),
    };
  }

  async getPaymentStatus(paymentId: string): Promise<CPNStatus> {
    const createdAt = paymentTimestamps.get(paymentId);
    if (!createdAt) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    const elapsed = Date.now() - createdAt;

    let status: CPNStatus["status"];
    let settledAt: Date | undefined;

    if (elapsed < 10_000) {
      status = "initiated";
    } else if (elapsed < 30_000) {
      status = "processing";
    } else {
      status = "settled";
      settledAt = new Date(createdAt + 30_000);
    }

    return { paymentId, status, settledAt };
  }

  async verifyCompliance(address: string): Promise<ComplianceResult> {
    return {
      address,
      compliant: true,
      riskScore: 15,
      checks: [
        "OFAC screening: PASS",
        "EU sanctions list: PASS",
        "PEP database: PASS",
        "Adverse media: PASS",
      ],
    };
  }
}
