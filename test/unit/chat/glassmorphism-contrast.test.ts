/**
 * Liquid Porcelain Glass (app/glassmorphism.css): every material keeps text readable (WCAG AA
 * ≥ 4.5:1 for body and secondary ink, ≥ 7:1 for primary ink), with fallbacks for reduced
 * transparency and browsers without backdrop-filter, and blur stays off list rows.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const css = fs.readFileSync('app/glassmorphism.css', 'utf8');

type RGB = [number, number, number];
const hex = (h: string): RGB => { const v = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as RGB; };
const lum = ([r, g, b]: RGB) => {
  const c = [r, g, b].map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: RGB, b: RGB) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const over = (top: [number, number, number, number], under: RGB): RGB =>
  [0, 1, 2].map((i) => Math.round(top[i] * top[3] + under[i] * (1 - top[3]))) as RGB;
const token = (name: string): [number, number, number, number] => {
  const m = css.match(new RegExp(`--${name}:\\s*rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([\\d.]+)\\)`));
  if (!m) throw new Error(`missing token ${name}`);
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
};

describe('Liquid Porcelain Glass', () => {
  const white: RGB = [255, 255, 255];
  // Worst realistic backdrop behind the glass in the chat: a mid-grey bubble or photo edge.
  const grey: RGB = [200, 203, 208];
  const ink = hex('#15171c'), ink2 = hex('#2c2e33'), soft = hex('#4a505c'), mute = hex('#5b606b');

  it('primary ink ≥ 7:1 and secondary ink ≥ 4.5:1 on every light material', () => {
    for (const name of ['lg-surface-1', 'lg-dock', 'lg-composer', 'lg-sheet']) {
      for (const under of [white, grey]) {
        const bg = over(token(name), under);
        expect(ratio(ink, bg), `${name} ink`).toBeGreaterThanOrEqual(7);
        expect(ratio(soft, bg), `${name} soft`).toBeGreaterThanOrEqual(4.5);
      }
      expect(ratio(mute, over(token(name), white)), `${name} mute`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the active capsule keeps its label readable', () => {
    const bg = over(token('lg-active-capsule'), over(token('lg-dock'), white));
    expect(ratio(ink, bg)).toBeGreaterThanOrEqual(7);
    expect(ratio(ink2, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('white text on obsidian ink glass ≥ 7:1, even over white', () => {
    expect(ratio(white, over(token('lg-ink-glass'), white))).toBeGreaterThanOrEqual(7);
  });

  it('has fallbacks for reduced transparency, no backdrop-filter and iOS', () => {
    expect(css).toContain('@media (prefers-reduced-transparency: reduce)');
    expect(css).toContain('@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))');
    expect(css).toContain('@supports (-webkit-touch-callout: none)');
    expect(css).not.toMatch(/will-change:\s*(transform|backdrop-filter)/);
    // Rows of the virtualised list never get a backdrop-filter (Hyperion).
    expect(css).not.toMatch(/\.hl-row[^{]*\{[^}]*backdrop-filter/);
  });

  it('the dock replicates Chats | Calls | Stories with a gliding capsule and a Communities orb', () => {
    const nav = fs.readFileSync('components/chat/CrystalNavBar.tsx', 'utf8');
    expect(nav).toContain("{ id: 'chats', label: 'Chats'");
    expect(nav).toContain("{ id: 'calls', label: 'Calls'");
    expect(nav).toContain("{ id: 'updates', label: 'Stories'");
    expect(nav).toContain('layoutId="lg-dock-capsule"');
    expect(nav).toContain("onClick={() => onTabChange('communities')}");
    expect(nav).not.toContain('h-[2px]');
  });

  it('the composer is a + orb and a message pill with sticker, camera and microphone', () => {
    const chat = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
    expect(chat).toContain('lg-orb w-[46px] h-[46px]');
    expect(chat).toContain('<StickerIcon size={22} strokeWidth={1.9} />');
    expect(chat).toContain('<CameraIcon size={22} strokeWidth={1.9} />');
    expect(chat).toContain('<MicIcon size={22} strokeWidth={1.9} />');
  });
});
