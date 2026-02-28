'use client';

import { useState, useRef, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { Wallet, LogOut, AlertTriangle } from 'lucide-react';
import { arcTestnet } from '@/lib/chains';
import { WalletConnectQRModal } from './WalletConnectQRModal';

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ConnectWalletButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showConnectors, setShowConnectors] = useState(false);
  const [wcUri, setWcUri] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isWrongChain = isConnected && chain?.id !== arcTestnet.id;

  // Auto-close QR modal when connected
  useEffect(() => {
    if (isConnected && wcUri) {
      setWcUri(null);
    }
  }, [isConnected, wcUri]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setShowConnectors(false);
      }
    }
    if (showDropdown || showConnectors) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown, showConnectors]);

  const handleQRClose = () => {
    setWcUri(null);
    disconnect();
  };

  if (!isConnected) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowConnectors((prev) => !prev)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#C9A962] text-[#191817] text-sm font-semibold hover:bg-[#d4b86e] transition-colors cursor-pointer"
        >
          <Wallet className="h-4 w-4" />
          <span>Connect Wallet</span>
        </button>

        {showConnectors && (
          <div className="absolute right-0 mt-2 w-56 rounded-lg border border-[#383430] bg-[#232120] shadow-xl z-50 p-1">
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => {
                  if (connector.id === 'walletConnect') {
                    const handler = ({ type, data }: { type: string; data?: unknown }) => {
                      if (type === 'display_uri') {
                        setWcUri(data as string);
                      }
                    };
                    connector.emitter.on('message', handler);
                    connect(
                      { connector },
                      {
                        onSettled: () => connector.emitter.off('message', handler),
                        onError: () => setWcUri(null),
                      }
                    );
                  } else {
                    connect({ connector });
                  }
                  setShowConnectors(false);
                }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-foreground hover:bg-[#C9A96215] rounded-lg transition-colors cursor-pointer"
              >
                <Wallet className="h-4 w-4 text-[#C9A962]" />
                <span>{connector.name}</span>
              </button>
            ))}
          </div>
        )}

        <WalletConnectQRModal uri={wcUri} onClose={handleQRClose} />
      </div>
    );
  }

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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#C9A96230] bg-[#C9A96210] text-sm font-medium text-foreground hover:bg-[#C9A96220] transition-colors cursor-pointer"
      >
        <Wallet className="h-4 w-4 text-[#C9A962]" />
        <span>{shortenAddress(address!)}</span>
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
