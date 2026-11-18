/**
 * lib/chat/brandedQr.ts — the Ledger Chat QR code: round dots, rounded finder eyes and the
 * Humanity Ledger mark in a white disc at the centre, in the style of World App.
 *
 * Built for scanning first:
 *   - error correction H (30 % of the code can be lost and it still reads);
 *   - the logo clears a disc of 24 % of the width, about 5 % of the area;
 *   - three modules of white quiet zone inside the card;
 *   - dark on white only, whatever the card colour around it.
 * The same geometry was checked with a ZXing-based decoder at 1x, 0.4x and 0.22x, blurred and
 * in perspective, on twelve random profile links (scripts/qr/check-branded-qr.py).
 *
 * One geometry for both outputs: the SVG on screen (BrandedQr) and the PNG saved by the person
 * (drawBrandedQr), so the saved image is the code they saw.
 */
import QRCode from 'qrcode';

export const QR_INK = '#15171C';
export const QR_LOGO_SRC = '/worldmap.png';

export interface BrandedQrShapes {
  /** modules per side */
  n: number;
  /** quiet zone, in modules */
  quiet: number;
  /** total side in modules (n + 2 · quiet) */
  side: number;
  /** centres of the data dots, in modules, already offset by the quiet zone */
  dots: Array<[number, number]>;
  /** top-left corners of the three finder eyes, offset by the quiet zone */
  eyes: Array<[number, number]>;
  /** the logo disc */
  logo: { cx: number; cy: number; r: number };
}

export const DOT_RADIUS = 0.42;
const LOGO_FRACTION = 0.24;

export function brandedQrShapes(text: string, quiet = 3): BrandedQrShapes {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const n: number = qr.modules.size;
  const data: ArrayLike<number> = qr.modules.data;
  const inFinder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  let L = Math.ceil(n * LOGO_FRACTION);
  if (L % 2 !== n % 2) L += 1; // centred on whole modules
  const centre = n / 2;
  const clear = L / 2 + 0.55;
  const dots: Array<[number, number]> = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!data[r * n + c] || inFinder(r, c)) continue;
      if (Math.hypot(c + 0.5 - centre, r + 0.5 - centre) < clear) continue;
      dots.push([quiet + c + 0.5, quiet + r + 0.5]);
    }
  }
  return {
    n,
    quiet,
    side: n + 2 * quiet,
    dots,
    eyes: [
      [quiet, quiet],
      [quiet + n - 7, quiet],
      [quiet, quiet + n - 7],
    ],
    logo: { cx: quiet + centre, cy: quiet + centre, r: L / 2 },
  };
}

/** The outer ring of a finder eye (7 × 7, evenodd), as an SVG path. */
export function eyeRingPath(x: number, y: number): string {
  return (
    `M${x + 2.4} ${y}H${x + 4.6}A2.4 2.4 0 0 1 ${x + 7} ${y + 2.4}V${y + 4.6}A2.4 2.4 0 0 1 ${x + 4.6} ${y + 7}H${x + 2.4}A2.4 2.4 0 0 1 ${x} ${y + 4.6}V${y + 2.4}A2.4 2.4 0 0 1 ${x + 2.4} ${y}Z` +
    `M${x + 2.6} ${y + 1}H${x + 4.4}A1.6 1.6 0 0 1 ${x + 6} ${y + 2.6}V${y + 4.4}A1.6 1.6 0 0 1 ${x + 4.4} ${y + 6}H${x + 2.6}A1.6 1.6 0 0 1 ${x + 1} ${y + 4.4}V${y + 2.6}A1.6 1.6 0 0 1 ${x + 2.6} ${y + 1}Z`
  );
}

/** The centre of a finder eye (3 × 3, rounded), as an SVG path. */
export function eyeCorePath(x: number, y: number): string {
  const a = x + 2, b = y + 2, r = 1.05;
  return `M${a + r} ${b}H${a + 3 - r}A${r} ${r} 0 0 1 ${a + 3} ${b + r}V${b + 3 - r}A${r} ${r} 0 0 1 ${a + 3 - r} ${b + 3}H${a + r}A${r} ${r} 0 0 1 ${a} ${b + 3 - r}V${b + r}A${r} ${r} 0 0 1 ${a + r} ${b}Z`;
}

/**
 * Draws the code on a canvas: a white rounded square of `size` px at (x, y), the dots, the eyes
 * and the logo. `logo` is the loaded /worldmap.png (drawn only if given).
 */
export function drawBrandedQr(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, logo?: CanvasImageSource | null, radius = 0) {
  const s = brandedQrShapes(text);
  const u = size / s.side;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#FFFFFF';
  if (radius > 0 && typeof (ctx as any).roundRect === 'function') {
    ctx.beginPath();
    (ctx as any).roundRect(0, 0, size, size, radius);
    ctx.fill();
  } else {
    ctx.fillRect(0, 0, size, size);
  }
  ctx.scale(u, u);
  ctx.fillStyle = QR_INK;
  ctx.beginPath();
  for (const [cx, cy] of s.dots) {
    ctx.moveTo(cx + DOT_RADIUS, cy);
    ctx.arc(cx, cy, DOT_RADIUS, 0, Math.PI * 2);
  }
  ctx.fill();
  for (const [ex, ey] of s.eyes) {
    ctx.fill(new Path2D(eyeRingPath(ex, ey)), 'evenodd');
    ctx.fill(new Path2D(eyeCorePath(ex, ey)));
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(s.logo.cx, s.logo.cy, s.logo.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#E4E7EC';
  ctx.lineWidth = 0.15;
  ctx.stroke();
  if (logo) {
    const w = s.logo.r * 2 * 0.9;
    ctx.drawImage(logo, s.logo.cx - w / 2, s.logo.cy - w / 2, w, w);
  }
  ctx.restore();
}
