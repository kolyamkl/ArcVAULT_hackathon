'use client';

import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  /** Predefined shape variants */
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
}: SkeletonProps) {
  const variantClasses: Record<string, string> = {
    text: 'h-4 w-full rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    ...(variant === 'circular' && !width && !height
      ? { width: '40px', height: '40px' }
      : {}),
  };

  return (
    <div
      className={clsx(
        'relative overflow-hidden bg-gray-200 dark:bg-gray-700/50',
        variantClasses[variant],
        className
      )}
      style={style}
    >
      <div
        className="absolute inset-0 animate-shimmer"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
          backgroundSize: '200% 100%',
        }}
      />
    </div>
  );
}
