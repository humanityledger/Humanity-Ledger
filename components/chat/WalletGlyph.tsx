import { useId } from 'react';

/**
 * The avatar of a wallet with no photo: a geometric glyph derived from its address, never initials.
 *
 * A 10 × 10 grid (100 squares, 21 November 2026; it was 5 × 5) mirrored around its middle: 50
 * free cells, one per bit of the first 50 bits of the address. Every one of the 100 squares is
 * drawn edge-to-edge inside a rounded square (rx=7 on 24×24): a set bit in the ink, a clear bit
 * in a light tint of the same ink, so the mosaic fills the entire tile seamlessly at any size.
 * The ink's hue comes from the address, darkened for contrast on white. The same address always
 * gives the same glyph; two addresses that differ in their first 50 bits differ.
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
  const rawId = useId();
  const clipId = `wg-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const cells = walletCells(address);
  const ink = walletInk(address);
  const gap = size >= 48 ? 0.22 : size >= 32 ? 0.18 : 0.14;
  const step = (24 + gap) / GLYPH_SIDE;
  const cell = step - gap;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0, display: 'block', width: '100%', height: '100%' }}
      shapeRendering="geometricPrecision"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="24" height="24" rx="7" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="24" height="24" fill="#FFFFFF" />
        {cells.map((on, i) => (
          <rect
            key={i}
            x={(i % GLYPH_SIDE) * step}
            y={Math.floor(i / GLYPH_SIDE) * step}
            width={cell}
            height={cell}
            rx="0.25"
            fill={ink}
            fillOpacity={on ? 1 : 0.13}
          />
        ))}
        {/* Exact 1px inset hairline inside the rounded square at every render size */}
        <rect
          x="0"
          y="0"
          width="24"
          height="24"
          rx="7"
          fill="none"
          stroke="rgba(16, 24, 40, 0.09)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}
