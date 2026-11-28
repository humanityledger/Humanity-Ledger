/**
 * Phones: the chat is laid out at the phone's width, the keyboard never zooms or hides Send,
 * and nothing in the list is wider than the card.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { untranslated } from '../../helpers/untranslated';

const read = (p: string) => untranslated(fs.readFileSync(p, 'utf8'));

describe('chat on a phone', () => {
  it('the page is never laid out wider than the screen, and the tag is kept after Next.js rewrites it', () => {
    const layout = read('app/layout.tsx');
    expect(layout).toMatch(/minimumScale: 1,/);
    expect(layout).toContain("var base='width=device-width, initial-scale='+scale+', minimum-scale='+scale+', viewport-fit=cover'");
    // Safari with a wallet extension (window.ethereum) is not a wallet's own browser: normal size there.
    expect(layout).toContain('var wallet=!!(named||(window.ethereum&&!ios));');
    expect(layout).toMatch(/new MutationObserver\(onHead\)\.observe\(document\.head/);
    // The tag Next.js renders never caps zoom: Lighthouse and desktop browsers see pinch zoom on.
    const start = layout.indexOf('export const viewport');
    const exported = layout.slice(start, layout.indexOf('\n}', start)).replace(/\/\/[^\n]*/g, '');
    expect(exported).not.toMatch(/maximumScale|userScalable/);
  });

  it('typing never zooms: iOS caps the focus zoom (pinch still works there), Android only while a field is in use', () => {
    const layout = read('app/layout.tsx');
    // iOS: maximum-scale equal to the initial scale, always. Safari ignores it for pinch zoom since iOS 10.
    expect(layout).toContain('var locked=ios;');
    expect(layout).toContain("var tag=function(){return base+(locked?', maximum-scale='+scale:'')};");
    // Android: locked from the touch that focuses a text field until focus leaves it.
    expect(layout).toContain("document.addEventListener('touchstart',on,{capture:true,passive:true});");
    expect(layout).toContain("document.addEventListener('focusout',off,true);");
    expect(layout).not.toMatch(/user-scalable=(no|0)/);
  });

  it('what you type is sent as typed, never passed through the translator', () => {
    expect(read('components/terminal/LedgerChatV2.tsx')).toContain('setInputText(val);');
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

describe('phones: zoom, one pane, and Back', () => {
  const layout = () => read('app/layout.tsx');
  it('pinch zoom can never stay locked after typing (Android/WebViews)', () => {
    const l = layout();
    expect(l).toContain("var chk=function(){if(locked&&!editable(document.activeElement)){locked=false;si()}};");
    expect(l).toContain("document.addEventListener('touchend',arm,{capture:true,passive:true});");
    expect(l).toContain("document.addEventListener('visibilitychange',chk);");
    expect(l).toContain("window.visualViewport.addEventListener('resize'");
  });

  it('the device class comes from the physical screen, before the first paint', () => {
    const l = layout();
    expect(l).toContain("de.setAttribute('data-hl-device',d)");
    expect(l).toMatch(/sw<768\)\|\|\(coarse&&screen\.width<1024\)\?'phone'/);
    const lib = read('lib/layout/mobileViewport.ts');
    expect(lib).toContain('export function classifyDevice(');
  });

  it('a phone never shows the rail or two panes side by side, whatever width Safari lays out', () => {
    const css = read('app/glassmorphism.css');
    expect(css).toMatch(/html\[data-hl-device="phone"\] \.hidden\.md\\:flex/);
    expect(css).toMatch(/html\[data-hl-device="phone"\] \.hidden\.lg\\:flex/);
    expect(css).toContain('html[data-hl-device="phone"] [data-hl-rail]');
    expect(read('components/terminal/LedgerChatV2.tsx')).toContain('data-hl-rail className="lg-bar hidden md:flex w-[76px]');
  });

  it('every editable field is 16 px on touch screens, contenteditable included', () => {
    const css = read('app/glassmorphism.css');
    expect(css).toMatch(/@media \(pointer: coarse\) \{[^}]*\[contenteditable\]:not\(\[contenteditable="false"\]\) \{\s*font-size: 16px !important;/);
  });

  it('swipe-back and Android Back close one layer at a time', () => {
    const hook = read('hooks/useMobileBackStack.ts');
    expect(hook).toContain("window.addEventListener('popstate', onPopState);");
    expect(hook).toContain('window.history.pushState({ ...prev, hlDepth: d }');
    const chat = read('components/terminal/LedgerChatV2.tsx');
    expect(chat).toContain("useBackLayer(sidebarTab !== 'communities' && !showList, () => setShowList(true), compactLayout);");
    expect(chat).toContain('useBackLayer(showContactInfo, () => setShowContactInfo(false), compactLayout);');
  });

  it('the keyboard closing puts a bounded page back at its origin', () => {
    expect(read('components/layout/KeyboardViewport.tsx')).toContain('settle = window.setTimeout(resetBoundedScroll, 180);');
  });
});
