'use client';

import { useState, useCallback, useEffect } from 'react';
import { Check, AlertCircle, ExternalLink, ShieldAlert } from 'lucide-react';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { Modal } from '@/components/shared/Modal';
import { Input } from '@/components/shared/Input';
import { Button } from '@/components/shared/Button';
import { useWithdraw } from '@/hooks/useWithdraw';
import { useVaultBalances } from '@/hooks/useVaultBalances';
import { formatCurrency } from '@/lib/format';
import { shortenAddress } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TxStep = 'input' | 'withdrawing' | 'success' | 'error';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXPLORER_URL = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || 'https://testnet-explorer.arc.io';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WithdrawModal({ isOpen, onClose }: WithdrawModalProps) {
  const { isConnected } = useAccount();
  const { liquidUSDC, threshold } = useVaultBalances();
  const withdrawMutation = useWithdraw();

  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<TxStep>('input');
  const [txHash, setTxHash] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');

  // Convert from bigint (6 decimals)
  const availableLiquid = Number(liquidUSDC) / 1e6;
  const currentThreshold = Number(threshold) / 1e6;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setStep('input');
      setTxHash('');
      setErrorMsg('');
    }
  }, [isOpen]);

  // Auto-close after success
  useEffect(() => {
    if (step === 'success') {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [step, onClose]);

  const numericAmount = parseFloat(amount) || 0;
  const isValidAmount = numericAmount > 0 && numericAmount <= availableLiquid;
  const wouldBreachThreshold = numericAmount > 0 && (availableLiquid - numericAmount) < currentThreshold;

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    const parts = raw.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 6) return;
    setAmount(raw);
  }, []);

  const handleMaxClick = useCallback(() => {
    setAmount(String(availableLiquid));
  }, [availableLiquid]);

  const handleWithdraw = useCallback(async () => {
    if (!isValidAmount || !amount) return;

    try {
      setStep('withdrawing');
      // Parse directly from the validated string – avoids float precision loss
      const amountBigInt = parseUnits(amount, 6);

      if (amountBigInt === 0n) {
        setErrorMsg('Amount must be greater than zero');
        setStep('error');
        return;
      }

      const receipt = await withdrawMutation.mutateAsync({ amount: amountBigInt });
      setTxHash(receipt.transactionHash);
      setStep('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Transaction failed');
      setStep('error');
    }
  }, [isValidAmount, amount, withdrawMutation]);

  const handleRetry = useCallback(() => {
    setStep('input');
    setErrorMsg('');
  }, []);

  // Validation error message
  let validationError: string | undefined;
  if (numericAmount > availableLiquid) {
    validationError = 'Exceeds available liquid balance';
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Withdraw USDC">
      <div className="space-y-5">
        {/* Role requirement notice */}
        <div className="flex items-start gap-2 p-3 bg-[#E0A84C10] rounded-lg border border-[#E0A84C30]">
          <ShieldAlert className="w-4 h-4 text-[#E0A84C] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#A09D95]">
            Withdrawals require TREASURY_MANAGER_ROLE. The transaction will revert if your
            wallet does not have the required role.
          </p>
        </div>

        {/* Input step */}
        {(step === 'input' || step === 'withdrawing') && (
          <>
            <div>
              <Input
                label="Amount"
                prefix="$"
                suffix="USDC"
                placeholder="0.00"
                value={amount}
                onChange={handleAmountChange}
                disabled={step !== 'input'}
                error={validationError}
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted">
                  Available: {formatCurrency(availableLiquid, { decimals: 2 })}
                </p>
                <button
                  type="button"
                  onClick={handleMaxClick}
                  className="text-xs text-[#C9A962] hover:text-[#D4A853] transition-colors font-medium"
                  disabled={step !== 'input'}
                >
                  Max
                </button>
              </div>
            </div>

            {/* Threshold warning */}
            {wouldBreachThreshold && isValidAmount && (
              <div className="flex items-start gap-2 p-3 bg-[#E0A84C10] border border-[#E0A84C30] rounded-lg animate-fade-in">
                <AlertCircle className="w-4 h-4 text-[#E0A84C] flex-shrink-0 mt-0.5" />
                <div className="text-xs text-[#A09D95] space-y-0.5">
                  <p className="font-medium text-[#E0A84C]">Below Liquidity Threshold</p>
                  <p>
                    This withdrawal would bring the liquid balance to{' '}
                    {formatCurrency(availableLiquid - numericAmount, { decimals: 2 })}, which
                    is below the {formatCurrency(currentThreshold)} threshold.
                  </p>
                </div>
              </div>
            )}

            <Button
              variant="primary"
              className="w-full"
              onClick={handleWithdraw}
              disabled={!isConnected || !isValidAmount || step === 'withdrawing'}
              loading={step === 'withdrawing'}
            >
              {!isConnected
                ? 'Connect Wallet'
                : step === 'withdrawing'
                  ? 'Withdrawing...'
                  : 'Withdraw USDC'}
            </Button>
          </>
        )}

        {/* Success step */}
        {step === 'success' && (
          <div className="flex flex-col items-center gap-4 py-4 animate-fade-in">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-success/10">
              <Check className="w-6 h-6 text-success" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-lg font-semibold text-foreground">Withdrawal Confirmed</p>
              <p className="text-sm text-muted">
                {formatCurrency(numericAmount, { decimals: 2 })} USDC withdrawn
                successfully
              </p>
            </div>
            {txHash && (
              <a
                href={`${EXPLORER_URL}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#C9A962] hover:text-[#D4A853] transition-colors"
              >
                {shortenAddress(txHash)}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Error step */}
        {step === 'error' && (
          <div className="flex flex-col items-center gap-4 py-4 animate-fade-in">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-error/10">
              <AlertCircle className="w-6 h-6 text-error" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-lg font-semibold text-foreground">Transaction Failed</p>
              <p className="text-sm text-muted break-all">{errorMsg}</p>
            </div>
            <Button variant="primary" onClick={handleRetry}>
              Try Again
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
