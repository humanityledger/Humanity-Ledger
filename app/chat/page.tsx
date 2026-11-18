"use client";
import dynamic from 'next/dynamic';
import { TuringShieldGate } from '@/components/auth/TuringShieldGate';
import { useVisitBeacon } from '@/lib/stats/useVisitBeacon';
import { ChatEngineProvider } from '@/context/ChatEngineProvider';
import { KeyboardViewport } from '@/components/layout/KeyboardViewport';
import { BootMark } from '@/components/layout/BootMark';

// Test builds only (NEXT_PUBLIC_E2E_HARNESS=1, inlined at build): /chat?e2e=settings mounts Settings
// alone for the WebKit and Chromium test (scripts/ui/settings-webkit.mjs). Absent from production.
const E2E = process.env.NEXT_PUBLIC_E2E_HARNESS === '1';
const SettingsHarness = E2E ? dynamic(() => import('@/components/chat/e2e/SettingsHarness'), { ssr: false }) : null;
// Decided during render, not in an effect: TuringShieldGate's effect would run first and send a
// visitor without a session to /connect before an effect here could switch.
const harnessOn = () => E2E && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('e2e') === 'settings';

// The same mark as the PIN check before it and the channel screen after it (BootMark).
function ChatLoading() {
  return (
    <div className="flex-1 w-full h-full min-h-[400px] flex items-center justify-center bg-white md:rounded-[28px] lg:rounded-[32px] md:border md:border-black/[0.08] md:shadow-lg">
      <BootMark />
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
  // Counts this browser once a day for the live map on the landing page (lib/stats).
  useVisitBeacon();
  if (SettingsHarness && harnessOn()) return <SettingsHarness />;
  return (
    <TuringShieldGate>
      <KeyboardViewport />
      <ChatEngineProvider>
        {/* On desktop Ledger Chat floats as a rounded card on a plain, light background; on phones
            the chat fills the screen. */}
        <div
          data-chat-page="true"
          className="relative flex flex-col w-full h-full flex-1 min-h-0 overflow-hidden bg-white md:bg-[#f4f6fa] md:p-[50px] lg:p-[75px] xl:p-[95px] 2xl:p-[120px]"
          style={{ height: '100%', minHeight: '100%', flex: '1 1 0%' }}
        >
          <div data-glyph-anchor className="relative z-[1] flex flex-col w-full h-full flex-1 min-h-0 max-w-[1360px] md:max-h-[calc(100vh-140px)] mx-auto md:my-auto md:shadow-[0_24px_70px_-16px_rgba(16,24,40,0.22)]">
            <LedgerChat forceAutoInit={true} />
          </div>
        </div>
      </ChatEngineProvider>
    </TuringShieldGate>
  );
}
