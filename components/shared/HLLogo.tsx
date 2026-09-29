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
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="shrink-0">
      {/* Globe Outline */}
      <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="2.5" />
      {/* Latitude / Longitude minimalist lines */}
      <ellipse cx="16" cy="16" rx="14" ry="5" stroke={color} strokeWidth="1.5" opacity="0.5" />
      <line x1="16" y1="2" x2="16" y2="30" stroke={color} strokeWidth="1.5" opacity="0.5" />
      {/* Chat Bubble Overlaid inside the globe */}
      <path d="M12 12C12 10.8954 12.8954 10 14 10H24C25.1046 10 26 10.8954 26 12V18C26 19.1046 25.1046 20 24 20H20L16 24V20H14C12.8954 20 12 19.1046 12 18V12Z" fill="#2C6BED" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="16.5" cy="15" r="1.5" fill="#FFF"/>
      <circle cx="21.5" cy="15" r="1.5" fill="#FFF"/>
    </svg>
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
