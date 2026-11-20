'use client';
import { useMediaUrl } from '@/lib/chat/media-url';

/** A <video> whose data: source is played from a blob: URL, which the CSP allows. */
export function InlineVideo({ src, className }: { src: string; className?: string }) {
  const url = useMediaUrl(src);
  if (!url) return null;
  return <video src={url} controls playsInline preload="metadata" className={className} />;
}
