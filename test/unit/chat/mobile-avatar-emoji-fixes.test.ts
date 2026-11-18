import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { drawsInColour } from '@/lib/chat/emojiSupport';

// 18 November 2026: own photo on every contact; Settings sections not opening on phones; the
// Emojis / Stickers / GIF tabs bunched to the left; emojis drawn as empty boxes; username change hidden.
const chat = readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
const settings = readFileSync('components/chat/LedgerSettingsFull.tsx', 'utf8');
const picker = readFileSync('components/chat/ExpressionPicker.tsx', 'utf8');
const profile = readFileSync('components/chat/profile/ProfileShare.tsx', 'utf8');

describe('avatars', () => {
  it('only your own avatar starts from your photo and listens to your settings', () => {
    const fn = chat.slice(chat.indexOf('function Avatar('), chat.indexOf('const shortAddr'));
    expect(fn).toMatch(/isMe\s*\n?\s*\? localStorage\.getItem\('ledger_avatar'\)/);
    expect(fn).toMatch(/if \(!isMe\) return;/);
  });
});

describe('settings on phones', () => {
  it('is pinned to the screen and measures the visible width', () => {
    expect(settings).toMatch(/phone \? 'fixed inset-0 z-\[1000\] w-screen h-\[100dvh\]'/);
    expect(settings).toMatch(/const w = Math\.min\(el\.clientWidth, screenW\);/);
  });
});

describe('emoji panel', () => {
  it('lays the three tabs out as three equal columns with a measured indicator', () => {
    expect(picker).toMatch(/gridTemplateColumns: 'repeat\(3, minmax\(0, 1fr\)\)'/);
    expect(picker).toMatch(/transform: `translateX\(\$\{pill\.left\}px\)`/);
  });
  it('passes the device emoji version to the picker', () => {
    expect(picker).toMatch(/emojiVersion=\{emojiVersion\}/);
  });
  it('a grey box is not a colour glyph; a coloured one is', () => {
    const fake = (rgba: number[]) => ({
      canvas: { width: 0, height: 0 },
      clearRect() {}, fillText() {},
      set textBaseline(_: string) {}, set font(_: string) {}, set fillStyle(_: string) {},
      getImageData: () => ({ data: new Uint8ClampedArray(Array.from({ length: 24 * 24 }, () => rgba).flat()) }),
    }) as unknown as CanvasRenderingContext2D;
    expect(drawsInColour('x', fake([90, 90, 90, 255]))).toBe(false);
    expect(drawsInColour('x', fake([250, 200, 40, 255]))).toBe(true);
  });
});

describe('username', () => {
  it('Change is a visible button next to the username', () => {
    expect(profile).toMatch(/data-testid="change-username"/);
  });
});

describe('tab bars keep their own layout', () => {
  it('the global tablist rule has zero specificity, so a grid tab bar stays a grid', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    expect(css).toMatch(/:where\(\.tab-row, \[role="tablist"\], nav\[class\*="flex"\]\) \{/);
    expect(css).not.toMatch(/^\[role="tablist"\],$/m);
    const sheet = readFileSync('components/chat/ThemePickerSheet.tsx', 'utf8');
    expect(sheet).toMatch(/display: 'grid', gridTemplateColumns: `repeat\(\$\{tabs\.length\}, minmax\(0, 1fr\)\)`, gap: 6/);
  });
});

