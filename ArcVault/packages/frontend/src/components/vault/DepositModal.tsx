'use client';

import { useState, useCallback, useEffect } from 'react';
import { Check, AlertCircle, ExternalLink, ArrowDownToLine, ShieldCheck, ChevronDown } from 'lucide-react';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { Modal } from '@/components/shared/Modal';
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
const PRESETS = [10_000, 25_000, 50_000, 100_000] as const;
const PRESET_LABELS = ['$10K', '$25K', '$50K', '$100K'] as const;

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

<<<<<<< HEAD
  // Available USDC balance (user's wallet, converted from bigint)
  const availableBalance = Number(userUSDC) / 1e6;
=======
  const availableBalance = Number(liquidUSDC) / 1e6;
>>>>>>> f4d4412bd3c1db5f06c3ed2ffc406dde715b4920

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
      const timer = setTimeout(() => onClose(), 2000);
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
    const parts = raw.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 6) return;
    setAmount(raw);
  }, []);

  const handlePreset = useCallback((value: number) => {
    setAmount(String(value));
  }, []);

  const handleDeposit = useCallback(async () => {
    if (!isValidAmount || !amount) return;

    try {
      setStep('approving');
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

  const displayAmount = numericAmount > 0
    ? numericAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })
    : '0';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="-mt-4">
        {/* Custom header */}
        <div className="mb-4">
          <h3 className="text-[22px] font-bold text-foreground">Deposit USDC</h3>
          <p className="text-sm text-muted mt-1">Add funds to your ArcVault treasury</p>
        </div>
        <div className="h-px bg-[#383430] mb-5" />

        {/* Input step */}
        {(step === 'input' || step === 'approving' || step === 'depositing') && (
          <div className="space-y-4">
            {/* Amount input area */}
            <div>
              <p className="text-sm text-muted mb-2">Amount</p>
              <div className="bg-[#0A0E1A] rounded-xl border border-[#383430] h-[72px] flex items-center px-4">
                <div className="flex-1">
                  <div className="flex items-center">
                    <span className="text-muted text-2xl mr-1">$</span>
                    <input
                      type="text"
                      value={amount}
                      onChange={handleAmountChange}
                      placeholder="0"
                      disabled={step !== 'input'}
                      className="bg-transparent text-[32px] font-bold text-foreground outline-none w-full placeholder:text-[#383430]"
                    />
                  </div>
                </div>
                {/* USDC token badge */}
                <div className="flex items-center gap-2 bg-[#1A1E2A] rounded-lg px-3 py-1.5 border border-[#383430]">
                  <div className="w-5 h-5 rounded-full bg-[#D4A853] flex items-center justify-center">
                    <span className="text-[8px] font-bold text-[#0A0A0A]">$</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">USDC</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted" />
                </div>
              </div>
            </div>

            {/* Balance row */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">Available Balance</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {formatCurrency(availableBalance, { decimals: 2 })} USDC
                </p>
                <button
                  type="button"
                  onClick={handleMaxClick}
                  disabled={step !== 'input'}
                  className="text-xs font-semibold text-[#D4A853] bg-[#D4A85318] px-2.5 py-0.5 rounded-full hover:bg-[#D4A85330] transition-colors disabled:opacity-50"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Preset buttons */}
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map((preset, i) => {
                const isSelected = numericAmount === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePreset(preset)}
                    disabled={step !== 'input'}
                    className={`py-2.5 rounded-lg text-sm font-medium transition-all border ${
                      isSelected
                        ? 'border-[#D4A853] bg-[#D4A85318] text-[#D4A853]'
                        : 'border-[#383430] bg-transparent text-muted hover:border-[#D4A85350] hover:text-foreground'
                    } disabled:opacity-50`}
                  >
                    {PRESET_LABELS[i]}
                  </button>
                );
              })}
            </div>

            {/* Details card */}
            <div className="bg-[#0A0E1A] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Network</span>
                <span className="text-sm text-foreground">Ethereum Mainnet</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Estimated Gas</span>
                <span className="text-sm text-foreground">~$2.45</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Destination</span>
                <span className="text-sm text-[#D4A853] font-medium">ArcVault Treasury</span>
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
                    {step === 'depositing' && <Check className="w-3.5 h-3.5 text-white" />}
                    {step === 'approving' && <span className="text-xs text-[#C9A962] font-medium">1</span>}
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

            {/* Deposit button */}
            <Button
              variant="primary"
              className="w-full !h-[52px] !text-base !font-semibold"
              onClick={handleDeposit}
              disabled={!isConnected || !isValidAmount || step === 'approving' || step === 'depositing'}
              loading={step === 'approving' || step === 'depositing'}
            >
              {!isConnected ? (
                'Connect Wallet'
              ) : step === 'approving' ? (
                'Approving USDC...'
              ) : step === 'depositing' ? (
                'Depositing...'
              ) : (
                <span className="inline-flex items-center gap-2">
                  <ArrowDownToLine className="w-4 h-4" />
                  Deposit ${displayAmount} USDC
                </span>
              )}
            </Button>

            {/* Security note */}
            <div className="flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#4ADE80]" />
              <span className="text-xs text-muted">Secured by multi-sig smart contract</span>
            </div>
          </div>
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
                {formatCurrency(numericAmount, { decimals: 2 })} USDC deposited successfully
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
