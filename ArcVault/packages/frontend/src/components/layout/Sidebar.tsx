'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Shield,
  ArrowLeftRight,
  Workflow,
  X,
  Landmark,
  Settings,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Treasury Vault', href: '/vault', icon: Shield },
  { label: 'FX Conversion', href: '/fx', icon: ArrowLeftRight },
  { label: 'Pipeline Builder', href: '/pipeline', icon: Workflow },
];

interface SidebarProps {
  className?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ className, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && mobileOpen) {
        onMobileClose?.();
      }
    },
    [mobileOpen, onMobileClose]
  );

  useEffect(() => {
    if (mobileOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [mobileOpen, handleEscape]);

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  const sidebarContent = (
    <div
      className={clsx(
        'flex flex-col w-full h-full',
        'bg-[#16161480] backdrop-blur-[40px]',
        'border-r border-[#C9A96212]',
        className
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 pt-0 pb-7 flex-shrink-0">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] rounded-[10px] bg-[#C9A96230] border border-[#C9A96240] backdrop-blur-[12px] flex items-center justify-center">
            <Landmark className="h-4 w-4 text-[#121210]" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground leading-tight">ArcVault</span>
            <span className="text-[10px] text-muted leading-tight">Treasury</span>
          </div>
        </Link>

        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="md:hidden p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-[#C9A96215] transition-colors"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-[10px] font-semibold tracking-[2px] text-muted px-3 mb-3">
          NAVIGATION
        </p>
        <div className="space-y-1.5">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onMobileClose?.()}
                className={clsx(
                  'flex items-center gap-3 px-3.5 py-[11px] rounded-[10px] text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-[#C9A96218] border border-[#C9A96225] text-foreground backdrop-blur-[12px]'
                    : 'text-[#8A8780] hover:text-foreground hover:bg-[#C9A96210]'
                )}
              >
                <Icon className={clsx('h-5 w-5 flex-shrink-0', active ? 'text-[#D4A853]' : 'text-[#8A8780]')} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-3 flex-shrink-0">
        <div className="h-px w-full bg-[var(--color-card-border)]" />
        {/* Settings */}
        <Link
          href="#"
          className="flex items-center gap-3 px-3.5 py-2 rounded-[10px] text-sm text-[#8A8780] hover:text-foreground hover:bg-[#C9A96210] transition-colors mt-2"
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          <span>Settings</span>
        </Link>

        {/* User */}
        <div className="flex items-center gap-3 px-3.5 py-2 mt-1">
          <div className="w-8 h-8 rounded-full bg-[#D4A85320] flex items-center justify-center text-xs font-medium text-[#D4A853]">
            0x
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-foreground truncate">Treasury Ops</span>
            <span className="text-[10px] text-muted truncate">0x1a2b...9f0e</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-shrink-0 h-full relative z-20">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          {/* Slide-in sidebar */}
          <aside className="fixed inset-y-0 left-0 z-50 w-[280px] animate-slide-in-left">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
