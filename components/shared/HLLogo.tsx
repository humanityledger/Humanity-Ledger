'use client';

import React from 'react';

export type HLLogoVariant = 'mark' | 'full';
export type HLLogoTheme = 'dark' | 'light' | 'accent';

interface HLLogoProps {
  variant?: HLLogoVariant;
  theme?: HLLogoTheme;
  className?: string;
  size?: number;
  priority?: boolean;
}

export function HLLogo({ variant = 'full', theme = 'dark', className = '', size = 32 }: HLLogoProps) {
  const isLight = theme === 'light';
  const textColor = isLight ? '#ffffff' : '#050505';

  const WorldMapIcon = (
    <div
      className={`shrink-0 rounded-full overflow-hidden flex items-center justify-center bg-white border ${
        isLight ? 'border-white/20' : 'border-black/5'
      } shadow-sm`}
      style={{ width: size, height: size }}
    >
      <img
        src="/worldmap.png"
        alt="Humanity Ledger"
        style={{
          width: '120%',
          height: '120%',
          objectFit: 'cover',
          filter: isLight ? 'invert(1)' : 'none',
        }}
        className="pointer-events-none select-none"
      />
    </div>
  );

  if (variant === 'mark') {
    return (
      <div
        className={`flex items-center justify-center shrink-0 ${className}`}
        style={{ width: size, height: size }}
        role="img"
        aria-label="Humanity Ledger"
      >
        {WorldMapIcon}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2.5 shrink-0 ${className}`}
      role="img"
      aria-label="Humanity Ledger"
    >
      {WorldMapIcon}
      <span
        style={{
          fontSize: size * 0.55,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: textColor,
          lineHeight: 1,
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        Humanity Ledger
      </span>
    </div>
  );
}

export const HLMark = (props: Omit<HLLogoProps, 'variant'>) => (
  <HLLogo {...props} variant="mark" />
);

/** Legacy alias — keeps any old LedgerLogo imports working */
export { HLLogo as LedgerLogo };
