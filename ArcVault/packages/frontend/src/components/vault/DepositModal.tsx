'use client';

import { useState, useCallback, useEffect } from 'react';
import { Check, AlertCircle, ExternalLink } from 'lucide-react';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { Modal } from '@/components/shared/Modal';
import { Input } from '@/components/shared/Input';
import { Button } from '@/components/shared/Button';
import { useDeposit } from '@/hooks/useDeposit';
import { useUserUSDCBalance } from '@/hooks/useUserUSDCBalance';
import { formatCurrency } from '@/lib/format';
import { shortenAddress } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TxStep = 'input' | 'approving' | 'depositing' | 'success' | 'error';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXPLORER_URL = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || 'https://testnet-explorer.arc.io';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const { isConnected } = useAccount();
  const { balance: userUSDC } = useUserUSDCBalance();
  const depositMutation = useDeposit();

  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<TxStep>('input');
  const [txHash, setTxHash] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');

  // Available USDC balance (user's wallet, converted from bigint)
  const availableBalance = Number(userUSDC) / 1e6;

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
  const isValidAmount = numericAmount > 0;

  const handleMaxClick = useCallback(() => {
    setAmount(String(availableBalance));
  }, [availableBalance]);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    // Allow only one decimal point
    const parts = raw.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 6) return;
    setAmount(raw);
  }, []);

  const handleDeposit = useCallback(async () => {
    if (!isValidAmount || !amount) return;

    try {
      setStep('approving');
      // Parse directly from the validated string – avoids float precision loss
      const amountBigInt = parseUnits(amount, 6);

      if (amountBigInt === 0n) {
        setErrorMsg('Amount must be greater than zero');
        setStep('error');
        return;
      }

      const receipt = await depositMutation.mutateAsync({
        amount: amountBigInt,
        onApproved: () => setStep('depositing'),
      });
      setTxHash(receipt.transactionHash);
      setStep('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Transaction failed');
      setStep('error');
    }
  }, [isValidAmount, amount, depositMutation]);

  const handleRetry = useCallback(() => {
    setStep('input');
    setErrorMsg('');
  }, []);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Deposit USDC">
      <div className="space-y-5">
        {/* Input step */}
        {(step === 'input' || step === 'approving' || step === 'depositing') && (
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
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted">
                  Available: {formatCurrency(availableBalance, { decimals: 2 })}
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

            {/* Two-step indicator */}
            {step !== 'input' && (
              <div className="flex items-center gap-3 p-3 bg-[#C9A96215] border border-[#C9A96230] rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <div
                    className={
                      step === 'approving'
                        ? 'w-6 h-6 rounded-full border-2 border-[#C9A962] flex items-center justify-center animate-pulse'
                        : 'w-6 h-6 rounded-full bg-success flex items-center justify-center'
                    }
                  >
                    {step === 'depositing' && (
                      <Check className="w-3.5 h-3.5 text-white" />
                    )}
                    {step === 'approving' && (
                      <span className="text-xs text-[#C9A962] font-medium">1</span>
                    )}
                  </div>
                  <span className="text-[#A09D95]">Approve</span>
                </div>

                <div className="flex-1 h-px bg-[#383430]" />

                <div className="flex items-center gap-2 text-sm">
                  <div
                    className={
                      step === 'depositing'
                        ? 'w-6 h-6 rounded-full border-2 border-[#C9A962] flex items-center justify-center animate-pulse'
                        : 'w-6 h-6 rounded-full border-2 border-[#383430] flex items-center justify-center'
                    }
                  >
                    <span className="text-xs text-[#A09D95] font-medium">2</span>
                  </div>
                  <span className="text-[#A09D95]">Deposit</span>
                </div>
              </div>
            )}

            <Button
              variant="primary"
              className="w-full"
              onClick={handleDeposit}
              disabled={
                !isConnected ||
                !isValidAmount ||
                step === 'approving' ||
                step === 'depositing'
              }
              loading={step === 'approving' || step === 'depositing'}
            >
              {!isConnected
                ? 'Connect Wallet'
                : step === 'approving'
                  ? 'Approving USDC...'
                  : step === 'depositing'
                    ? 'Depositing...'
                    : 'Deposit USDC'}
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
              <p className="text-lg font-semibold text-foreground">Deposit Confirmed</p>
              <p className="text-sm text-muted">
                {formatCurrency(numericAmount, { decimals: 2 })} USDC deposited
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
