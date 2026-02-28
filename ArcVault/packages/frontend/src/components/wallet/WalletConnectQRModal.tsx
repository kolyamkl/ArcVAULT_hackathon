'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Modal } from '@/components/shared/Modal';

interface WalletConnectQRModalProps {
  uri: string | null;
  onClose: () => void;
}

export function WalletConnectQRModal({ uri, onClose }: WalletConnectQRModalProps) {
  return (
    <Modal isOpen={!!uri} onClose={onClose} title="WalletConnect">
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-muted">Scan with your mobile wallet</p>
        <div className="bg-white p-4 rounded-xl">
          <QRCodeSVG value={uri ?? ''} size={250} />
        </div>
        <button
          onClick={onClose}
          className="w-full px-4 py-2.5 text-sm text-muted hover:text-foreground border border-[#383430] rounded-lg transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
