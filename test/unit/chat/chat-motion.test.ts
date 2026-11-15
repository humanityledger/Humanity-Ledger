import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

// Ledger Chat motion, 15 Nov 2026. The "double jump": a sent bubble entered, then entered again when
// the message took its real id (React key change -> remount -> Framer Motion `initial` replayed).
const read = (p: string) => fs.readFileSync(p, 'utf8');
const list = read('components/chat/VirtualizedMessageList.tsx');
const bubble = read('components/chat/MessageBubble.tsx');
const chat = read('components/terminal/LedgerChatV2.tsx');
const css = read('app/globals.css');

describe('message entrance', () => {
  it('rows and bubbles are keyed by the stable render key, never by the id that changes on send', () => {
    expect(list).toMatch(/<MemoizedMessageRow\s+\/\/[^\n]*\n\s+key=\{renderKey\(msg\)\}/);
    expect(chat).toMatch(/<MessageBubble\s+key=\{renderKey\(msg\)\}/);
    expect(list).not.toMatch(/key=\{msg\.id\}/);
  });

  it('every path that confirms our message keeps the optimistic render key', () => {
    expect((chat.match(/adoptOptimistic\(prev\[(idx|optIdx|burnIdx)\]/g) ?? []).length).toBe(3);
    expect(chat).toMatch(/adopted\.set\(confirmed\.id, adoptOptimistic\(exactTwin, confirmed\)\)/);
    expect(chat).toMatch(/newConfirmed\.map\(c => adopted\.get\(c\.id\) \?\? c\)/);
  });

  it('is one CSS animation of transform and opacity, 160-200 ms, read once at mount', () => {
    expect(bubble).toMatch(/const \[entering, setEntering\] = useState\(enter\);/);
    expect(bubble).not.toMatch(/initial=\{isMe/);
    for (const name of ['hlMsgInMe', 'hlMsgInPeer']) {
      const kf = css.slice(css.indexOf(`@keyframes ${name}`), css.indexOf('}', css.indexOf('to ', css.indexOf(`@keyframes ${name}`))) + 1);
      expect(kf).toMatch(/opacity/);
      expect(kf).toMatch(/transform/);
      expect(kf).not.toMatch(/height|margin|top:|left:|width/);
    }
    const ms = [...css.matchAll(/animation: hlMsgIn(?:Me|Peer) (\d+)ms/g)].map((m) => Number(m[1]));
    expect(ms.length).toBe(2);
    for (const d of ms) expect(d >= 160 && d <= 200).toBe(true);
  });

  it('is decided once per key and never replays on a later remount; history does not animate', () => {
    expect(list).toMatch(/const ENTER_WINDOW_MS = \d+;/);
    expect(list).toMatch(/if \(msgTimeMs\(msg\) >= openedAtRef\.current - 1500\)/);
    expect(list).toMatch(/return at !== undefined && Date\.now\(\) - at < ENTER_WINDOW_MS;/);
  });

  it('only the list scrolls to a new message, once, before paint', () => {
    expect(chat).not.toMatch(/container\.scrollTo\(\{ top: container\.scrollHeight, behavior: 'smooth' \}\)/);
    expect(list).not.toMatch(/behavior: 'smooth'/);
  });
});

describe('presence and ticks without layout shift', () => {
  it('typing… lives in the fixed-height header line, not as a bubble under the list', () => {
    expect(chat).not.toMatch(/<TypingIndicator/);
    expect(chat).toMatch(/<PresenceLine\s+typing=/);
    expect(read('components/chat/PresenceLine.tsx')).toMatch(/h-\[18px\]/);
  });

  it('a typing signal restarts its own timer instead of racing an older one', () => {
    expect(chat).toMatch(/const old = timers\.get\(sender\);\s+if \(old\) clearTimeout\(old\);/);
    expect(chat).toMatch(/clearPeerTyping\(\(msg\.senderAddress \|\| ''\)\.toLowerCase\(\)\);/);
  });

  it('ticks: clock, one grey, two grey, two green, in one fixed box that cross-fades', () => {
    expect(bubble).toMatch(/w-\[18px\] h-\[14px\]/);
    expect(bubble).toMatch(/const two = status === 'delivered' \|\| status === 'read';/);
    expect(bubble).toMatch(/const read = status === 'read' && readReceipts;/);
    expect(bubble).toMatch(/text-\[#13a87a\]/);
  });

  it('receipts move status forward only and are not lost before the message has its real id', () => {
    expect(chat).toMatch(/status: strongerStatus\(m\.status, 'read'\)/);
    expect(chat).toMatch(/status: strongerStatus\(m\.status, 'delivered'\)/);
    expect(chat).toMatch(/noteReceipt\(readId, 'read'\);/);
  });
});
