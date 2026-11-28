'use client';

/**
 * The composer's thin-stroke icons (Liquid Porcelain Glass composer): sticker with the bottom-right
 * corner folded up, camera, microphone with a curved base, and the hairline plus. 24 × 24, stroke.
 */

import React from 'react';

type P = { size?: number; strokeWidth?: number; className?: string };

const base = (size: number, sw: number, className: string) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, className,
});

export function StickerIcon({ size = 24, strokeWidth = 1.9, className = '' }: P) {
  return (
    <svg {...base(size, strokeWidth, className)}>
      <path d="M20 13.2 V8.2 C20 5.88 18.12 4 15.8 4 H8.2 C5.88 4 4 5.88 4 8.2 V15.8 C4 18.12 5.88 20 8.2 20 H13.2" />
      <path d="M20 13.2 C20 16.95 16.95 20 13.2 20 C13.2 16.25 16.25 13.2 20 13.2 Z" />
    </svg>
  );
}

export function CameraIcon({ size = 24, strokeWidth = 1.9, className = '' }: P) {
  return (
    <svg {...base(size, strokeWidth, className)}>
      <path d="M3.5 9.2 C3.5 8 4.47 7 5.7 7 H7.4 L8.75 5.1 C9 4.75 9.4 4.55 9.83 4.55 H14.17 C14.6 4.55 15 4.75 15.25 5.1 L16.6 7 H18.3 C19.53 7 20.5 8 20.5 9.2 V17.3 C20.5 18.5 19.53 19.5 18.3 19.5 H5.7 C4.47 19.5 3.5 18.5 3.5 17.3 Z" />
      <circle cx="12" cy="12.9" r="3.55" />
    </svg>
  );
}

export function MicIcon({ size = 24, strokeWidth = 1.9, className = '' }: P) {
  return (
    <svg {...base(size, strokeWidth, className)}>
      <rect x="9" y="3" width="6" height="11.5" rx="3" />
      <path d="M5.75 11.5 C5.75 15 8.55 17.6 12 17.6 C15.45 17.6 18.25 15 18.25 11.5" />
      <path d="M12 17.6 V21" />
      <path d="M8.9 21 H15.1" />
    </svg>
  );
}

export function PlusIcon({ size = 24, strokeWidth = 1.75, className = '' }: P) {
  return (
    <svg {...base(size, strokeWidth, className)}>
      <path d="M12 5 V19 M5 12 H19" />
    </svg>
  );
}

export function SendArrowIcon({ size = 20, strokeWidth = 2.2, className = '' }: P) {
  return (
    <svg {...base(size, strokeWidth, className)}>
      <path d="M12 19 V5 M6 11 L12 5 L18 11" />
    </svg>
  );
}
