'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  BarChart3,
  ArrowLeftRight,
  Workflow,
  X,
  Landmark,
  Settings,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Pipeline Analysis', href: '/vault', icon: BarChart3 },
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
        'bg-[#161614e6] backdrop-blur-md',
        'border-r border-[#C9A96212]',
        className
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-6 border-b border-[#C9A96212] flex-shrink-0">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D4A853] to-[#B08D3E] flex items-center justify-center">
            <Landmark className="h-4 w-4 text-[#0A0A0A]" />
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
        <div className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onMobileClose?.()}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-[#C9A96218] border border-[#C9A96225] text-[#C9A962]'
                    : 'text-[#7A7770] hover:text-foreground hover:bg-[#C9A96210]'
                )}
              >
                <Icon className={clsx('h-5 w-5 flex-shrink-0', active && 'text-[#C9A962]')} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-[#C9A96212] flex-shrink-0">
        {/* Settings */}
        <Link
          href="#"
          className="flex items-center gap-3 px-6 py-3 text-sm text-[#7A7770] hover:text-foreground hover:bg-[#C9A96210] transition-colors"
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          <span>Settings</span>
        </Link>

        {/* User */}
        <div className="flex items-center gap-3 px-6 py-3 border-t border-[#C9A96212]">
          <div className="w-8 h-8 rounded-full bg-[#C9A96220] flex items-center justify-center text-xs font-medium text-[#C9A962]">
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
