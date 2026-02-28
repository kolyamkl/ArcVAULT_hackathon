'use client';

import { useState, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleMobileOpen = useCallback(() => {
    setMobileOpen(true);
  }, []);

  const handleMobileClose = useCallback(() => {
    setMobileOpen(false);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden relative bg-background">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={handleMobileClose} />
      <div className="flex flex-col flex-1 overflow-hidden relative">
        <Header onMobileMenuToggle={handleMobileOpen} />
        <main className="flex-1 overflow-y-auto p-6 relative">
          {/* Ambient glow effects matching Pencil design */}
          <div
            className="pointer-events-none absolute top-[-100px] left-[300px] w-[700px] h-[700px] rounded-full opacity-100"
            style={{
              background: 'radial-gradient(ellipse, #C9A96218 0%, transparent 70%)',
            }}
          />
          <div
            className="pointer-events-none absolute bottom-0 right-[100px] w-[600px] h-[600px] rounded-full opacity-100"
            style={{
              background: 'radial-gradient(ellipse, #C9A96215 0%, transparent 70%)',
            }}
          />
          {children}
        </main>
      </div>
    </div>
  );
}
