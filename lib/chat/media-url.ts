'use client';
/**
 * Inline media arrive as data: URLs (voice notes and files sent without the attachment store).
 * The CSP allows media only from 'self', blob: and mediastream: (middleware.ts), so <audio> and
 * <video> with a data: source were blocked on /chat ("media-src data:" violations, 20/11/2026).
 * Instead of widening the policy, such sources are turned into blob: URLs, which it allows.
 */
import { useEffect, useState } from 'react';

/** Decodes a base64 or percent-encoded data: URL into a Blob; null when it is not one. */
export function dataUrlToBlob(src: string): Blob | null {
  const m = /^data:([^,;]*)((?:;[^,;]+)*?)(;base64)?,(.*)$/s.exec(src);
  if (!m) return null;
  const mime = m[1] || 'application/octet-stream';
  try {
    if (m[3]) {
      const bin = atob(m[4]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(m[4])], { type: mime });
  } catch {
    return null;
  }
}

/** A media source the CSP allows: data: becomes a blob: URL (revoked when it changes); anything else as is. */
export function useMediaUrl(src: string | null | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() => (src && !src.startsWith('data:') ? src : undefined));
  useEffect(() => {
    if (!src) { setUrl(undefined); return; }
    if (!src.startsWith('data:')) { setUrl(src); return; }
    const blob = dataUrlToBlob(src);
    if (!blob) { setUrl(undefined); return; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [src]);
  return url;
}
