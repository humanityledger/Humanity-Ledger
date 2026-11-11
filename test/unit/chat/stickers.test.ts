/** Ledger stickers travel as `__STICKER__img:<pack>/<id>` and render only from this site. */
import { LEDGER_STICKERS, stickerLabel, stickerMessage, stickerSrc } from '@/lib/chat/stickers';
import fs from 'node:fs';

describe('stickers', () => {
  it('maps our stickers to their image, and nothing else', () => {
    expect(stickerSrc(stickerMessage('ledger', 'hi'))).toBe('/stickers/ledger/hi.svg');
    expect(stickerLabel('__STICKER__img:ledger/paid')).toBe('Paid');
    expect(stickerSrc('__STICKER__img:ledger/nope')).toBeNull();
    expect(stickerSrc('__STICKER__img:../../evil')).toBeNull();
    expect(stickerSrc('__STICKER__img:https://evil.example/x')).toBeNull();
    expect(stickerSrc('__STICKER__😀')).toBeNull(); // old emoji stickers keep rendering as text
  });
  it('ships an image for every sticker in the pack', () => {
    for (const s of LEDGER_STICKERS) expect(fs.existsSync(`public/stickers/ledger/${s.id}.svg`)).toBe(true);
  });
});
