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
    <div className="flex-1 w-full h-full min-h-[400px] flex items-center justify-center bg-white md:bg-[#f7f8fa]">
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
        {/* Ledger Chat is a workspace: it fills the window on every screen, edge to edge, with
            hairlines between its columns (21 November 2026). The floating rounded card on a grey
            field (18 November 2026) read as a consumer app; a full-bleed frame is what people who
            work in a messenger all day expect, and it gives the conversation the width. */}
        <div
          data-chat-page="true"
          className="relative flex flex-col w-full h-full flex-1 min-h-0 overflow-hidden bg-white"
          style={{ height: '100%', minHeight: '100%', flex: '1 1 0%' }}
        >
          <div data-glyph-anchor className="relative z-[1] flex flex-col w-full h-full flex-1 min-h-0">
            <LedgerChat forceAutoInit={true} surfaceVisible={visible} onRequestVisible={onRequestVisible} />
          </div>
        </div>
      </ChatEngineProvider>
    </TuringShieldGate>
  );
}
