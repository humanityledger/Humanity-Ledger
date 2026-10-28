"use client";
import dynamic from 'next/dynamic';
import { TuringShieldGate } from '@/components/auth/TuringShieldGate';
import { ChatEngineProvider } from '@/context/ChatEngineProvider';

function ChatLoading() {
  return (
    <div className="flex-1 w-full h-full min-h-[400px] flex items-center justify-center bg-white" role="status" aria-label="Loading Ledger Chat">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#f7f8fa] border border-black/[0.06] flex items-center justify-center shadow-sm">
          <img src="/worldmap.png" alt="Humanity Ledger" className="w-8 h-8 object-contain opacity-85" />
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-[#15171c]/30 animate-pulse"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const LedgerChat = dynamic(
  () => import('@/components/terminal/LedgerChatV2').then(m => ({ default: m.LedgerChat })),
  {
    ssr: false,
    loading: () => <ChatLoading />,
  }
);

export default function ChatPage() {
  return (
    <TuringShieldGate>
      <ChatEngineProvider>
        <div className="hl-zoom-67-target flex flex-col w-full h-full flex-1 min-h-0 overflow-hidden bg-white">
          <LedgerChat forceAutoInit={true} />
        </div>
      </ChatEngineProvider>
    </TuringShieldGate>
  );
}
