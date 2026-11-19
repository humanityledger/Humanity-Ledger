/**
 * Phones: the chat is laid out at the phone's width, the keyboard never zooms or hides Send,
 * and nothing in the list is wider than the card.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('chat on a phone', () => {
  it('the page is never laid out wider than the screen, and iOS keeps it so after Next.js rewrites the tag', () => {
    const layout = read('app/layout.tsx');
    expect(layout).toMatch(/minimumScale: 1,/);
    expect(layout).toMatch(/initial-scale=1, minimum-scale=1, maximum-scale=1, viewport-fit=cover, shrink-to-fit=no/);
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

  it('the card frame is for wide screens only: on a phone the chat fills the screen', () => {
    const page = read('components/chat/surface/ChatSurface.tsx');
    // The card's limits and margins apply from md up only; the margins follow the window, so zoom
    // never pushes the card off screen.
    expect(page).toContain('md:max-h-[min(1100px,100dvh)]');
    expect(page).toContain('md:[padding:clamp(12px,3vh,56px)_clamp(16px,3.2vw,72px)]');
    expect(page).toContain('max-w-[1680px]');
    expect(page).not.toMatch(/ max-h-\[min\(1100px/);
    expect(page).not.toContain('aztec-wordmark');
  });

  it('rows slide only on touch screens; with a mouse, right click has the same actions', () => {
    expect(read('components/chat/SwipeableConversationRow.tsx')).toMatch(/drag=\{touch \? "x" : false\}/);
    const chat = read('components/terminal/LedgerChatV2.tsx');
    const menu = chat.slice(chat.indexOf('aria-label="Conversation actions"'));
    for (const label of ['Unpin', 'Mark as read', 'Unmute', 'Archive', 'Delete chat']) expect(menu).toContain(label);
  });
});
