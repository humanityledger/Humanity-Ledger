/**
 * The avatar of a wallet with no photo: a geometric glyph derived from its address, never initials.
 *
 * A 10 × 10 grid (100 squares, 21 November 2026; it was 5 × 5) mirrored around its middle: 50
 * free cells, one per bit of the first 50 bits of the address. Every one of the 100 squares is
 * drawn: a set bit in the ink, a clear bit in a light tint of the same ink, so the whole mosaic
 * shows even at 32 px. The ink's hue comes from the address, darkened for contrast on white. The
 * same address always gives the same glyph; two addresses that differ in their first 50 bits
 * differ.
 */
export const GLYPH_SIDE = 10;
const HALF = GLYPH_SIDE / 2;

export function walletCells(address: string): boolean[] {
  const hex = (address || '').toLowerCase().replace(/^0x/, '').replace(/[^0-9a-f]/g, '').padEnd(13, '0');
  const free = Array.from({ length: GLYPH_SIDE * HALF }, (_, i) => ((parseInt(hex[i >> 2], 16) >> (3 - (i & 3))) & 1) === 1);
  // Never an empty or a full mosaic: keep one middle cell on and one corner off.
  if (!free.some(Boolean)) free[HALF * HALF - 1] = true;
  if (free.every(Boolean)) free[0] = false;
  const cells: boolean[] = [];
  for (let row = 0; row < GLYPH_SIDE; row++) {
    for (let col = 0; col < GLYPH_SIDE; col++) {
      const c = col < HALF ? col : GLYPH_SIDE - 1 - col; // mirror: the right half copies the left
      cells.push(free[row * HALF + c]);
    }
  }
  return cells;
}

export function walletInk(address: string): string {
  const hue = address ? parseInt(address.replace(/^0x/i, '').slice(15, 21) || '0', 16) % 360 : 220;
  return `hsl(${hue} 38% 30%)`;
}

export function WalletGlyph({ address, size = 44 }: { address: string; size?: number }) {
  const cells = walletCells(address);
  const ink = walletInk(address);
  const pad = 3.2;
  const cell = (24 - pad * 2) / GLYPH_SIDE;
  const gap = size >= 36 ? 0.22 : 0.16;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ flexShrink: 0, display: 'block' }} shapeRendering="geometricPrecision">
      <rect x="0.5" y="0.5" width="23" height="23" rx="7" fill="#FFFFFF" stroke="#E4E7EC" />
      {cells.map((on, i) => (
        <rect
          key={i}
          x={pad + (i % GLYPH_SIDE) * cell + gap / 2}
          y={pad + Math.floor(i / GLYPH_SIDE) * cell + gap / 2}
          width={cell - gap}
          height={cell - gap}
          rx="0.35"
          fill={ink}
          fillOpacity={on ? 1 : 0.13}
        />
      ))}
    </svg>
  );
}
