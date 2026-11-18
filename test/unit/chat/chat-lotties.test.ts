/**
 * The four chat animations: where each one appears, and that the files are valid Lottie JSON
 * with no images and no expressions (nothing fetched or evaluated beyond the JSON itself).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('chat animations', () => {
  for (const f of ['new-conversation-chit-chatting', 'peer-typing', 'send-confirmation', 'send-confirmation-plane', 'welcome-notification']) {
    it(`${f}.json is a self-contained Lottie`, () => {
      const raw = read(`public/lottie/${f}.json`);
      const a = JSON.parse(raw);
      expect(typeof a.v).toBe('string');
      expect(a.w).toBeGreaterThan(0);
      expect(a.op).toBeGreaterThan(a.ip);
      expect((a.assets ?? []).filter((x: any) => typeof x.p === 'string' && !x.layers)).toEqual([]);
      expect(raw).not.toMatch(/"x":\s*"/);
    });
  }

  it('the new-conversation animation shows only while the conversation has no message', () => {
    const chat = read('components/terminal/LedgerChatV2.tsx');
    const at = chat.indexOf('<NewConversationLottie />');
    expect(at).toBeGreaterThan(0);
    const before = chat.slice(0, at);
    expect(before.lastIndexOf('if (filteredMsgs.length === 0) {')).toBeGreaterThan(before.lastIndexOf('<VirtualizedMessageList'));
    // An optimistic message counts: it is in filteredMsgs as soon as it is sent.
    expect((chat.match(/<NewConversationLottie \/>/g) || []).length).toBe(1);
    // It enters with an animation each time a chat is empty, including right after Clear chat.
    expect(chat).toMatch(/key=\{`new-\$\{activePeer\}`\}[^>]*data-testid="new-conversation"/);
    expect(chat).toContain('hl-empty-enter');
    const art = JSON.parse(read('public/lottie/new-conversation-chit-chatting.json'));
    expect([art.w, art.h, art.fr, art.op]).toEqual([350, 230, 60, 156]);
  });

  it('the typing animation shows in the thread and the header while the other person writes', () => {
    const list = read('components/chat/VirtualizedMessageList.tsx');
    expect(list).toMatch(/\{isTyping && \([\s\S]*<PeerTypingLottie \/>/);
    const chat = read('components/terminal/LedgerChatV2.tsx');
    expect(chat).toMatch(/isTyping=\{peerStatus\.isTyping \|\| \(!!activePeer && typingPeers\.has\(activePeer\.toLowerCase\(\)\)\)\}/);
    expect(read('components/chat/PresenceLine.tsx')).toMatch(/typing \? <PeerTypingLottie size="inline" \/>/);
  });

  it('the send confirmation plays once per message that goes out, after the rate limit', () => {
    const chat = read('components/terminal/LedgerChatV2.tsx');
    const send = chat.slice(chat.indexOf('const handleSend = async'), chat.indexOf('let txt = inputText.trim();', chat.indexOf('const handleSend = async')));
    expect(send.indexOf('setSendAnimKey(k => k + 1)')).toBeGreaterThan(send.indexOf('rl.timestamps.push(now)'));
    expect(chat).toContain('<SendConfirmationBurst burst={sendAnimKey}');
    const lottie = read('components/chat/ChatLottie.tsx');
    expect(lottie).toMatch(/loop=\{false\} onComplete=\{\(\) => setShown\(0\)\}/);
    expect(lottie).toMatch(/if \(!\(burst > 0\) \|\| reduced\) return;\s*setShown\(burst\);/);
    // Drawn for this button: one file per button shape, the same size as the button, fetched ahead of the first send.
    expect(lottie).toMatch(/src=\{wide \? LOTTIE\.SEND_CONFIRMATION_WIDE : LOTTIE\.SEND_CONFIRMATION\} width=\{size\} height=\{size\}/);
    expect(chat).toContain('preloadSendConfirmation()');
    for (const f of ['send-confirmation', 'send-confirmation-plane']) {
      const a = JSON.parse(read(`public/lottie/${f}.json`));
      expect([a.w, a.h, a.fr, a.op]).toEqual([96, 96, 60, 54]);
    }
  });

  it('the welcome animation is on the Ledger Chat home and the empty list', () => {
    const chat = read('components/terminal/LedgerChatV2.tsx');
    expect((chat.match(/<WelcomeLottie \/>/g) || []).length).toBe(2);
  });
});
