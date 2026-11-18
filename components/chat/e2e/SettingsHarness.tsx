'use client';
/**
 * Test-only: Settings mounted alone inside the same containers as /chat (page wrapper, card,
 * LedgerChatV2's column), so Playwright can open every section in WebKit and Chromium without a
 * wallet session. Reachable only in builds with NEXT_PUBLIC_E2E_HARNESS=1, at /chat?e2e=settings.
 */
import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { LedgerSettingsFull } from '@/components/chat/LedgerSettingsFull';

export default function SettingsHarness() {
  return (
    <div
      data-chat-page="true"
      className="relative flex flex-col w-full h-full flex-1 min-h-0 overflow-hidden bg-white md:bg-[#f4f6fa] md:p-[50px] lg:p-[75px] xl:p-[95px] 2xl:p-[120px]"
      style={{ height: '100%', minHeight: '100%', flex: '1 1 0%' }}
    >
      <div data-glyph-anchor className="relative z-[1] flex flex-col w-full h-full flex-1 min-h-0 max-w-[1360px] md:max-h-[calc(100vh-140px)] mx-auto md:my-auto md:shadow-[0_24px_70px_-16px_rgba(16,24,40,0.22)]">
        <div className="flex flex-col h-full w-full min-h-0 overflow-hidden">
          <AnimatePresence>
            <LedgerSettingsFull key="ledger-settings-full" myAddress="0x00000000000000000000000000000000000000e2" myName="Harness" onClose={() => undefined} />
          </AnimatePresence>
          <div className="relative flex flex-row flex-1 min-h-0 w-full h-full overflow-hidden md:rounded-[28px] lg:rounded-[32px] bg-white" />
        </div>
      </div>
    </div>
  );
}
