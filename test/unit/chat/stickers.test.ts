/** Ledger stickers travel as `__STICKER__img:<pack>/<id>` and render only from this site. */
import { ALL_STICKER_PACKS, LEDGER_STICKERS, STICKER_PACKS, STICKER_SCENES, stickerLabel, stickerMessage, stickerRef, stickerSrc } from '@/lib/chat/stickers';
import fs from 'node:fs';

describe('stickers', () => {
  it('maps our stickers to their image, and nothing else', () => {
    expect(stickerSrc(stickerMessage('ledger', 'hi'))).toBe('/stickers/ledger/hi.svg');
    expect(stickerSrc(stickerMessage('lumi', 'splash'))).toBe('/stickers/lumi/splash.svg');
    expect(stickerLabel('__STICKER__img:ledger/paid')).toBe('Paid');
    expect(stickerSrc('__STICKER__img:ledger/nope')).toBeNull();
    expect(stickerSrc('__STICKER__img:../../evil')).toBeNull();
    expect(stickerSrc('__STICKER__img:https://evil.example/x')).toBeNull();
    expect(stickerSrc('__STICKER__img:lumi/../ledger/hi')).toBeNull();
    expect(stickerSrc('__STICKER__😀')).toBeNull(); // old emoji stickers keep rendering as text
  });

  it('ships an image for every sticker in every pack, with unique ids', () => {
    expect(LEDGER_STICKERS.length).toBe(12);
    const packIds = ALL_STICKER_PACKS.map(p => p.id);
    expect(new Set(packIds).size).toBe(packIds.length);
    for (const p of ALL_STICKER_PACKS) {
      const ids = p.stickers.map(s => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.includes(p.cover)).toBe(true);
      for (const s of p.stickers) expect(fs.existsSync(`public/stickers/${p.id}/${s.id}.${p.format ?? 'svg'}`)).toBe(true);
    }
  });

  it('the drawn stickers are self-contained: no scripts, no external references', () => {
    for (const p of ALL_STICKER_PACKS.filter(x => (x.format ?? 'svg') === 'svg')) {
      for (const s of p.stickers) {
        const svg = fs.readFileSync(`public/stickers/${p.id}/${s.id}.svg`, 'utf8');
        expect(svg).not.toMatch(/<script|javascript:|href=|xlink:|@import|url\((?!#)/i);
      }
    }
  });

  it('every scene and tint is one the player knows', () => {
    const player = fs.readFileSync('lib/chat/sticker-scenes.ts', 'utf8');
    for (const scene of STICKER_SCENES) expect(player).toMatch(new RegExp(`case '${scene}':`));
    for (const p of ALL_STICKER_PACKS) {
      for (const s of p.stickers) {
        if (s.scene) expect(STICKER_SCENES.includes(s.scene)).toBe(true);
        if (s.tint) expect(s.tint).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
    expect(stickerRef(stickerMessage('nubi-sol', 'kiss'))?.sticker.scene).toBe('kiss');
  });

  it('the picker offers Hoops, Hammy and Noel (40 stickers); the cactus and older packs still render', () => {
    expect(STICKER_PACKS.map(p => p.id)).toEqual(['hoops', 'hammy', 'noel']);
    expect(STICKER_PACKS.reduce((n, p) => n + p.stickers.length, 0)).toBe(40);
    expect(stickerSrc(stickerMessage('hoops', 'nailed-it'))).toBe('/stickers/hoops/nailed-it.webp');
    expect(stickerSrc(stickerMessage('spike', 'slay'))).toBe('/stickers/spike/slay.svg');
    expect(stickerSrc(stickerMessage('lumi', 'splash'))).toBe('/stickers/lumi/splash.svg');
  });

  it('the offered packs play the short, frame-breaking moment and stay sharp', () => {
    for (const p of STICKER_PACKS) {
      expect(p.sceneMs).toBeGreaterThanOrEqual(1000);
      expect(p.sceneMs).toBeLessThanOrEqual(3000);
      expect(p.px).toBe(512);
      for (const s of p.stickers) expect(s.scene).toBeTruthy();
    }
    const host = fs.readFileSync('components/chat/StickerSceneHost.tsx', 'utf8');
    expect(host).toMatch(/createPortal\(/);
    expect(host).toMatch(/fixed inset-0 z-\[300000\] pointer-events-none/);
    expect(fs.readFileSync('lib/chat/sticker-scenes.ts', 'utf8')).toMatch(/case 'snow':/);
    expect(fs.existsSync('public/stickers/CREDITS.md')).toBe(true);
  });
});
