import { z } from "zod";

// ── Ethereum address pattern ────────────────────────────────────────
const ethAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

const numericString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Amount must be a numeric string");

// ── Payouts ─────────────────────────────────────────────────────────

export const createPayoutSchema = z.object({
  recipient: ethAddress,
  amount: numericString,
  sourceCurrency: z.string().min(1),
  targetCurrency: z.string().min(1),
  reference: z.string().max(256).optional(),
});

export const batchPayoutSchema = z.object({
  payouts: z
    .array(createPayoutSchema)
    .min(1, "At least one payout required")
    .max(50, "Max 50 payouts per batch"),
});

// ── FX ──────────────────────────────────────────────────────────────

export const fxQuoteQuerySchema = z.object({
  from: z.string().min(1, "from currency required"),
  to: z.string().min(1, "to currency required"),
  amount: numericString,
});

export const fxExecuteSchema = z.object({
  quoteId: z.string().uuid("Invalid quote ID"),
});

// ── Pipelines ───────────────────────────────────────────────────────

const reactFlowNodeSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.unknown()),
  deletable: z.boolean().optional(),
}).passthrough();

const reactFlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: z.string().optional(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
}).passthrough();

export const createPipelineSchema = z.object({
  name: z.string().min(1).max(128),
  nodes: z.array(reactFlowNodeSchema).min(1),
  edges: z.array(reactFlowEdgeSchema),
  metadata: z.record(z.unknown()).optional(),
  ownerWallet: ethAddress,
});

export const updatePipelineSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  nodes: z.array(reactFlowNodeSchema).optional(),
  edges: z.array(reactFlowEdgeSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const executePipelineSchema = z.object({
  triggeredBy: ethAddress,
});

// ── Transactions ────────────────────────────────────────────────────

export const transactionsQuerySchema = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// ── Pagination helper ───────────────────────────────────────────────

const ALLOWED_SORT_FIELDS = ["createdAt", "updatedAt", "amount", "status"] as const;

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const rawSort = searchParams.get("sort") ?? "createdAt";
  const sort = ALLOWED_SORT_FIELDS.includes(rawSort as any) ? rawSort : "createdAt";
  const order = searchParams.get("order") === "asc" ? ("asc" as const) : ("desc" as const);
  return { page, limit, sort, order, skip: (page - 1) * limit };
}

// ── Decimal serialization helper ────────────────────────────────────

/**
 * Recursively converts Prisma Decimal fields (objects with a toNumber method)
 * into plain numbers for JSON serialization.
 */
export function serializeDecimals<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "object" && "toNumber" in (obj as Record<string, unknown>)) {
    return (obj as unknown as { toNumber(): number }).toNumber() as unknown as T;
  }
  if (obj instanceof Date) {
    return obj.toISOString() as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeDecimals) as unknown as T;
  }
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = serializeDecimals(value);
    }
    return result as T;
  }
  return obj;
}
