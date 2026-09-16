"use client";
import dynamic from 'next/dynamic';

// We bypass the old ChatEngineProvider and LedgerChat because they threw Module Errors.
// Phase 2: Loading the new 100% On-Chain Ledger Chat interface connected to the Humanity Appchain.
const LedgerChatOnChain = dynamic(
  () => import('@/components/terminal/LedgerChatOnChain').then(m => ({ default: m.LedgerChatOnChain })),
  { ssr: false }
);

export default function ChatPage() {
  return (
    <div className="flex flex-col w-full h-full min-h-0 overflow-hidden bg-[#F6F7F9]">
      <LedgerChatOnChain />
    </div>
  );
}