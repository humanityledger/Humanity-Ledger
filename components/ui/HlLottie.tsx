'use client';

import React from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

/** A .lottie from public/lottie. Decorative unless a label is given. */
export function HlLottie({
  src,
  size = 96,
  label,
  loop = true,
}: {
  src: string;
  size?: number;
  label?: string;
  loop?: boolean;
}) {
  return (
    <span
      className="inline-flex shrink-0"
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <DotLottieReact src={src} autoplay loop={loop} style={{ width: size, height: size }} />
    </span>
  );
}
