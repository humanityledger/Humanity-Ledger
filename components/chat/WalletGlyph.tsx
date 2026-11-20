/**
 * The avatar of a wallet with no photo: a geometric glyph derived from its address, never initials.
 *
 * A 5 × 5 grid mirrored around the middle column (15 free cells, one per address nibble, a cell
 * is drawn when the nibble is 8 or more), in one ink on a white tile with a hairline border. The
 * ink's hue comes from the address, darkened enough for contrast on white. The same address
 * always gives the same glyph; two addresses that differ in their first 15 hex digits differ.
 */
export function walletCells(address: string): boolean[] {
  const hex = (address || '').toLowerCase().replace(/^0x/, '').replace(/[^0-9a-f]/g, '').padEnd(15, '0');
  const free = Array.from({ length: 15 }, (_, i) => parseInt(hex[i], 16) >= 8);
  // Never an empty or a full tile: keep the middle cell on and one corner off.
  if (!free.some(Boolean)) free[7] = true;
  if (free.every(Boolean)) free[0] = false;
  const cells: boolean[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const c = col < 3 ? col : 4 - col; // mirror: columns 3 and 4 copy 1 and 0
      cells.push(free[row * 3 + c]);
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
  const pad = 4, cell = (24 - pad * 2) / 5;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ flexShrink: 0, display: 'block' }}>
      <rect x="0.5" y="0.5" width="23" height="23" rx="7" fill="#FFFFFF" stroke="#E4E7EC" />
      {cells.map((on, i) => on && (
        <rect key={i} x={pad + (i % 5) * cell + 0.25} y={pad + Math.floor(i / 5) * cell + 0.25} width={cell - 0.5} height={cell - 0.5} rx="0.8" fill={ink} />
      ))}
    </svg>
  );
}
