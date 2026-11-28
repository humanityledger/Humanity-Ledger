'use client';

/**
 * Private Notes marks: the blue verified check and the closed-book logo, drawn as SVG so they stay
 * sharp at any size and need no image request.
 *
 * Book: a hard-cover book seen from the front, firm uniform outline (#15171c), rounded joins.
 * Front cover with a spine line at ~20 % from the left, the spine's top-left corner rounded; at the
 * bottom the spine wraps into a rounded U under the page block, which ends on the right in a
 * concave cut, with one horizontal line inside for the pages.
 */

import React from 'react';
import { AVATAR_RADIUS } from '@/components/chat/UserAvatar';

export function VerifiedBlueCheckBadge({ size = 16, className = '', title = 'Verified' }: { size?: number; className?: string; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title} className={`hl-verified-check shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="12" fill="#1279C0" />
      <path d="M6.3 12.1 L10.45 16.95 L18.6 6.95" fill="none" stroke="#ffffff" strokeWidth="2.1" strokeLinecap="butt" strokeLinejoin="miter" />
    </svg>
  );
}

export function PrivateNotesBookIcon({ size = 24, stroke = '#15171c', strokeWidth = 1.7, className = '' }: { size?: number; stroke?: string; strokeWidth?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}
      stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {/* cover, spine corner, U-shaped bottom wrap and the concave cut of the page block */}
      <path d="M18.1 3.26 H8.6 C6.97 3.26 5.83 4.5 5.83 6.1 V19.07 A1.63 1.63 0 0 0 7.46 20.7 H18.1 C17.3 19.95 17.3 18.2 18.1 17.45 Z" />
      {/* spine line */}
      <path d="M8.3 3.5 V17.45" />
      {/* top of the page block, joining the wrap */}
      <path d="M18.1 17.45 H7.46 C6.56 17.45 5.83 18.18 5.83 19.07" />
      {/* the pages */}
      <path d="M8.1 19.07 H16.85" />
    </svg>
  );
}

/** The book inside a standard chat avatar tile (same radius as every avatar), in porcelain glass. */
export function PrivateNotesAvatar({ size = 48 }: { size?: number }) {
  return (
    <span
      className="lg-avatar-tile inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size, borderRadius: AVATAR_RADIUS }}
      aria-hidden="true"
    >
      <PrivateNotesBookIcon size={Math.round(size * 0.58)} />
    </span>
  );
}
