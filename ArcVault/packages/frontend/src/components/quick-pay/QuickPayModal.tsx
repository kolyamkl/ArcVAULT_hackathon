'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Modal } from '@/components/shared/Modal';
import { Input } from '@/components/shared/Input';
import { Select } from '@/components/shared/Select';
import { Button } from '@/components/shared/Button';
import { useUIStore } from '@/stores/ui.store';
import { useVaultBalances } from '@/hooks/useVaultBalances';
import { useFXQuote } from '@/hooks/useFXQuote';
import { useExecutePayout } from '@/hooks/useExecutePayout';
import { useExecuteSwap } from '@/hooks/useExecuteSwap';
import { stringToHex } from 'viem';
import { formatCurrency, shortenAddress } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { PaymentSummary } from './PaymentSummary';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCY_OPTIONS = [
  { label: 'USDC', value: 'USDC' },
  { label: 'EURC', value: 'EURC' },
  { label: 'GBPC', value: 'GBPC' },
  { label: 'JPYC', value: 'JPYC' },
  { label: 'CADC', value: 'CADC' },
];

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isValidRecipient(value: string): boolean {
  if (/^0x[a-fA-F0-9]{40}$/.test(value)) return true;
  if (/^[a-zA-Z0-9-]+\.eth$/.test(value)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Quick Pay modal form. Allows one-off stablecoin payments to any address.
 *
 * - Validates recipient (hex or ENS) and amount (> 0).
 * - Fetches a live FX quote when a non-USDC currency is selected.
 * - Executes a 2-step flow (FX swap + payout) for non-USDC currencies.
 * - Resets form state on close.
 */
export function QuickPayModal() {
  const isOpen = useUIStore((s) => s.quickPayOpen);
  const closeQuickPay = useUIStore((s) => s.closeQuickPay);

  // Wallet connection
  const { address, isConnected } = useAccount();

  // Vault balances for hint
  const { liquidUSDC } = useVaultBalances();
  const availableBalance = Number(liquidUSDC) / 1e6;

  // Form state
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USDC');
  const [memo, setMemo] = useState('');

  // Touched state for validation display
  const [recipientTouched, setRecipientTouched] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);

  // Debounced amount for FX quote
  const debouncedAmount = useDebounce(amount, 500);
  const numericAmount = parseFloat(debouncedAmount) || 0;

  // FX quote (only when non-USDC)
  const fxPair = currency !== 'USDC' ? `USDC/${currency}` : '';
  const {
    data: quote,
    isLoading: quoteLoading,
  } = useFXQuote(fxPair, numericAmount > 0 ? String(numericAmount) : '');

  // Mutations
  const executePayout = useExecutePayout();
  const executeSwap = useExecuteSwap();

  // Derived validation
  const parsedAmount = parseFloat(amount) || 0;
  const recipientError =
    recipientTouched && recipient && !isValidRecipient(recipient)
      ? 'Invalid address or ENS name'
      : undefined;
  const amountError =
    amountTouched && amount && parsedAmount <= 0
      ? 'Amount must be greater than 0'
      : undefined;
  const exceedsBalance = parsedAmount > availableBalance;

  const isFormValid =
    isValidRecipient(recipient) &&
    parsedAmount > 0 &&
    !exceedsBalance;

  const isQuoteReady = currency === 'USDC' || (!!quote && !quoteLoading);

  const canSubmit =
    isConnected &&
    isFormValid &&
    isQuoteReady &&
    !executePayout.isPending &&
    !executeSwap.isPending;

  // Reset form on close
  const resetForm = useCallback(() => {
    setRecipient('');
    setAmount('');
    setCurrency('USDC');
    setMemo('');
    setRecipientTouched(false);
    setAmountTouched(false);
    executePayout.reset();
    executeSwap.reset();
  }, [executePayout, executeSwap]);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  // Submit handler
  const handleSendPayment = useCallback(async () => {
    if (!canSubmit || !address) return;

    try {
      // Step 1: FX swap if non-USDC
      if (currency !== 'USDC' && quote) {
        const estimatedUSDCCost = parsedAmount / quote.rate;
        await executeSwap.mutateAsync({
          quoteId: quote.id,
          fromCurrency: 'USDC',
          toCurrency: currency,
          fromAmount: String(estimatedUSDCCost),
        });
      }

      // Step 2: Execute payout via PayoutRouter
      // Convert amount to 6-decimal bigint (stablecoin standard)
      const amountInSmallestUnit = BigInt(Math.round(parsedAmount * 1e6));
      const recipientAddress = recipient.startsWith('0x')
        ? (recipient as `0x${string}`)
        : (recipient as `0x${string}`); // ENS resolution would happen here in production

      // Target currency as bytes32
      const currencyBytes32 = stringToHex(currency, { size: 32 });

      await executePayout.mutateAsync({
        recipient: recipientAddress,
        amount: amountInSmallestUnit,
        targetCurrency: currencyBytes32,
        reference: memo || '',
      });

      // Step 3: Record payout via API
      await fetch('/api/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient,
          amount: parsedAmount,
          currency,
          memo,
          txHash: 'pending', // In production, we'd extract this from the receipt
        }),
      });

      // Step 4: Success - close modal
      closeQuickPay();
    } catch {
      // Error state: modal stays open for retry
      // The mutation's error state will be displayed
    }
  }, [
    canSubmit,
    address,
    currency,
    quote,
    parsedAmount,
    recipient,
    memo,
    executeSwap,
    executePayout,
    closeQuickPay,
  ]);

  const isPending = executePayout.isPending || executeSwap.isPending;
  const mutationError = executePayout.error || executeSwap.error;

  return (
    <Modal isOpen={isOpen} onClose={closeQuickPay} title="Quick Pay">
      <div className="space-y-4">
        {/* Recipient */}
        <Input
          label="Recipient"
          placeholder="0x... or ENS name"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          onBlur={() => setRecipientTouched(true)}
          error={recipientError}
          disabled={isPending}
        />

        {/* Amount */}
        <div>
          <Input
            label="Amount"
            placeholder="0.00"
            prefix="$"
            value={amount}
            onChange={(e) => {
              // Allow only valid numeric input with up to 2 decimal places
              const val = e.target.value;
              if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                setAmount(val);
              }
            }}
            onBlur={() => setAmountTouched(true)}
            error={amountError}
            disabled={isPending}
            inputMode="decimal"
          />
          {/* Balance hint */}
          <p className="text-xs text-muted mt-1">
            Available: {formatCurrency(availableBalance, 'USDC')}
          </p>
          {/* Insufficient balance warning */}
          {exceedsBalance && parsedAmount > 0 && (
            <p className="text-xs text-error mt-1">Insufficient balance</p>
          )}
        </div>

        {/* Currency */}
        <Select
          label="Currency"
          options={CURRENCY_OPTIONS}
          value={currency}
          onChange={setCurrency}
          className={isPending ? 'pointer-events-none opacity-50' : ''}
        />

        {/* Memo */}
        <Input
          label="Memo (optional)"
          placeholder="Invoice #, description, etc."
          value={memo}
          onChange={(e) => {
            if (e.target.value.length <= 100) {
              setMemo(e.target.value);
            }
          }}
          disabled={isPending}
        />

        {/* Payment Summary */}
        {parsedAmount > 0 && (
          <PaymentSummary
            amount={parsedAmount}
            currency={currency}
            quote={quote ?? null}
            quoteLoading={quoteLoading}
          />
        )}

        {/* Error display */}
        {mutationError && (
          <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2">
            <p className="text-xs text-error">
              Payment failed: {mutationError.message}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            variant="ghost"
            onClick={closeQuickPay}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSendPayment}
            disabled={!canSubmit}
            loading={isPending}
          >
            {!isConnected
              ? 'Connect wallet'
              : isPending
                ? 'Processing...'
                : 'Send Payment'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
