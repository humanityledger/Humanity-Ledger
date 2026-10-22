'use client';

import React from 'react';

/**
 * HLLogo — the Humanity Ledger mark.
 *
 * The mark is the black world map in a white disc, from /worldmap.png. It is
 * the only logo the company uses. Do not substitute an icon, a monogram or a
 * drawn globe anywhere in the product.
 *
 * Styles are inline rather than Tailwind classes so the mark renders
 * identically wherever it is placed, including pages that do not load the
 * Tailwind layer.
 */

export type HLLogoVariant = 'mark' | 'full';
export type HLLogoTheme = 'dark' | 'light' | 'accent';

interface HLLogoProps {
  variant?: HLLogoVariant;
  /** `dark` draws dark text for light backgrounds. `light` draws white text. */
  theme?: HLLogoTheme;
  className?: string;
  size?: number;
  priority?: boolean;
  /** Override the wordmark, for example "Ledger Chat". */
  label?: string;
}

export function HLLogo({
  variant = 'full',
  theme = 'dark',
  className = '',
  size = 32,
  label = 'Humanity Ledger',
}: HLLogoProps) {
  const onDark = theme === 'light';

  const mark = (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 999,
        overflow: 'hidden',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        boxShadow: onDark
          ? '0 0 0 1px rgba(255,255,255,0.18)'
          : '0 0 0 1px rgba(16,24,40,0.08), 0 1px 2px rgba(16,24,40,0.06)',
      }}
    >
      <img
        src="/worldmap.png"
        alt=""
        draggable={false}
        style={{
          width: '118%',
          height: '118%',
          objectFit: 'cover',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
    </span>
  );

  if (variant === 'mark') {
    return (
      <span
        role="img"
        aria-label={label}
        className={className}
        style={{ display: 'inline-flex', width: size, height: size, flexShrink: 0 }}
      >
        {mark}
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={label}
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.32), flexShrink: 0 }}
    >
      {mark}
      <span
        style={{
          fontFamily: 'var(--hl-font, system-ui, sans-serif)',
          fontSize: Math.round(size * 0.5),
          fontWeight: 650,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color: onDark ? '#ffffff' : 'var(--hl-ink, #15171c)',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </span>
  );
}

export const HLMark = (props: Omit<HLLogoProps, 'variant'>) => <HLLogo {...props} variant="mark" />;

/** Legacy alias so older LedgerLogo imports keep working. */
export { HLLogo as LedgerLogo };
