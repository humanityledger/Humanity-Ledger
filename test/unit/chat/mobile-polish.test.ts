/** 18 November 2026: settings on phones, swipe actions, emoji panel, chat safe areas. */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('mobile polish', () => {
  it('Settings decides one or two panes from its own width, not from the md: breakpoint', () => {
    const s = read('components/chat/LedgerSettingsFull.tsx');
    expect(s).toContain('const [wide, setWide] = useState(false);');
    expect(s).toContain('new ResizeObserver(update)');
    // The visible width decides (the panel can sit in a container wider than a phone's screen).
    expect(s).toContain("setWide(w >= 768 && !(coarse && screenW < 1024));");
    expect(s).not.toMatch(/'hidden'\} md:flex/);
    expect(s).not.toContain('md:hidden shrink-0 flex items-center gap-2');
  });

  it('swipe actions have no black capsule behind them', () => {
    const s = read('components/chat/SwipeableConversationRow.tsx');
    expect(s).not.toContain('bg-[#111216]');
  });

  it('the emoji panel shows no category bar or titles', () => {
    const css = read('app/globals.css');
    expect(css).toContain('.ledger-emoji .epr-category-nav');
    expect(css).toContain('.ledger-emoji .epr-emoji-category-label');
  });

  it('on phones the chat page is white edge to edge and body adds no second bottom inset', () => {
    const css = read('app/globals.css');
    expect(css).toMatch(/body:has\(\[data-chat-page\]\) \{\s*padding-bottom: 0;/);
    expect(read('components/chat/surface/ChatSurface.tsx')).toContain('data-chat-page="true"');
  });

  it('a wallet code opens the chat and offers to save the contact', () => {
    const s = read('components/terminal/LedgerChatV2.tsx');
    expect(s).toContain('walletAddressFromQr(text)');
    expect(s).toContain('setShowSaveContactModal(true);');
  });
});
