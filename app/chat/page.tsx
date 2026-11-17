"use client";
import dynamic from 'next/dynamic';
import { TuringShieldGate } from '@/components/auth/TuringShieldGate';
import { ChatEngineProvider } from '@/context/ChatEngineProvider';
import { KeyboardViewport } from '@/components/layout/KeyboardViewport';

function ChatLoading() {
  return (
    <div className="flex-1 w-full h-full min-h-[400px] flex items-center justify-center bg-white md:rounded-[28px] lg:rounded-[32px] md:border md:border-black/[0.08] md:shadow-lg" role="status" aria-label="Loading Ledger Chat">
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
      <KeyboardViewport />
      <ChatEngineProvider>
        {/* On desktop Ledger Chat floats as a rounded card on a plain, light background, with the
            Aztec wordmark set small at the top of the page. On phones the chat fills the screen. */}
        <div
          data-chat-page="true"
          className="relative flex flex-col w-full h-full flex-1 min-h-0 overflow-hidden bg-white md:bg-[#f4f6fa] md:p-[50px] lg:p-[75px] xl:p-[95px] 2xl:p-[120px]"
          style={{ height: '100%', minHeight: '100%', flex: '1 1 0%' }}
        >
          <a
            href="https://aztec.network"
            target="_blank"
            rel="noopener noreferrer"
            title="Private payments on Aztec Network"
            className="hidden md:block absolute left-1/2 -translate-x-1/2 top-[18px] lg:top-[28px] z-[2] opacity-60 hover:opacity-90 transition-opacity rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black/40"
          >
            <img src="/brand/aztec/aztec-wordmark-ink.svg" alt="Built on Aztec" width={62} height={14} draggable={false} style={{ display: 'block', height: 14, width: 'auto' }} />
          </a>
          <div data-glyph-anchor className="relative z-[1] flex flex-col w-full h-full flex-1 min-h-0 max-w-[1360px] md:max-h-[calc(100vh-140px)] mx-auto md:my-auto md:shadow-[0_24px_70px_-16px_rgba(16,24,40,0.22)]">
            <LedgerChat forceAutoInit={true} />
          </div>
        </div>
      </ChatEngineProvider>
    </TuringShieldGate>
  );
}
