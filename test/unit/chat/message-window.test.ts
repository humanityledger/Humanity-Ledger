import { readFileSync } from 'node:fs';

const list = readFileSync('components/chat/VirtualizedMessageList.tsx', 'utf8');
const chat = readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
const bubble = readFileSync('components/chat/MessageBubble.tsx', 'utf8');

describe('message list windowing', () => {
  it('mounts only the newest window and grows it towards older messages', () => {
    expect(list).toMatch(/export const MESSAGE_WINDOW = 60;/);
    expect(list).toMatch(/messages\.slice\(hiddenCount\)/);
    expect(list).toMatch(/new IntersectionObserver\(/);
    // The reader's place is kept when older messages are mounted above.
    expect(list).toMatch(/el\.scrollTop \+= el\.scrollHeight - anchorRef\.current/);
  });

  it('jumps to unmounted messages through the reveal event, never a bare getElementById scroll', () => {
    expect(list).toMatch(/REVEAL_MESSAGE_EVENT/);
    expect(chat).not.toMatch(/getElementById\(`msg-\$\{[^}]+\}`\)\s*;?\s*\n\s*el\?\.scrollIntoView/);
    expect(chat).toMatch(/onNavigate=\{\(msgId\) => revealMessage\(msgId\)\}/);
    expect(bubble).toMatch(/revealMessage\(replyMsg\.id/);
  });

  it('no spinning or pulsing status in the list; the composer sticks to the bottom with the safe area', () => {
    expect(list).not.toMatch(/animate-(spin|pulse|ping)/);
    expect(chat).toMatch(/className="sticky bottom-0 shrink-0 bg-white border-t border-\[#e4e7ec\] z-10"\s*\n\s*style=\{\{ paddingBottom: `max\(8px, env\(safe-area-inset-bottom, 0px\)\)` \}\}/);
  });
});
