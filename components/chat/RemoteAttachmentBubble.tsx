"use client";
/**
 * components/chat/RemoteAttachmentBubble.tsx
 *
 * Shows one "hl.attachment" message: fetches the ciphertext from our own
 * attachment route, checks its digest, decrypts it on this device, checks the
 * decrypted bytes (file-sniff.ts) and only then renders it. The bytes are
 * rendered inline only if they really are audio, an image or a video of the
 * kind the message claims; anything else is a download, never an inline
 * document, so an attachment cannot run script in the chat.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Download, FileText, Lock, AlertTriangle } from 'lucide-react';

import { CustomAudioPlayer } from './CustomAudioPlayer';
import { decryptAttachment, type AttachmentMessage, GCM_TAG_BYTES } from '@/lib/chat/remote-attachment';
import { renderableAs, sniffType, type SniffedType } from '@/lib/chat/file-sniff';

const CARD = 'rounded-2xl bg-white border border-[#e6e8ec] shadow-[0_1px_2px_rgba(16,24,40,0.04)]';
/** Above this, video and files load only when tapped. */
const AUTO_LOAD_BYTES = 8 * 1024 * 1024;

type Decrypted = { url: string; type: SniffedType; inline: boolean };

// Decrypted object URLs, by ciphertext digest, so scrolling does not refetch.
// Bounded; the oldest URL is revoked when the cache is full.
const cache = new Map<string, Decrypted>();
const inflight = new Map<string, Promise<Decrypted>>();
const CACHE_MAX = 60;

function remember(digest: string, value: Decrypted) {
  cache.set(digest, value);
  while (cache.size > CACHE_MAX) {
    const [oldest, v] = cache.entries().next().value as [string, Decrypted];
    cache.delete(oldest);
    try { URL.revokeObjectURL(v.url); } catch {}
  }
}

async function load(att: AttachmentMessage): Promise<Decrypted> {
  const hit = cache.get(att.contentDigest);
  if (hit) return hit;
  const pending = inflight.get(att.contentDigest);
  if (pending) return pending;
  const p = (async () => {
    const res = await fetch(att.url, { credentials: 'same-origin', cache: 'force-cache' });
    if (res.status === 404) throw new Error('This attachment is no longer available');
    if (!res.ok) throw new Error('Could not download the attachment');
    const ciphertext = new Uint8Array(await res.arrayBuffer());
    if (ciphertext.byteLength !== att.contentLength + GCM_TAG_BYTES) throw new Error('The attachment does not match its digest');
    const plain = await decryptAttachment(ciphertext, att);
    const type = sniffType(plain, att.kind);
    const inline = renderableAs(type, att.kind);
    // Non-inline files get a neutral type (PDF excepted) so opening them never renders HTML/SVG.
    const blobType = inline || type === 'application/pdf' ? type : 'application/octet-stream';
    const value = { url: URL.createObjectURL(new Blob([plain as BlobPart], { type: blobType })), type, inline };
    remember(att.contentDigest, value);
    return value;
  })();
  inflight.set(att.contentDigest, p);
  try { return await p; } finally { inflight.delete(att.contentDigest); }
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function RemoteAttachmentBubble({
  att, isMe, onOpenLightbox,
}: {
  att: AttachmentMessage;
  isMe: boolean;
  onOpenLightbox: (url: string) => void;
}) {
  const auto = att.kind === 'audio' || att.kind === 'image' || (att.kind === 'video' && att.contentLength <= AUTO_LOAD_BYTES);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>(auto ? 'loading' : 'idle');
  const [data, setData] = useState<Decrypted | null>(() => cache.get(att.contentDigest) ?? null);
  const [error, setError] = useState<string | null>(null);
  const corner = isMe ? 'rounded-br-[6px]' : 'rounded-bl-[6px]';

  const start = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const d = await load(att);
      setData(d);
      setState('ready');
      return d;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the attachment');
      setState('error');
      return null;
    }
  }, [att]);

  useEffect(() => {
    if (data) { setState('ready'); return; }
    if (auto) void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [att.contentDigest]);

  const download = useCallback(async () => {
    const d = data ?? (await start());
    if (!d) return;
    const a = document.createElement('a');
    a.href = d.url;
    a.download = att.filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [data, start, att.filename]);

  if (state === 'error') {
    return (
      <div className={`${CARD} ${corner} flex items-center gap-2.5 px-3.5 py-3 min-w-[220px] max-w-[300px]`} role="status">
        <AlertTriangle size={16} strokeWidth={1.9} className="text-[#b54708] shrink-0" aria-hidden="true" />
        <span className="flex flex-col min-w-0">
          <span className="text-[14px] font-medium text-[#15171c] truncate">{att.kind === 'audio' ? 'Voice message' : att.filename}</span>
          <span className="text-[12.5px] text-[#727a88]">{error}</span>
        </span>
        <button type="button" onClick={() => void start()} className="ml-auto min-h-[44px] px-3 text-[13px] font-medium text-[#15171c]">Retry</button>
      </div>
    );
  }

  if (state !== 'ready' || !data) {
    if (att.kind === 'file' || state === 'idle') {
      return (
        <button type="button" onClick={() => void (att.kind === 'file' ? download() : start())}
          className={`${CARD} ${corner} flex items-center gap-3 px-3.5 py-3 min-h-[44px] min-w-[220px] max-w-[300px] text-left hover:border-[#c9ced6] transition-colors`}>
          <span className="w-10 h-10 rounded-xl bg-[#eff1f4] text-[#15171c] flex items-center justify-center shrink-0" aria-hidden="true">
            <FileText size={18} strokeWidth={1.8} />
          </span>
          <span className="flex flex-col min-w-0 flex-1">
            <span className="text-[14.5px] font-medium text-[#15171c] truncate">{att.filename}</span>
            <span className="text-[13px] text-[#727a88] flex items-center gap-1">
              <Lock size={11} strokeWidth={2} aria-hidden="true" /> {state === 'loading' ? 'Decrypting…' : formatSize(att.contentLength)}
            </span>
          </span>
          <Download size={16} strokeWidth={1.9} className="text-[#4a505c] shrink-0" aria-hidden="true" />
        </button>
      );
    }
    return (
      <div className={`${CARD} ${corner} ${att.kind === 'audio' ? 'px-3 py-3 w-[240px]' : 'w-[220px] h-[160px]'} flex items-center justify-center gap-1.5 text-[13px] text-[#727a88]`} role="status">
        <Lock size={12} strokeWidth={2} aria-hidden="true" /> Decrypting {att.kind === 'audio' ? 'voice message' : att.kind}
      </div>
    );
  }

  if (data.inline && att.kind === 'audio') {
    return (
      <div className={`${CARD} px-3 py-2 ${corner}`}>
        <CustomAudioPlayer src={data.url} isMe={isMe} />
      </div>
    );
  }
  if (data.inline && att.kind === 'image') {
    return (
      <button type="button" onClick={() => onOpenLightbox(data.url)} aria-label="Open photo" className={`block rounded-2xl ${corner} overflow-hidden border border-[#e6e8ec]`}>
        <img src={data.url} alt="" className="max-w-[260px] max-h-[300px] object-cover block" />
      </button>
    );
  }
  if (data.inline && att.kind === 'video') {
    return <video src={data.url} controls playsInline preload="metadata" className={`max-w-[260px] max-h-[260px] rounded-2xl ${corner} border border-[#e6e8ec] bg-[#15171c] block`} />;
  }

  // A file, or bytes that are not what the message claimed: download only.
  return (
    <button type="button" onClick={() => void download()}
      className={`${CARD} ${corner} flex items-center gap-3 px-3.5 py-3 min-h-[44px] min-w-[220px] max-w-[300px] text-left hover:border-[#c9ced6] transition-colors`}>
      <span className="w-10 h-10 rounded-xl bg-[#eff1f4] text-[#15171c] flex items-center justify-center shrink-0" aria-hidden="true">
        <FileText size={18} strokeWidth={1.8} />
      </span>
      <span className="flex flex-col min-w-0 flex-1">
        <span className="text-[14.5px] font-medium text-[#15171c] truncate">{att.filename}</span>
        <span className="text-[13px] text-[#727a88]">
          {att.kind !== 'file' ? 'Not a playable file, download only' : formatSize(att.contentLength)}
        </span>
      </span>
      <Download size={16} strokeWidth={1.9} className="text-[#4a505c] shrink-0" aria-hidden="true" />
    </button>
  );
}
