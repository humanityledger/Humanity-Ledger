'use client';

import React from 'react';
import { Waves, X } from 'lucide-react';

// The previous version created "shielded payment streams" in localStorage with
// a Math.random transaction hash: no tokens moved and nothing reached Aztec,
// but the UI showed live streaming balances. The PaymentStream contract
// (contracts/aztec/streams) is compiled and has TXE tests, but it is not
// deployed and no client calls it yet, so this panel says so instead.
// Master prompt: DoD "zero fake ZK in the UI".

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
            <p className="text-[12.5px] text-gray-600">Not available yet</p>
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
          Private payment streams are not available yet. The stream contract is written and tested on a local Aztec
          environment, but it is not deployed to the Aztec test network and this app does not call it.
        </p>
        <p>You can send a private one-off payment from the chat; it runs on the Aztec test network.</p>
      </div>
    </div>
  );
}
