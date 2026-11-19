"use client";
import dynamic from 'next/dynamic';
import { TuringShieldGate } from '@/components/auth/TuringShieldGate';
import { useVisitBeacon } from '@/lib/stats/useVisitBeacon';
import { ChatEngineProvider } from '@/context/ChatEngineProvider';
import { KeyboardViewport } from '@/components/layout/KeyboardViewport';
import { BootMark } from '@/components/layout/BootMark';
import { useEffect, useState } from 'react';

// /chat?debug=delivery shows this browser's delivery events (lib/xmtp/diag.ts), for a report.
const DeliveryDebugPanel = dynamic(() => import('@/components/chat/DeliveryDebugPanel'), { ssr: false });
function useDebugDelivery() {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(new URLSearchParams(window.location.search).get('debug') === 'delivery'); }, []);
  return on;
}

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

/**
 * The chat surface: everything /chat used to render. ChatKeepAlive mounts it from the root layout
 * so a live call (its engine is inside LedgerChat) survives leaving /chat; off /chat it is hidden
 * and the call shows in the floating window or the island.
 */
export function ChatSurface({ visible, onRequestVisible }: { visible: boolean; onRequestVisible: () => void }) {
  // Counts this browser once a day for the live map on the landing page (lib/stats).
  useVisitBeacon();
  const debugDelivery = useDebugDelivery();
  if (SettingsHarness && harnessOn()) return <SettingsHarness />;
  return (
    <TuringShieldGate>
      {/* Only the chat on screen follows the keyboard; hidden, it must not resize other pages. */}
      {visible && <KeyboardViewport />}
      {debugDelivery && <DeliveryDebugPanel />}
      <ChatEngineProvider>
        {/* On desktop Ledger Chat floats as a rounded card on a plain, light background; on phones it
            fills the screen. The margin around the card follows the window (clamp on vw and vh), so
            zooming in or out never squeezes the card or pushes it off screen: past 768 px of CSS width
            (about 250 % zoom on a laptop) it becomes the full-screen phone layout. The card is wider
            than before (up to 1680 px). The small Aztec wordmark above it was removed (18 November 2026). */}
        <div
          data-chat-page="true"
          className="relative flex flex-col w-full h-full flex-1 min-h-0 overflow-hidden bg-white md:bg-[#f4f6fa] md:[padding:clamp(12px,3vh,56px)_clamp(16px,3.2vw,72px)]"
          style={{ height: '100%', minHeight: '100%', flex: '1 1 0%' }}
        >
          <div data-glyph-anchor className="relative z-[1] flex flex-col w-full h-full flex-1 min-h-0 max-w-[1680px] md:max-h-[min(1100px,100dvh)] mx-auto md:my-auto md:shadow-[0_24px_70px_-16px_rgba(16,24,40,0.22)]">
            <LedgerChat forceAutoInit={true} surfaceVisible={visible} onRequestVisible={onRequestVisible} />
          </div>
        </div>
      </ChatEngineProvider>
    </TuringShieldGate>
  );
}
