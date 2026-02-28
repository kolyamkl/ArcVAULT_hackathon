'use client';

import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { Menu } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton';

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/vault': 'Pipeline Analysis',
  '/fx': 'FX Conversion',
  '/pipeline': 'Pipeline Builder',
};

interface HeaderProps {
  className?: string;
  onMobileMenuToggle?: () => void;
}

export function Header({ className, onMobileMenuToggle }: HeaderProps) {
  const pathname = usePathname();
  const pageTitle = routeTitles[pathname] ?? 'ArcVault';

  return (
    <header
      className={clsx(
        'sticky top-0 z-30 h-16 flex-shrink-0',
        'bg-[#191817e6] backdrop-blur-md border-b border-[#C9A96212]',
        'flex items-center justify-between px-6',
        className
      )}
    >
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-2 rounded-lg text-muted hover:text-foreground hover:bg-[#C9A96215] transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Mobile logo */}
        <span className="text-lg font-bold text-foreground md:hidden">ArcVault</span>

        {/* Page title (desktop) */}
        <h1 className="text-xl font-semibold text-foreground hidden md:block">
          {pageTitle}
        </h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <ConnectWalletButton />
      </div>
    </header>
  );
}
