import { parseUnits, decodeEventLog, pad, toHex } from 'viem';
import prisma from './prisma';
import { getPublicClient, getWalletClient } from './viem-server';
import { PayoutRouterABI, TreasuryVaultABI } from './contracts';
import {
  PAYOUT_ROUTER_ADDRESS,
  TREASURY_VAULT_ADDRESS,
  USDC_ADDRESS,
} from './contracts';
import { getStableFXAdapter } from '@/services';
import type { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StepStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped' | 'awaiting_approval' | 'paused';

export interface ExecutionStep {
  nodeId: string;
  nodeType: string;
  status: StepStatus;
  payoutId?: number;
  txHash?: string;
  amount?: number;
  currency?: string;
  fxQuoteId?: string;
  fxRate?: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  approvalCount?: number;
  approvalThreshold?: number;
  delayUntil?: string;
  conditionResult?: boolean;
}

export interface ExecutionLog {
  timestamp: string;
  message: string;
  status: 'info' | 'success' | 'error' | 'pending';
  nodeId?: string;
}

interface PipelineNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  sourceHandle?: string;
}

interface ExecutionContext {
  steps: ExecutionStep[];
  logs: ExecutionLog[];
  failedNodeIds: Set<string>;
  skippedNodeIds: Set<string>;
  totalCost: number;
  fxCost: number;
  edges: PipelineEdge[];
  nodeMap: Map<string, PipelineNode>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(ctx: ExecutionContext, message: string, status: ExecutionLog['status'], nodeId?: string) {
  const ts = new Date().toISOString();
  console.log(`[Pipeline] [${status.toUpperCase()}] ${nodeId ? `[${nodeId}] ` : ''}${message}`);
  ctx.logs.push({
    timestamp: ts,
    message,
    status,
    nodeId,
  });
}

function findStep(ctx: ExecutionContext, nodeId: string): ExecutionStep | undefined {
  return ctx.steps.find((s) => s.nodeId === nodeId);
}

function updateStep(ctx: ExecutionContext, nodeId: string, updates: Partial<ExecutionStep>) {
  const step = findStep(ctx, nodeId);
  if (step) Object.assign(step, updates);
}

/**
 * Persist the current execution state to DB so the polling endpoint can serve it.
 */
async function persistProgress(executionId: string, ctx: ExecutionContext) {
  await prisma.pipelineExecution.update({
    where: { id: executionId },
    data: {
      results: {
        steps: ctx.steps,
        logs: ctx.logs,
      } as unknown as Prisma.InputJsonValue,
      totalCost: ctx.totalCost.toFixed(2),
      fxCost: ctx.fxCost.toFixed(2),
    },
  });
}

// ---------------------------------------------------------------------------
// Topological sort
// ---------------------------------------------------------------------------

/**
 * BFS from treasury source nodes. Returns execution order respecting edge dependencies.
 */
export function topologicalSort(nodes: PipelineNode[], edges: PipelineEdge[]): PipelineNode[] {
  const adjList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const nodeMap = new Map<string, PipelineNode>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    adjList.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    adjList.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Start from nodes with no incoming edges (typically treasurySource)
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) queue.push(nodeId);
  }

  const order: PipelineNode[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = nodeMap.get(current);
    if (node) order.push(node);

    for (const neighbor of adjList.get(current) || []) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  return order;
}

// ---------------------------------------------------------------------------
// Node executors
// ---------------------------------------------------------------------------

async function executeTreasurySource(
  node: PipelineNode,
  ctx: ExecutionContext,
): Promise<void> {
  log(ctx, 'Verifying treasury balance...', 'pending', node.id);
  updateStep(ctx, node.id, { status: 'processing', startedAt: new Date().toISOString() });

  const publicClient = getPublicClient();
  const balance = await publicClient.readContract({
    address: TREASURY_VAULT_ADDRESS,
    abi: TreasuryVaultABI,
    functionName: 'getLiquidBalance',
  }) as bigint;

  const balanceUsdc = Number(balance) / 1e6;
  log(ctx, `Treasury liquid balance: $${balanceUsdc.toLocaleString()}`, 'info', node.id);

  updateStep(ctx, node.id, { status: 'completed', completedAt: new Date().toISOString(), amount: balanceUsdc });
  log(ctx, 'Treasury balance verified', 'success', node.id);
}

async function executeDepartment(
  node: PipelineNode,
  ctx: ExecutionContext,
): Promise<void> {
  const name = (node.data.name as string) || 'Department';
  log(ctx, `Processing ${name}...`, 'pending', node.id);
  updateStep(ctx, node.id, { status: 'processing', startedAt: new Date().toISOString() });

  // Departments are pass-through routing nodes — just mark as completed
  await new Promise((r) => setTimeout(r, 300));

  updateStep(ctx, node.id, { status: 'completed', completedAt: new Date().toISOString() });
  log(ctx, `${name} processed`, 'success', node.id);
}

async function executeFXConversion(
  node: PipelineNode,
  ctx: ExecutionContext,
): Promise<void> {
  const fromCurrency = (node.data.fromCurrency as string) || 'USDC';
  const toCurrency = (node.data.toCurrency as string) || 'EURC';

  // FX nodes don't carry an amount — compute it by summing downstream recipients
  const downstreamEdges = ctx.edges.filter((e) => e.source === node.id);
  let amount = 0;
  for (const edge of downstreamEdges) {
    const child = ctx.nodeMap.get(edge.target);
    if (child) {
      amount += Number(child.data.amount || 0);
    }
  }

  if (amount <= 0) {
    updateStep(ctx, node.id, {
      status: 'failed',
      error: 'No downstream recipients with amounts found',
      completedAt: new Date().toISOString(),
    });
    log(ctx, `FX conversion skipped — no amounts to convert`, 'error', node.id);
    ctx.failedNodeIds.add(node.id);
    return;
  }

  log(ctx, `FX conversion: ${amount} ${fromCurrency} -> ${toCurrency}`, 'pending', node.id);
  updateStep(ctx, node.id, { status: 'processing', startedAt: new Date().toISOString() });

  const fxAdapter = getStableFXAdapter();
  const amountBigint = BigInt(Math.round(amount * 1e6));
  console.log(`[Pipeline][FX] Adapter: ${fxAdapter.constructor.name}, amount: ${amount} ${fromCurrency} -> ${toCurrency} (base=${amountBigint})`);

  // Get quote
  const quote = await fxAdapter.getQuote(fromCurrency, toCurrency, amountBigint);
  console.log(`[Pipeline][FX] Quote received: id=${quote.quoteId}, rate=${quote.rate}, from=${quote.fromAmount}, to=${quote.toAmount}`);

  // Execute swap
  const swapResult = await fxAdapter.executeSwap(quote.quoteId);
  console.log(`[Pipeline][FX] Swap result: txHash=${swapResult.txHash}, status=${swapResult.status}`);

  // Persist FXQuote to DB
  const fxRecord = await prisma.fXQuote.create({
    data: {
      fromCurrency,
      toCurrency,
      fromAmount: quote.fromAmount,
      toAmount: quote.toAmount,
      rate: quote.rate,
      spread: quote.spread,
      expiresAt: quote.expiresAt,
      status: 'EXECUTED',
      txHash: swapResult.txHash,
    },
  });

  // Persist Transaction to DB (upsert to handle re-runs with same txHash)
  await prisma.transaction.upsert({
    where: { txHash: swapResult.txHash },
    create: {
      type: 'FX_SWAP',
      txHash: swapResult.txHash,
      amount: quote.fromAmount,
      currency: fromCurrency,
      status: 'COMPLETED',
      metadata: {
        fxQuoteId: fxRecord.id,
        toCurrency,
        toAmount: quote.toAmount,
        rate: quote.rate,
      },
      chainId: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID) || 1397,
    },
    update: {
      status: 'COMPLETED',
      amount: quote.fromAmount,
    },
  });

  const fxCostEstimate = amount * 0.0005; // ~5 bps
  ctx.fxCost += fxCostEstimate;

  updateStep(ctx, node.id, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    fxQuoteId: fxRecord.id,
    fxRate: quote.rate,
    amount,
    currency: toCurrency,
  });
  log(ctx, `FX conversion complete: rate ${quote.rate.toFixed(4)}`, 'success', node.id);
}

async function executePayoutNode(
  node: PipelineNode,
  ctx: ExecutionContext,
): Promise<void> {
  const name = (node.data.name as string) || 'Recipient';
  const baseAmount = Number(node.data.amount || 0);
  const giftEnabled = Boolean(node.data.giftEnabled);
  const giftAmount = giftEnabled ? Number(node.data.giftAmount || 0) : 0;
  const giftNote = giftEnabled ? (node.data.giftNote as string) || '' : '';
  const amount = baseAmount + giftAmount;
  const currency = (node.data.currency as string) || 'USDC';
  const walletAddress = (node.data.walletAddress as string) || '';

  if (giftAmount > 0) {
    log(ctx, `Sending ${baseAmount} + ${giftAmount} (gift) ${currency} to ${name}...`, 'pending', node.id);
  } else {
    log(ctx, `Sending ${amount} ${currency} to ${name}...`, 'pending', node.id);
  }
  updateStep(ctx, node.id, { status: 'processing', startedAt: new Date().toISOString() });

  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    updateStep(ctx, node.id, {
      status: 'failed',
      error: `Invalid wallet address: ${walletAddress || '(empty)'}`,
      completedAt: new Date().toISOString(),
    });
    log(ctx, `${name}: failed — invalid wallet address`, 'error', node.id);
    ctx.failedNodeIds.add(node.id);
    return;
  }

  const amountWei = parseUnits(amount.toString(), 6); // USDC has 6 decimals
  const paymentRef = pad(toHex(Date.now()), { size: 32 });
  console.log(`[Pipeline][Payout] ${name}: ${amount} ${currency} -> ${walletAddress} (wei=${amountWei})`);

  let txHash: string;
  let onChainPayoutId: number;

  // Call PayoutRouter.executePayout on-chain
  const walletClient = getWalletClient();
  const publicClient = getPublicClient();

  const targetCurrencyAddress = currency === 'USDC'
    ? USDC_ADDRESS
    : (node.data.targetCurrencyAddress as `0x${string}`) || USDC_ADDRESS;

  const hash = await walletClient.writeContract({
    address: PAYOUT_ROUTER_ADDRESS,
    abi: PayoutRouterABI,
    functionName: 'executePayout',
    args: [
      walletAddress as `0x${string}`,
      amountWei,
      targetCurrencyAddress,
      paymentRef,
    ],
  });

  console.log(`[Pipeline][Payout] ${name}: tx sent, hash=${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`[Pipeline][Payout] ${name}: tx confirmed, block=${receipt.blockNumber}`);
  txHash = hash;

  // Decode PayoutCreated event to get onChainPayoutId
  const payoutCreatedLog = receipt.logs.find((l) => {
    try {
      const decoded = decodeEventLog({
        abi: PayoutRouterABI,
        data: l.data,
        topics: l.topics,
      });
      return decoded.eventName === 'PayoutCreated';
    } catch {
      return false;
    }
  });

  if (payoutCreatedLog) {
    const decoded = decodeEventLog({
      abi: PayoutRouterABI,
      data: payoutCreatedLog.data,
      topics: payoutCreatedLog.topics,
    });
    onChainPayoutId = Number((decoded.args as { payoutId: bigint }).payoutId);
  } else {
    onChainPayoutId = Date.now(); // fallback
  }

  // Persist Payout to DB (upsert to handle re-runs / duplicate onChainId)
  await prisma.payout.upsert({
    where: { onChainId: onChainPayoutId },
    create: {
      onChainId: onChainPayoutId,
      recipient: walletAddress,
      amount: amount.toString(),
      sourceCurrency: 'USDC',
      targetCurrency: currency,
      reference: `pipeline-${node.id}`,
      status: 'COMPLETED',
      txHash,
    },
    update: {
      recipient: walletAddress,
      amount: amount.toString(),
      targetCurrency: currency,
      status: 'COMPLETED',
      txHash,
    },
  });

  // Persist Transaction to DB (upsert to handle re-runs with same txHash)
  await prisma.transaction.upsert({
    where: { txHash },
    create: {
      type: 'PAYOUT',
      txHash,
      toAddress: walletAddress,
      amount: amount.toString(),
      currency,
      status: 'COMPLETED',
      metadata: {
        recipientName: name,
        nodeId: node.id,
        onChainPayoutId,
        ...(giftAmount > 0 && { giftAmount, giftNote }),
      },
      chainId: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID) || 1397,
    },
    update: {
      status: 'COMPLETED',
      amount: amount.toString(),
    },
  });

  ctx.totalCost += amount;

  updateStep(ctx, node.id, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    payoutId: onChainPayoutId,
    txHash,
    amount,
    currency,
  });
  log(ctx, `${name}: ${amount} ${currency} sent`, 'success', node.id);
}

// ---------------------------------------------------------------------------
// Approval executor
// ---------------------------------------------------------------------------

async function executeApproval(
  node: PipelineNode,
  ctx: ExecutionContext,
  executionId: string,
): Promise<'continue' | 'awaiting'> {
  const approvers = (node.data.approvers as string[]) || [];
  const threshold = Number(node.data.threshold) || 1;

  log(ctx, `Checking approval gate (${threshold} of ${approvers.length} required)...`, 'pending', node.id);
  updateStep(ctx, node.id, {
    status: 'processing',
    startedAt: new Date().toISOString(),
    approvalThreshold: threshold,
  });

  // Check DB for existing approvals
  const approvals = await prisma.approvalRequest.findMany({
    where: { executionId, nodeId: node.id, status: 'APPROVED' },
  });

  const approvalCount = approvals.length;
  if (approvalCount >= threshold) {
    updateStep(ctx, node.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      approvalCount,
      approvalThreshold: threshold,
    });
    log(ctx, `Approval gate passed (${approvalCount}/${threshold} approvals)`, 'success', node.id);
    return 'continue';
  }

  // Create pending approval requests for approvers who haven't responded
  const existingApprovers = new Set(approvals.map((a) => a.approverAddress));
  for (const addr of approvers) {
    if (!existingApprovers.has(addr)) {
      await prisma.approvalRequest.upsert({
        where: {
          executionId_nodeId_approverAddress: {
            executionId,
            nodeId: node.id,
            approverAddress: addr,
          },
        },
        create: { executionId, nodeId: node.id, approverAddress: addr, status: 'PENDING' },
        update: {},
      });
    }
  }

  updateStep(ctx, node.id, {
    status: 'awaiting_approval',
    approvalCount,
    approvalThreshold: threshold,
  });
  log(ctx, `Awaiting approvals (${approvalCount}/${threshold})`, 'pending', node.id);
  return 'awaiting';
}

// ---------------------------------------------------------------------------
// Condition executor
// ---------------------------------------------------------------------------

async function executeCondition(
  node: PipelineNode,
  ctx: ExecutionContext,
): Promise<'continue'> {
  const field = (node.data.field as string) || 'amount';
  const operator = (node.data.operator as string) || '>';
  const value = node.data.value as string || '0';

  log(ctx, `Evaluating condition: ${field} ${operator} ${value}`, 'pending', node.id);
  updateStep(ctx, node.id, { status: 'processing', startedAt: new Date().toISOString() });

  // Gather upstream data: sum amounts from all parent nodes
  const parentEdges = ctx.edges.filter((e) => e.target === node.id);
  let upstreamAmount = 0;
  let upstreamRecipientCount = 0;

  for (const edge of parentEdges) {
    const parent = ctx.nodeMap.get(edge.source);
    if (parent) {
      upstreamAmount += Number(parent.data.amount || 0);
      // Count downstream recipients from the parent
      const childEdges = ctx.edges.filter((e) => e.source === parent.id);
      upstreamRecipientCount += childEdges.length;
    }
  }

  // Resolve the field value
  let fieldValue: number | string = 0;
  switch (field) {
    case 'amount':
      fieldValue = upstreamAmount;
      break;
    case 'recipientCount':
      fieldValue = upstreamRecipientCount;
      break;
    case 'currency':
      fieldValue = 'USDC';
      break;
    default:
      fieldValue = 0;
  }

  // Evaluate condition
  const numFieldValue = typeof fieldValue === 'string' ? parseFloat(fieldValue) || 0 : fieldValue;
  const numValue = parseFloat(value) || 0;

  let result = false;
  switch (operator) {
    case '>': result = numFieldValue > numValue; break;
    case '<': result = numFieldValue < numValue; break;
    case '>=': result = numFieldValue >= numValue; break;
    case '<=': result = numFieldValue <= numValue; break;
    case '==': result = String(fieldValue) === value; break;
    case '!=': result = String(fieldValue) !== value; break;
  }

  // Mark the untaken branch's descendants as skipped
  const falseHandle = result ? 'false' : 'true';
  const skippedEdges = ctx.edges.filter(
    (e) => e.source === node.id && e.sourceHandle === falseHandle,
  );

  // BFS to find all descendants of the untaken branch
  const queue = skippedEdges.map((e) => e.target);
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    ctx.skippedNodeIds.add(current);
    // Find children of this node
    const children = ctx.edges.filter((e) => e.source === current).map((e) => e.target);
    queue.push(...children);
  }

  await new Promise((r) => setTimeout(r, 300));

  updateStep(ctx, node.id, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    conditionResult: result,
  });
  log(ctx, `Condition evaluated: ${field} (${fieldValue}) ${operator} ${value} → ${result ? 'TRUE' : 'FALSE'}`, 'success', node.id);
  return 'continue';
}

// ---------------------------------------------------------------------------
// Delay executor
// ---------------------------------------------------------------------------

async function executeDelay(
  node: PipelineNode,
  ctx: ExecutionContext,
  executionId: string,
): Promise<'continue' | 'paused'> {
  const delayType = (node.data.delayType as string) || 'duration';
  const durationHours = Number(node.data.durationHours) || 0;
  const durationMinutes = Number(node.data.durationMinutes) || 0;
  const untilDate = (node.data.untilDate as string) || '';

  let resumeAt: Date;
  let description: string;

  if (delayType === 'until' && untilDate) {
    resumeAt = new Date(untilDate);
    description = `until ${resumeAt.toLocaleString()}`;
  } else {
    const totalMs = (durationHours * 3600 + durationMinutes * 60) * 1000;
    resumeAt = new Date(Date.now() + totalMs);
    description = `${durationHours}h ${durationMinutes}m`;
  }

  log(ctx, `Delay node: waiting ${description}`, 'pending', node.id);
  updateStep(ctx, node.id, {
    status: 'processing',
    startedAt: new Date().toISOString(),
    delayUntil: resumeAt.toISOString(),
  });

  // Check if resume time has passed
  if (resumeAt <= new Date()) {
    updateStep(ctx, node.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
    log(ctx, 'Delay completed (time already passed)', 'success', node.id);
    return 'continue';
  }

  // Persist delay schedule
  await prisma.delaySchedule.upsert({
    where: {
      executionId_nodeId: { executionId, nodeId: node.id },
    },
    create: { executionId, nodeId: node.id, resumeAt, status: 'WAITING' },
    update: { resumeAt, status: 'WAITING' },
  });

  updateStep(ctx, node.id, {
    status: 'paused',
    delayUntil: resumeAt.toISOString(),
  });
  log(ctx, `Paused — will resume ${description}`, 'pending', node.id);
  return 'paused';
}

// ---------------------------------------------------------------------------
// Node dispatcher
// ---------------------------------------------------------------------------

async function executeNode(
  node: PipelineNode,
  ctx: ExecutionContext,
  executionId: string,
): Promise<'continue' | 'awaiting' | 'paused'> {
  const nodeType = node.type || (node.data.type as string) || 'unknown';

  switch (nodeType) {
    case 'treasurySource':
      await executeTreasurySource(node, ctx);
      return 'continue';
    case 'department':
      await executeDepartment(node, ctx);
      return 'continue';
    case 'fxConversion':
      await executeFXConversion(node, ctx);
      return 'continue';
    case 'employee':
    case 'contractor':
      await executePayoutNode(node, ctx);
      return 'continue';
    case 'approval':
      return executeApproval(node, ctx, executionId);
    case 'condition':
      return executeCondition(node, ctx);
    case 'delay':
      return executeDelay(node, ctx, executionId);
    default:
      // Unknown node types are passed through
      log(ctx, `Skipping unknown node type: ${nodeType}`, 'info', node.id);
      updateStep(ctx, node.id, { status: 'completed', completedAt: new Date().toISOString() });
      return 'continue';
  }
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Execute a full pipeline graph:
 * 1. Parse nodes/edges and topologically sort
 * 2. For each node in order, execute and persist progress
 * 3. Children of failed nodes are skipped
 * 4. Returns final status
 */
export async function executePipeline(
  pipeline: { id: string; nodes: unknown; edges: unknown },
  executionId: string,
  triggeredBy: string,
): Promise<void> {
  const nodes = pipeline.nodes as PipelineNode[];
  const edges = pipeline.edges as PipelineEdge[];
  console.log(`[Pipeline] Starting execution: pipelineId=${pipeline.id}, executionId=${executionId}, triggeredBy=${triggeredBy}`);
  console.log(`[Pipeline] Nodes: ${nodes.length}, Edges: ${edges.length}`);
  const sortedNodes = topologicalSort(nodes, edges);
  console.log(`[Pipeline] Topological order: ${sortedNodes.map(n => `${n.id}(${n.type || n.data.type})`).join(' -> ')}`);

  // Build parent map: for each node, which nodes are its direct parents
  const parentMap = new Map<string, string[]>();
  for (const edge of edges) {
    const parents = parentMap.get(edge.target) || [];
    parents.push(edge.source);
    parentMap.set(edge.target, parents);
  }

  // Build node map for lookups
  const nodeMap = new Map<string, PipelineNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  const ctx: ExecutionContext = {
    steps: sortedNodes.map((n) => ({
      nodeId: n.id,
      nodeType: n.type || (n.data.type as string) || 'unknown',
      status: 'pending' as StepStatus,
    })),
    logs: [],
    failedNodeIds: new Set(),
    skippedNodeIds: new Set(),
    totalCost: 0,
    fxCost: 0,
    edges,
    nodeMap,
  };

  log(ctx, 'Pipeline execution started', 'info');
  await persistProgress(executionId, ctx);

  for (const node of sortedNodes) {
    const nodeType = node.type || (node.data.type as string) || 'unknown';
    console.log(`[Pipeline] Processing node: ${node.id} (${nodeType}) — ${(node.data.name as string) || 'unnamed'}`);

    // Check if node was marked as skipped by a condition branch
    if (ctx.skippedNodeIds.has(node.id)) {
      updateStep(ctx, node.id, { status: 'skipped' });
      log(ctx, `Skipping ${node.data.name || node.id} (condition branch not taken)`, 'info', node.id);
      await persistProgress(executionId, ctx);
      continue;
    }

    // Check if any parent node failed — if so, skip this node
    const parents = parentMap.get(node.id) || [];
    const hasFailedParent = parents.some((pid) => ctx.failedNodeIds.has(pid));

    if (hasFailedParent) {
      updateStep(ctx, node.id, { status: 'skipped' });
      log(ctx, `Skipping ${node.data.name || node.id} (parent failed)`, 'info', node.id);
      await persistProgress(executionId, ctx);
      continue;
    }

    try {
      const result = await executeNode(node, ctx, executionId);

      if (result === 'awaiting') {
        // Pipeline pauses for approval
        await prisma.pipelineExecution.update({
          where: { id: executionId },
          data: {
            status: 'AWAITING_APPROVAL',
            totalCost: ctx.totalCost.toFixed(2),
            fxCost: ctx.fxCost.toFixed(2),
            results: {
              steps: ctx.steps,
              logs: ctx.logs,
              pausedAtNodeId: node.id,
            } as unknown as Prisma.InputJsonValue,
          },
        });
        log(ctx, 'Pipeline paused — awaiting approval', 'pending');
        await persistProgress(executionId, ctx);
        return;
      }

      if (result === 'paused') {
        // Pipeline pauses for delay
        await prisma.pipelineExecution.update({
          where: { id: executionId },
          data: {
            status: 'PAUSED',
            totalCost: ctx.totalCost.toFixed(2),
            fxCost: ctx.fxCost.toFixed(2),
            results: {
              steps: ctx.steps,
              logs: ctx.logs,
              pausedAtNodeId: node.id,
            } as unknown as Prisma.InputJsonValue,
          },
        });
        log(ctx, 'Pipeline paused — waiting for delay', 'pending');
        await persistProgress(executionId, ctx);
        return;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      updateStep(ctx, node.id, {
        status: 'failed',
        error: errorMsg,
        completedAt: new Date().toISOString(),
      });
      log(ctx, `${node.data.name || node.id}: failed — ${errorMsg}`, 'error', node.id);
      ctx.failedNodeIds.add(node.id);
    }

    // Persist progress after each node
    await persistProgress(executionId, ctx);
  }

  // Determine final status
  const failedCount = ctx.failedNodeIds.size;
  const skippedCount = ctx.skippedNodeIds.size;
  const totalExecutable = sortedNodes.length - skippedCount;
  let finalStatus: string;

  if (failedCount === 0) {
    finalStatus = 'COMPLETED';
    log(ctx, 'Pipeline executed successfully!', 'success');
  } else if (failedCount < totalExecutable) {
    finalStatus = 'PARTIAL_FAILURE';
    log(ctx, `Pipeline completed with ${failedCount} failed node(s)`, 'error');
  } else {
    finalStatus = 'FAILED';
    log(ctx, 'Pipeline execution failed', 'error');
  }

  // Final DB update
  await prisma.pipelineExecution.update({
    where: { id: executionId },
    data: {
      status: finalStatus,
      totalCost: ctx.totalCost.toFixed(2),
      fxCost: ctx.fxCost.toFixed(2),
      results: {
        steps: ctx.steps,
        logs: ctx.logs,
      } as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
}
