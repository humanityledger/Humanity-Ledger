import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import { brandedQrShapes } from '@/lib/chat/brandedQr';

// The geometry behind components/chat/profile/BrandedQr and the saved PNG. The scan itself is
// checked with a real decoder by scripts/qr/check-branded-qr.py; here: what the design may drop.
describe('branded QR geometry', () => {
  const link = 'https://ledgerchat.org/u#AbCdEfGhIjKlMnOpQrStUv';

  it('uses error correction H and keeps three modules of quiet zone', () => {
    const s = brandedQrShapes(link);
    const plain = QRCode.create(link, { errorCorrectionLevel: 'H' });
    expect(s.n).toBe(plain.modules.size);
    expect(s.quiet).toBe(3);
    expect(s.side).toBe(s.n + 6);
  });

  it('draws three finder eyes in the corners and no data dot inside them', () => {
    const s = brandedQrShapes(link);
    expect(s.eyes).toEqual([[3, 3], [3 + s.n - 7, 3], [3, 3 + s.n - 7]]);
    for (const [x, y] of s.dots) {
      for (const [ex, ey] of s.eyes) expect(x > ex && x < ex + 7 && y > ey && y < ey + 7).toBe(false);
    }
  });

  it('the logo clears at most 6 % of the code, well inside what level H recovers (30 %)', () => {
    for (const text of [link, 'ethereum:0x' + 'ab'.repeat(20) + '@1', 'https://ledgerchat.org/connect?s=' + 'x'.repeat(200)]) {
      const s = brandedQrShapes(text);
      const area = Math.PI * s.logo.r ** 2;
      expect(area / (s.n * s.n)).toBeLessThan(0.06);
      expect(s.logo.cx).toBe(3 + s.n / 2);
      for (const [x, y] of s.dots) expect(Math.hypot(x - s.logo.cx, y - s.logo.cy)).toBeGreaterThanOrEqual(s.logo.r);
    }
  });

  it('keeps every other dark module', () => {
    const s = brandedQrShapes(link);
    const m = QRCode.create(link, { errorCorrectionLevel: 'H' }).modules;
    let dark = 0;
    for (let i = 0; i < m.size * m.size; i++) if (m.data[i]) dark++;
    // finder eyes hold 3 × 33 dark modules; the rest are dots except those under the logo
    expect(s.dots.length).toBeGreaterThan(dark - 99 - Math.ceil(Math.PI * (s.logo.r + 1.5) ** 2));
    expect(s.dots.length).toBeLessThan(dark - 99);
  });
});
