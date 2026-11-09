"use client";
import dynamic from 'next/dynamic';
import { TuringShieldGate } from '@/components/auth/TuringShieldGate';
import { ChatEngineProvider } from '@/context/ChatEngineProvider';
import { ImmersiveField } from '@/components/immersive/ImmersiveField';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';

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
  useKeyboardInset();
  return (
    <TuringShieldGate>
      <ChatEngineProvider>
        {/* On desktop screens Ledger Chat floats as an elegant rounded card
            over the living ImmersiveField wallpaper with a wide 5 cm (~100-140px)
            interactive perimeter where the cursor lights up dots in blue;
            on mobile phones it fills the display completely. */}
        <div
          data-chat-page="true"
          className="relative flex flex-col w-full h-full flex-1 min-h-0 overflow-hidden bg-white md:bg-transparent max-md:pb-[var(--keyboard-inset,0px)] max-md:transition-[padding] max-md:duration-150 max-md:ease-out md:p-[50px] lg:p-[75px] xl:p-[95px] 2xl:p-[120px]"
          style={{ height: '100%', minHeight: '100%', flex: '1 1 0%' }}
        >
          <div className="hidden md:block">
            <ImmersiveField variant="app" />
          </div>
          <div className="relative z-[1] flex flex-col w-full h-full flex-1 min-h-0 max-w-[1360px] max-h-[calc(100vh-140px)] mx-auto my-auto shadow-[0_24px_70px_-16px_rgba(16,24,40,0.22)]">
            <LedgerChat forceAutoInit={true} />
          </div>
        </div>
      </ChatEngineProvider>
    </TuringShieldGate>
  );
}
