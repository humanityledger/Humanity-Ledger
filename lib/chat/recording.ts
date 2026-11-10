/**
 * lib/chat/recording.ts — which container a voice note is recorded in.
 *
 * Order of preference:
 *  1. AAC in MP4 (`audio/mp4;codecs=mp4a.40.2`): plays in every browser,
 *     including iOS Safari before 18.4, which cannot play WebM/Opus. Safari
 *     and recent Chromium can record it.
 *  2. Opus in WebM: Chromium and Firefox; Safari records it from 18.4.
 *  3. Plain `audio/mp4`: Safari 14.1–18.3 (AAC).
 *  4. ADTS AAC, then Ogg/Opus (Firefox).
 *  5. Nothing matched: '' so MediaRecorder picks its own default; the real
 *     type is then read from `recorder.mimeType`, never assumed.
 *
 * The recipient never trusts this label: RemoteAttachmentBubble decides what
 * the decrypted bytes are (lib/chat/file-sniff.ts) before playing them.
 */

export const RECORDING_CANDIDATES = [
  'audio/mp4;codecs=mp4a.40.2',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/ogg;codecs=opus',
] as const;

export function pickRecordingMimeType(isTypeSupported: ((t: string) => boolean) | undefined): string {
  if (typeof isTypeSupported !== 'function') return '';
  for (const c of RECORDING_CANDIDATES) {
    try {
      if (isTypeSupported(c)) return c;
    } catch {
      /* some engines throw on unknown types */
    }
  }
  return '';
}

/** File extension for a recorded MIME type (only the base type matters). */
export function extensionForRecording(mime: string): 'm4a' | 'aac' | 'ogg' | 'webm' {
  const base = (mime || '').split(';')[0].trim().toLowerCase();
  if (base === 'audio/mp4' || base === 'audio/x-m4a') return 'm4a';
  if (base === 'audio/aac') return 'aac';
  if (base === 'audio/ogg') return 'ogg';
  return 'webm';
}
