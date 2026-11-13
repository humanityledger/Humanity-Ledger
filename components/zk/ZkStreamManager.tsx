'use client';

import React from 'react';
import { Waves, X } from 'lucide-react';
import { networkLabel } from '@/lib/aztec/wallet/config';

// Streams run through Agreements in a direct conversation (components/chat/AgreementComposer.tsx,
// lib/aztec/chat-agreements.ts). This panel points there; it creates nothing itself.

interface ZkStreamManagerProps {
  userAddress: string;
  userTag?: string;
  defaultRecipient?: string;
  onClose?: () => void;
  onStreamCreated?: (stream: unknown) => void;
  className?: string;
}

export function ZkStreamManager({ onClose, className = '' }: ZkStreamManagerProps) {
  return (
    <div className={`bg-white rounded-3xl border border-black/[0.08] shadow-xl overflow-hidden flex flex-col ${className}`}>
      <div className="bg-[#f2f4f7] px-6 py-4 flex items-center justify-between border-b border-black/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-[#15171c]/10 flex items-center justify-center text-[#15171c]">
            <Waves size={18} strokeWidth={2.5} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900 leading-tight">Payment streams</h2>
            <p className="text-[12.5px] text-gray-600">Opened from a direct conversation</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 text-gray-600 hover:text-gray-900 transition"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <div className="px-6 py-6 text-[14px] leading-relaxed text-gray-700 space-y-3">
        <p>
          To start a private payment stream, open a direct conversation, tap <span className="font-semibold">+</span>, choose{' '}
          <span className="font-semibold">Private agreement</span>, then <span className="font-semibold">Stream</span>. The stream runs in its own
          contract on {networkLabel()} and is proven on your device.
        </p>
        <p>The other person needs a verified Aztec address in that chat. The contracts have no external audit yet.</p>
      </div>
    </div>
  );
}
