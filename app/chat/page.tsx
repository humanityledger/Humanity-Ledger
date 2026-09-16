"use client";
import dynamic from 'next/dynamic';
import { ChatEngineProvider } from '@/context/ChatEngineProvider';

const LedgerChat = dynamic(
  () => import('@/components/terminal/LedgerChat').then(m => ({ default: m.LedgerChat })),
  { ssr: false }
);

export default function ChatPage() {
  return (
    <ChatEngineProvider>
      <div className="flex flex-col w-full h-[100dvh] min-h-0 overflow-hidden bg-white">
        <LedgerChat forceAutoInit={true} />
      </div>
    </ChatEngineProvider>
  );
}
