'use client';

import { useState, useRef, useEffect } from 'react';
import { useAccount, useDisconnect, useSwitchChain } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { Wallet, LogOut, AlertTriangle } from 'lucide-react';
import { arcTestnet } from '@/lib/chains';

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ConnectWalletButton() {
  const { address, isConnected, chain } = useAccount();
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isWrongChain = isConnected && chain?.id !== arcTestnet.id;

  // Clear stale WC sessions when the modal opens so a fresh QR is always
  // generated. Without this, the connector reuses a cached session and never
  // emits display_uri, so the QR code never appears.
  useEffect(() => {
    if (!connectModalOpen) return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('wc@2:') || key.startsWith('wagmi.walletConnect'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}
  }, [connectModalOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  // Wrong chain state
  if (isWrongChain) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => switchChain({ chainId: arcTestnet.id })}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors cursor-pointer"
        >
          <AlertTriangle className="h-4 w-4" />
          <span>Switch to Arc Testnet</span>
        </button>
        <button
          onClick={() => disconnect()}
          className="flex items-center justify-center p-2 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
          title="Disconnect"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Connected state
  if (isConnected && address) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown((prev) => !prev)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#C9A96230] bg-[#C9A96210] text-sm font-medium text-foreground hover:bg-[#C9A96220] transition-colors cursor-pointer"
        >
          <Wallet className="h-4 w-4 text-[#C9A962]" />
          <span>{shortenAddress(address)}</span>
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-48 rounded-lg border border-[#C9A96220] bg-[#232120] shadow-xl z-50">
            <button
              onClick={() => {
                disconnect();
                setShowDropdown(false);
              }}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-[#C9A96210] rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Disconnect</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Disconnected state
  return (
    <button
      onClick={() => openConnectModal?.()}
      disabled={connectModalOpen}
      className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#C9A962] text-[#191817] text-sm font-semibold hover:bg-[#d4b86e] disabled:opacity-50 transition-colors cursor-pointer"
    >
      <Wallet className="h-4 w-4" />
      <span>{connectModalOpen ? 'Connecting...' : 'Connect Wallet'}</span>
    </button>
  );
}
