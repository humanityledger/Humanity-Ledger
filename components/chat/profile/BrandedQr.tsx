'use client';

/**
 * BrandedQr — the Ledger Chat QR code on screen: round dots, rounded eyes and the Humanity
 * Ledger mark in a white disc at the centre. Geometry and scan checks: lib/chat/brandedQr.ts.
 * Always dark on white; the coloured card goes around it, never inside it.
 */
import { useMemo } from 'react';
import { DOT_RADIUS, QR_INK, QR_LOGO_SRC, brandedQrShapes, eyeCorePath, eyeRingPath } from '@/lib/chat/brandedQr';

export function BrandedQr({ value, title, className, style, logo = true }: { value: string; title: string; className?: string; style?: React.CSSProperties; logo?: boolean }) {
  const s = useMemo(() => brandedQrShapes(value), [value]);
  const dots = useMemo(() => s.dots.map(([x, y]) => `M${x - DOT_RADIUS} ${y}a${DOT_RADIUS} ${DOT_RADIUS} 0 1 0 ${DOT_RADIUS * 2} 0a${DOT_RADIUS} ${DOT_RADIUS} 0 1 0 ${-DOT_RADIUS * 2} 0`).join(''), [s]);
  const logoW = s.logo.r * 2 * 0.9;
  return (
    <svg viewBox={`0 0 ${s.side} ${s.side}`} role="img" aria-label={title} className={className} style={{ display: 'block', width: '100%', height: 'auto', ...style }} shapeRendering="geometricPrecision">
      <title>{title}</title>
      <rect width={s.side} height={s.side} fill="#FFFFFF" />
      <path d={dots} fill={QR_INK} />
      {s.eyes.map(([x, y]) => (
        <g key={`${x}-${y}`} fill={QR_INK}>
          <path d={eyeRingPath(x, y)} fillRule="evenodd" />
          <path d={eyeCorePath(x, y)} />
        </g>
      ))}
      <circle cx={s.logo.cx} cy={s.logo.cy} r={s.logo.r} fill="#FFFFFF" stroke="#E4E7EC" strokeWidth={0.15} />
      {logo && <image href={QR_LOGO_SRC} x={s.logo.cx - logoW / 2} y={s.logo.cy - logoW / 2} width={logoW} height={logoW} preserveAspectRatio="xMidYMid meet" />}
    </svg>
  );
}

/** Loads /worldmap.png for the PNG export; resolves null if it cannot (the code still scans). */
export function loadQrLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = QR_LOGO_SRC;
  });
}
