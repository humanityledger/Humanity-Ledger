// One mapping for the "Text size" setting. The settings preview, the
// conversation text and the --ledger-text-size CSS variable all read it, so
// the size people pick is the size they get.

export const TEXT_SIZE_LABELS = ['XS', 'S', 'M', 'L', 'XL'] as const;
export const TEXT_SIZE_PX = [13, 14, 15, 16, 18] as const;
export const DEFAULT_TEXT_SIZE_LEVEL = 2;

export function textSizeLevel(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_TEXT_SIZE_LEVEL;
  return Math.min(TEXT_SIZE_PX.length - 1, Math.max(0, Math.round(n)));
}

export function chatTextPx(value: unknown): number {
  return TEXT_SIZE_PX[textSizeLevel(value)];
}

export function textSizeLabel(value: unknown): string {
  return TEXT_SIZE_LABELS[textSizeLevel(value)];
}
