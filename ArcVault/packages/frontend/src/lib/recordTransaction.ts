/**
 * Records a vault transaction to the database after on-chain confirmation.
 * Fire-and-forget — errors are logged but don't break the UI flow.
 */
export async function recordTransaction(params: {
  type: 'DEPOSIT' | 'WITHDRAW' | 'SWEEP' | 'REDEEM';
  txHash: string;
  amount: string; // human-readable amount (e.g. "5000")
  currency?: string;
  blockNumber?: number;
  fromAddress?: string;
  toAddress?: string;
}) {
  try {
    await fetch('/api/vault/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: params.type,
        txHash: params.txHash,
        amount: params.amount,
        currency: params.currency ?? 'USDC',
        chainId: 5042002,
        blockNumber: params.blockNumber ? Number(params.blockNumber) : undefined,
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
      }),
    });
  } catch (err) {
    console.error('[recordTransaction] Failed to record:', err);
  }
}
