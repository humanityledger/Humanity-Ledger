/** Settings on pure white; chat rows: lock only on direct messages, ticks only for your last message. */
import fs from 'node:fs';
import { rowTickGlyph } from '@/components/chat/ChatRowMeta';

describe('chat row ticks', () => {
  it('maps every send state to one glyph, and unknown to none', () => {
    expect(rowTickGlyph('sending', true)).toBe('clock');
    expect(rowTickGlyph('sent', true)).toBe('one');
    expect(rowTickGlyph('delivered', true)).toBe('two');
    expect(rowTickGlyph('read', true)).toBe('read');
    expect(rowTickGlyph('read', false)).toBe('two');
    expect(rowTickGlyph(undefined, true)).toBeNull();
  });
});

describe('wiring', () => {
  const v2 = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
  it('the lock is gated on a direct-message peer', () => {
    expect(v2).toMatch(/rowIsDm && <RowLock \/>/);
    expect(v2).toMatch(/const rowIsDm = \/\^0x\[0-9a-f\]\{40\}\$\/i\.test\(conv\.peerAddress\)/);
  });
  it('ticks need the last message to be yours', () => {
    expect(v2).toMatch(/lastMine = myInbox && m\.senderInboxId\?\.toLowerCase\(\) === myInbox/);
  });
  it('row glyphs are in-house SVG, not an icon library', () => {
    expect(fs.readFileSync('components/chat/ChatRowMeta.tsx', 'utf8')).not.toMatch(/lucide|heroicons|material/i);
  });
  it('Settings has no grey fill surfaces', () => {
    const s = fs.readFileSync('components/chat/LedgerSettingsFull.tsx', 'utf8');
    expect(s).not.toMatch(/(?<![:\w-])bg-\[#(?:f2f4f7|f4f5f7|f7f8fa|eef0f3)\]/);
  });
});
