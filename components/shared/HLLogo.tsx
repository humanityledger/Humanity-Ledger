'use client';

import React from 'react';

export type HLLogoVariant = 'mark' | 'full';
export type HLLogoTheme = 'dark' | 'light' | 'accent';

interface HLLogoProps {
  variant?: HLLogoVariant;
  theme?: HLLogoTheme;
  className?: string;
  size?: number;
}

export function HLLogo({ variant = 'full', theme = 'dark', className = '', size = 32 }: HLLogoProps) {
  const color = theme === 'light' ? '#ffffff' : '#050505';

  const GlobeBubbleIcon = (
    <img 
      src="/favicon.png" 
      alt="Humanity Ledger Logo" 
      style={{ width: size, height: size, objectFit: 'contain' }}
      className={`shrink-0 ${theme === 'light' ? 'invert' : ''}`}
    />
  );

  if (variant === 'mark') {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height: size, width: size }}>
        {GlobeBubbleIcon}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`} role="img" aria-label="Humanity Ledger">
      {GlobeBubbleIcon}
      <span style={{ fontSize: size * 0.65, fontWeight: 900, letterSpacing: '-0.04em', color, lineHeight: 1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        Humanity Ledger
      </span>
    </div>
  );
}

export const HLMark = (props: Omit<HLLogoProps, 'variant'>) => <HLLogo {...props} variant="mark" />;
export { HLLogo as LedgerLogo };
