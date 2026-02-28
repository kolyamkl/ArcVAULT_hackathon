'use client';

import { forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, prefix, suffix, className, id, ...props }, ref) {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={clsx('w-full', className)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-foreground mb-1.5 block"
          >
            {label}
          </label>
        )}
        <div
          className={clsx(
            'flex items-center rounded-lg border transition-colors',
            'bg-[#232120] border-[#383430] focus-within:border-[#C9A962]',
            '[html:not(.dark)_&]:bg-white [html:not(.dark)_&]:border-gray-300 [html:not(.dark)_&]:focus-within:border-[#C9A962]',
            error && 'border-error focus-within:border-error'
          )}
        >
          {prefix && (
            <span className="px-3 text-muted flex-shrink-0">{prefix}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              'bg-transparent flex-1 px-3 py-2 text-sm outline-none text-foreground',
              'placeholder:text-muted',
              prefix && 'pl-0',
              suffix && 'pr-0'
            )}
            {...props}
          />
          {suffix && (
            <span className="px-3 text-muted flex-shrink-0">{suffix}</span>
          )}
        </div>
        {error && (
          <p className="text-xs text-error mt-1">{error}</p>
        )}
      </div>
    );
  }
);
