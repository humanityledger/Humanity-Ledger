/**
 * Phones: the chat is laid out at the phone's width, the keyboard never zooms or hides Send,
 * and nothing in the list is wider than the card.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { untranslated } from '../../helpers/untranslated';

const read = (p: string) => untranslated(fs.readFileSync(p, 'utf8'));

describe('chat on a phone', () => {
  it('the page is never laid out wider than the screen, and iOS keeps it so after Next.js rewrites the tag', () => {
    const layout = read('app/layout.tsx');
    expect(layout).toMatch(/minimumScale: 1,/);
    expect(layout).toMatch(/initial-scale=1, minimum-scale=1, viewport-fit=cover/);
    // Pinch zoom stays available (WCAG 1.4.4): the iOS tag never caps or disables it.
    const iosTag = layout.match(/var ci='([^']+)'/)?.[1] ?? '';
    expect(iosTag).not.toMatch(/maximum-scale|user-scalable=(no|0)/);
    expect(layout).toMatch(/new MutationObserver\(si\)\.observe\(document\.head/);
  });

  it('text fields are at least 16 px, so focusing one never zooms', () => {
    expect(read('app/globals.css')).toMatch(/input, textarea, select \{\s*font-size: 16px !important;/);
  });

  it('with the keyboard open, the chat fills exactly the visible part of the screen', () => {
    expect(read('components/chat/surface/ChatSurface.tsx')).toContain('<KeyboardViewport />');
    expect(read('components/layout/ClientLayout.tsx')).toContain("data-chat-root={isChat ? '' : undefined}");
    const css = read('app/globals.css');
    expect(css).toMatch(/html\.hl-kb-open \[data-chat-root\] \{[^}]*height: var\(--hl-vv-h, 100%\) !important;/);
  });

  it('shows the live millisecond count above Settings on the rail, and on a phone where that rail is hidden', () => {
    const chat = read('components/terminal/LedgerChatV2.tsx');
    const rail = chat.indexOf('aria-label="Ledger Chat"');
    const gear = chat.indexOf('aria-label="Settings"', rail);
    const reading = chat.indexOf('<LiveLatency />', rail);
    expect(reading).toBeGreaterThan(rail);
    expect(reading).toBeLessThan(gear);
    expect(chat).toContain('<LiveLatency className="md:hidden mr-1" />');
    const meter = read('components/chat/LiveLatency.tsx');
    expect(meter).toContain('flex-col');
    expect(meter).not.toContain('rounded-full');
    const src = read('lib/chat/liveRtt.ts');
    expect(src).not.toMatch(/navigator\.connection\b/);
    expect(src).toContain("credentials: 'omit'");
    expect(src).toContain("cache: 'no-store'");
  });

  it('the list beside the rail takes the remaining width, not the full width (nothing cut at the right)', () => {
    const chat = read('components/terminal/LedgerChatV2.tsx');
    expect(chat).toContain('w-full md:w-auto md:flex-1 md:min-w-0 lg:flex-none lg:w-96');
    expect(chat).not.toMatch(/ w-full lg:w-96 flex-col border-r/);
  });

  it('the chat is a full-bleed workspace on every screen: no floating card, no margins', () => {
    const page = read('components/chat/surface/ChatSurface.tsx');
    // 21 November 2026: the rounded card on a grey field is gone; the frame fills the window.
    expect(page).not.toMatch(/md:\[padding:clamp|max-w-\[1680px\]|md:max-h-\[min\(1100px/);
    expect(page).not.toMatch(/md:rounded-\[28px\]|md:shadow-/);
    expect(read('components/terminal/LedgerChatV2.tsx')).not.toMatch(/md:rounded-\[28px\] lg:rounded-\[32px\] md:border/);
    expect(page).not.toContain('aztec-wordmark');
  });

  it('rows slide only on touch screens; with a mouse, right click has the same actions', () => {
    expect(read('components/chat/SwipeableConversationRow.tsx')).toMatch(/drag=\{touch \? "x" : false\}/);
    const chat = read('components/terminal/LedgerChatV2.tsx');
    const menu = chat.slice(chat.indexOf('aria-label="Conversation actions"'));
    for (const label of ['Unpin', 'Mark as read', 'Unmute', 'Archive', 'Delete chat']) expect(menu).toContain(label);
  });
});
