/**
 * lib/chat/file-sniff.ts
 *
 * Decides what a file really is from its first bytes. Used by the recipient
 * AFTER decrypting an attachment (the server only sees ciphertext, so the
 * magic-byte check that used to run in /api/chat/attachments now runs here).
 *
 * Only these types are ever rendered inline (<img>, <video>, <audio>). Anything
 * else, including SVG and HTML, is offered as a download with a neutral
 * application/octet-stream type, so a file cannot run script in the chat.
 */

export type SniffedType =
  | 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
  | 'video/mp4' | 'video/webm'
  | 'audio/mp4' | 'audio/webm' | 'audio/ogg' | 'audio/mpeg' | 'audio/wav' | 'audio/aac'
  | 'application/pdf'
  | 'application/octet-stream';

function at(b: Uint8Array, offset: number, sig: number[]): boolean {
  if (b.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (b[offset + i] !== sig[i]) return false;
  return true;
}

/**
 * @param declaredKind what the message says it is; disambiguates containers
 *        that hold either audio or video (MP4 'ftyp', WebM EBML).
 */
export function sniffType(bytes: Uint8Array, declaredKind: 'audio' | 'image' | 'video' | 'file'): SniffedType {
  const b = bytes.subarray(0, 16);
  if (at(b, 0, [0x89, 0x50, 0x4e, 0x47])) return 'image/png';
  if (at(b, 0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (at(b, 0, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (at(b, 0, [0x52, 0x49, 0x46, 0x46]) && at(b, 8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp';
  if (at(b, 0, [0x52, 0x49, 0x46, 0x46]) && at(b, 8, [0x57, 0x41, 0x56, 0x45])) return 'audio/wav';
  if (at(b, 0, [0x25, 0x50, 0x44, 0x46])) return 'application/pdf';
  if (at(b, 4, [0x66, 0x74, 0x79, 0x70])) return declaredKind === 'audio' ? 'audio/mp4' : 'video/mp4';
  if (at(b, 0, [0x1a, 0x45, 0xdf, 0xa3])) return declaredKind === 'audio' ? 'audio/webm' : 'video/webm';
  if (at(b, 0, [0x4f, 0x67, 0x67, 0x53])) return 'audio/ogg';
  if (at(b, 0, [0x49, 0x44, 0x33]) || at(b, 0, [0xff, 0xfb]) || at(b, 0, [0xff, 0xf3]) || at(b, 0, [0xff, 0xf2])) return 'audio/mpeg';
  // ADTS AAC (Safari's audio/aac recorder): 12-bit sync word 0xFFF, layer 0.
  if (b.length >= 2 && b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return 'audio/aac';
  return 'application/octet-stream';
}

/** Whether the bytes are of a type that may be rendered as the given kind. */
export function renderableAs(type: SniffedType, kind: 'audio' | 'image' | 'video' | 'file'): boolean {
  if (kind === 'image') return type.startsWith('image/');
  if (kind === 'video') return type.startsWith('video/');
  if (kind === 'audio') return type.startsWith('audio/');
  return false;
}

/**
 * True if the bytes start like a common plaintext media or document file.
 * The upload route uses this to refuse a client that forgot to encrypt.
 * Only signatures of 3 bytes or more are used, so random ciphertext matches
 * with probability below 2^-23 (the client re-encrypts once if it happens).
 * The short MP3 and AAC frame syncs are deliberately left out: they would
 * reject about one real ciphertext in 12,000.
 */
export function looksLikePlaintextFile(bytes: Uint8Array): boolean {
  return at(bytes, 0, [0x89, 0x50, 0x4e, 0x47]) || // PNG
    at(bytes, 0, [0xff, 0xd8, 0xff]) ||             // JPEG
    at(bytes, 0, [0x47, 0x49, 0x46, 0x38]) ||       // GIF8
    at(bytes, 0, [0x52, 0x49, 0x46, 0x46]) ||       // RIFF (WebP, WAV)
    at(bytes, 0, [0x25, 0x50, 0x44, 0x46]) ||       // %PDF
    at(bytes, 4, [0x66, 0x74, 0x79, 0x70]) ||       // ....ftyp (MP4, M4A, MOV)
    at(bytes, 0, [0x1a, 0x45, 0xdf, 0xa3]) ||       // EBML (WebM)
    at(bytes, 0, [0x4f, 0x67, 0x67, 0x53]) ||       // OggS
    at(bytes, 0, [0x49, 0x44, 0x33]) ||             // ID3 (MP3)
    at(bytes, 0, [0x50, 0x4b, 0x03, 0x04]) || // ZIP / DOCX / XLSX
    at(bytes, 0, [0x3c, 0x3f, 0x78, 0x6d]) || // <?xm
    at(bytes, 0, [0x3c, 0x73, 0x76, 0x67]) || // <svg
    at(bytes, 0, [0x3c, 0x21, 0x44, 0x4f]) || // <!DO
    at(bytes, 0, [0x3c, 0x68, 0x74, 0x6d]);   // <htm
}
