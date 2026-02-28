'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from 'reactflow';
import { usePipelineStore, type NodeStatus } from '@/stores/pipeline.store';
import { formatCurrency } from '@/lib/utils';
import { Briefcase, Check, ArrowRightLeft, Gift } from 'lucide-react';
import { NodeDeleteButton } from './NodeDeleteButton';

// ---------------------------------------------------------------------------
// Status-driven style map
// ---------------------------------------------------------------------------

const statusClasses: Record<NodeStatus, string> = {
  pending: 'border-[#A09D95] opacity-60',
  processing: 'border-[#E0A84C] animate-pulse shadow-[#E0A84C]/20 shadow-lg',
  completed: 'border-[#7EC97A] shadow-[#7EC97A]/20 shadow-lg',
  failed: 'border-[#D46B6B] shadow-[#D46B6B]/20 shadow-lg',
  awaiting_approval: 'border-[#A78BFA] animate-pulse shadow-[#A78BFA]/20 shadow-lg',
  paused: 'border-[#60A5FA] shadow-[#60A5FA]/20 shadow-lg',
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCY_OPTIONS = ['USDC', 'EURC', 'GBPC', 'JPYC', 'CADC'];
const PAYMENT_TYPE_OPTIONS = [
  { label: 'Recurring', value: 'recurring' },
  { label: 'Milestone', value: 'milestone' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContractorData {
  name: string;
  walletAddress: string;
  amount: number;
  currency: string;
  paymentType: 'recurring' | 'milestone';
  milestoneDescription: string;
  giftEnabled: boolean;
  giftAmount: number;
  giftNote: string;
  expanded: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Contractor leaf node. Similar to EmployeeNode but adds paymentType and
 * milestoneDescription fields.
 *
 * Shows an amber/orange accent left border, currency badge, payment type badge,
 * and FX indicator when currency is not USDC.
 */
function ContractorNodeRaw({ id, data }: NodeProps<ContractorData>) {
  const { setNodes } = useReactFlow();
  const isExecuting = usePipelineStore((s) => s.isExecuting);
  const executionProgress = usePipelineStore((s) => s.executionProgress);
  const nodeStatus = executionProgress.get(id);

  const { name, walletAddress, amount, currency, paymentType, milestoneDescription, giftEnabled, giftAmount, giftNote, expanded } = data;
  const needsFX = currency !== 'USDC';

  const borderClass =
    isExecuting && nodeStatus
      ? statusClasses[nodeStatus]
      : 'border-l-[#D4A853]';

  const updateField = useCallback(
    (field: string, value: string | number | boolean) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n,
        ),
      );
    },
    [id, setNodes],
  );

  const handleDone = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, expanded: false } } : n,
        ),
      );
    },
    [id, setNodes],
  );

  return (
    <div
      className={`group relative rounded-lg border border-[#383430] border-l-4 ${borderClass} bg-[#2D2B28] min-w-[180px] shadow-md transition-all duration-300`}
    >
      <NodeDeleteButton nodeId={id} />
      {/* Compact view */}
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#D4A853]/15 flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-3 h-3 text-[#D4A853]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {name || 'New Contractor'}
            </p>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">
            {amount > 0 ? formatCurrency(amount, currency) : '--'}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold
              ${needsFX ? 'bg-[#D4A853]/20 text-[#D4A853]' : 'bg-[#7EC97A]/20 text-[#7EC97A]'}`}
          >
            {needsFX && <ArrowRightLeft className="w-2.5 h-2.5" />}
            {currency}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold
              ${paymentType === 'milestone'
                ? 'bg-[#B08D3E]/20 text-[#B08D3E]'
                : 'bg-[#C9A96215] text-[#C9A962]'
              }`}
          >
            {paymentType === 'milestone' ? 'Milestone' : 'Recurring'}
          </span>
          {giftEnabled && giftAmount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#F472B6]/20 text-[#F472B6]">
              <Gift className="w-2.5 h-2.5" />
              +{formatCurrency(giftAmount, currency)}
            </span>
          )}
        </div>
      </div>

      {/* Expanded form */}
      {expanded && !isExecuting && (
        <div className="border-t border-[#383430] p-3 space-y-2.5 animate-fade-in">
          <FieldInput
            label="Name"
            value={name}
            onChange={(v) => updateField('name', v)}
            placeholder="Acme Corp"
          />
          <FieldInput
            label="Wallet Address"
            value={walletAddress}
            onChange={(v) => updateField('walletAddress', v)}
            placeholder="0x..."
          />
          <div className="grid grid-cols-2 gap-2">
            <FieldInput
              label="Amount"
              value={amount || ''}
              onChange={(v) => updateField('amount', parseFloat(String(v)) || 0)}
              placeholder="10000"
              type="number"
            />
            <FieldSelect
              label="Currency"
              value={currency}
              options={CURRENCY_OPTIONS.map((c) => ({ label: c, value: c }))}
              onChange={(v) => updateField('currency', v)}
            />
          </div>
          <FieldSelect
            label="Payment Type"
            value={paymentType}
            options={PAYMENT_TYPE_OPTIONS}
            onChange={(v) => updateField('paymentType', v)}
          />
          {paymentType === 'milestone' && (
            <div>
              <label className="text-[10px] font-medium text-[#A09D95] block mb-0.5">
                Milestone Description
              </label>
              <textarea
                value={milestoneDescription}
                onChange={(e) => updateField('milestoneDescription', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full rounded border border-[#383430] bg-[#232120] px-2 py-1 text-xs text-foreground
                           focus:border-[#C9A962] focus:outline-none transition-colors resize-none"
                placeholder="Describe the milestone..."
                rows={2}
              />
            </div>
          )}

          {/* Gift constructor */}
          <div className="border-t border-[#383430] pt-2.5 mt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={giftEnabled}
                onChange={(e) => updateField('giftEnabled', e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                className="accent-[#F472B6]"
              />
              <span className="text-[10px] font-medium text-[#F472B6] flex items-center gap-1">
                <Gift className="w-3 h-3" />
                Attach Gift
              </span>
            </label>
            {giftEnabled && (
              <div className="mt-2 space-y-2 pl-5">
                <FieldInput
                  label="Gift Amount"
                  value={giftAmount || ''}
                  onChange={(v) => updateField('giftAmount', parseFloat(String(v)) || 0)}
                  placeholder="500"
                  type="number"
                />
                <div>
                  <label className="text-[10px] font-medium text-[#A09D95] block mb-0.5">Gift Note</label>
                  <textarea
                    value={giftNote}
                    onChange={(e) => updateField('giftNote', e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full rounded border border-[#383430] bg-[#232120] px-2 py-1 text-xs text-foreground
                               focus:border-[#F472B6] focus:outline-none transition-colors resize-none"
                    placeholder="Great work on the delivery!"
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleDone}
            className="flex items-center gap-1.5 text-xs font-medium text-[#C9A962] hover:text-[#D4A853] transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Done
          </button>
        </div>
      )}

      {/* Target handle (left) -- leaf node, no source handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-5 !h-5 !bg-[#D4A853] !border-2 !border-[#2D2B28] hover:!shadow-[0_0_8px_#D4A853]"
      />
    </div>
  );
}

export const ContractorNode = memo(ContractorNodeRaw);

// ---------------------------------------------------------------------------
// Shared inline form primitives (same pattern as EmployeeNode)
// ---------------------------------------------------------------------------

interface FieldInputProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}

function FieldInput({ label, value, onChange, placeholder, type = 'text' }: FieldInputProps) {
  return (
    <div>
      <label className="text-[10px] font-medium text-[#A09D95] block mb-0.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded border border-[#383430] bg-[#232120] px-2 py-1 text-xs text-foreground
                   focus:border-[#C9A962] focus:outline-none transition-colors"
        placeholder={placeholder}
      />
    </div>
  );
}

interface FieldSelectProps {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}

function FieldSelect({ label, value, options, onChange }: FieldSelectProps) {
  return (
    <div>
      <label className="text-[10px] font-medium text-[#A09D95] block mb-0.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded border border-[#383430] bg-[#232120] px-2 py-1 text-xs text-foreground
                   focus:border-[#C9A962] focus:outline-none transition-colors appearance-none cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
