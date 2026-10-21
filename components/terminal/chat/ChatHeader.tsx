'use client';
import React from 'react';
import { HLLogo } from '@/components/shared/HLLogo';

export function ChatHeader({ peerAddress }: { peerAddress?: string }) {
  return (
    <header className="h-14 border-b border-neutral-200 px-4 flex items-center justify-between bg-white">
      <div className="flex items-center gap-3">
        <HLLogo variant="mark" size={26} />
        <span className="font-bold text-sm tracking-tight">{peerAddress ? `${peerAddress.slice(0, 6)}...${peerAddress.slice(-4)}` : 'Chat'}</span>
      </div>
    </header>
  );
}
