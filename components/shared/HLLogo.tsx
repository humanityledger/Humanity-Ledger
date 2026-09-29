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

export function HLLogo({ variant = 'full', theme = 'dark', className = '', size = 38 }: HLLogoProps) {
  const color = theme === 'light' ? '#ffffff' : '#050505';

  const GlobeBubbleIcon = (
    <div 
      className={`shrink-0 rounded-full overflow-hidden flex items-center justify-center bg-white border border-black/5 shadow-sm ${theme === 'light' ? 'invert border-white/20' : ''}`}
      style={{ width: size, height: size }}
    >
      <img 
        src="/favicon.png" 
        alt="Humanity Ledger Logo" 
        style={{ width: '120%', height: '120%', objectFit: 'cover' }}
        className="pointer-events-none"
      />
    </div>
  );

  if (variant === 'mark') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        {GlobeBubbleIcon}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`} role="img" aria-label="Humanity Ledger">
      {GlobeBubbleIcon}
      <div className="flex flex-col">
        <span style={{ fontSize: size * 0.45, fontWeight: 900, letterSpacing: '-0.02em', color, lineHeight: 1.1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          Humanity
        </span>
        <span style={{ fontSize: size * 0.45, fontWeight: 900, letterSpacing: '-0.02em', color, lineHeight: 1.1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          Ledger
        </span>
      </div>
    </div>
  );
}

export const HLMark = (props: Omit<HLLogoProps, 'variant'>) => <HLLogo {...props} variant="mark" />;
export { HLLogo as LedgerLogo };
