"use client";
import dynamic from 'next/dynamic';
import { TuringShieldGate } from '@/components/auth/TuringShieldGate';
import { ChatEngineProvider } from '@/context/ChatEngineProvider';

const LedgerChat = dynamic(
  () => import('@/components/terminal/LedgerChatV2').then(m => ({ default: m.LedgerChat })),
  { ssr: false }
);

export default function ChatPage() {
  return (
    <TuringShieldGate>
      <ChatEngineProvider>
        <div className="hl-zoom-50-target flex flex-col w-full h-full flex-1 min-h-0 overflow-hidden bg-white">
          <LedgerChat forceAutoInit={true} />
        </div>
      </ChatEngineProvider>
    </TuringShieldGate>
  );
}
