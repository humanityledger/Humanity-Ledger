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
      for (const s of p.stickers) expect(fs.existsSync(`public/stickers/${p.id}/${s.id}.svg`)).toBe(true);
    }
  });

  it('the drawn stickers are self-contained: no scripts, no external references', () => {
    for (const p of ALL_STICKER_PACKS) {
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

  it('the picker offers only Spike, the cactus; stickers already sent from other packs still render', () => {
    expect(STICKER_PACKS.map(p => p.id)).toEqual(['spike']);
    expect(stickerSrc(stickerMessage('lumi', 'splash'))).toBe('/stickers/lumi/splash.svg');
  });
});
