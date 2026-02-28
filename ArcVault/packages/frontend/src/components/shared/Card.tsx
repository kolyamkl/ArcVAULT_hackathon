import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** Adds a gradient border glow effect (dark mode). */
  glow?: boolean;
}

export function Card({ children, className, glow = false }: CardProps) {
  if (glow) {
    return (
      <div className="bg-gradient-primary p-[1px] rounded-xl">
        <div
          className={clsx(
            'bg-transparent rounded-xl p-6',
            'border border-[#2A2A2A]',
            'transition-all duration-200',
            className
          )}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'bg-transparent rounded-xl p-6',
        'border border-[#2A2A2A]',
        'transition-all duration-200',
        className
      )}
    >
      {children}
    </div>
  );
}
