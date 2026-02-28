'use client';

// ---------------------------------------------------------------------------
// Shared inline form primitives for pipeline nodes
// ---------------------------------------------------------------------------

export interface FieldInputProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}

export function FieldInput({ label, value, onChange, placeholder, type = 'text' }: FieldInputProps) {
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

export interface FieldSelectProps {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}

export function FieldSelect({ label, value, options, onChange }: FieldSelectProps) {
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
