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
  // If theme is 'light', invert black blackletter calligraphy to white for dark backgrounds
  const filterStyle = theme === 'light' ? { filter: 'invert(1) brightness(100)' } : {};

  if (variant === 'mark') {
    return (
      <div
        className={`flex items-center justify-center shrink-0 ${className}`}
        style={{ width: size, height: size }}
        role="img"
        aria-label="Humanity Ledger"
      >
        <img
          src="/logo-mark-tight.png"
          alt="HL"
          style={{ width: '100%', height: '100%', objectFit: 'contain', ...filterStyle }}
          className="pointer-events-none select-none"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center shrink-0 ${className}`}
      role="img"
      aria-label="Humanity Ledger"
      style={{ height: size }}
    >
      <img
        src="/logo-text.png"
        alt="Humanity Ledger"
        style={{ height: '100%', width: 'auto', objectFit: 'contain', ...filterStyle }}
        className="pointer-events-none select-none"
      />
    </div>
  );
}

export const HLMark = (props: Omit<HLLogoProps, 'variant'>) => (
  <HLLogo {...props} variant="mark" />
);

/** Legacy alias — keeps any old LedgerLogo imports working */
export { HLLogo as LedgerLogo };
