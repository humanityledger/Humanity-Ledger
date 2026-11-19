/**
 * lib/chat/seal-record.ts
 *
 * Turns a note or a file into one Ledger Chat message of type ledger.record.
 * The protocol lives in vendor/ledger-record (the ledger-record repository).
 * This file only supplies the conversation's members and, for a file, the
 * ciphertext upload. Plaintext is never posted.
 */
import {
  buildPointer,
  encodeRecordMessage,
  sealFileBody,
  sealNote,
  type RecordPointer,
} from '@/vendor/ledger-record/src/index';
import { toHex } from '@/vendor/ledger-record/src/hex';

const EVM = /^0x[0-9a-fA-F]{40}$/;
const URL_RE = /^\/api\/chat\/attachments\/[0-9a-f]{32}$/;

export class RecordSendError extends Error {}

/** Addresses are lowercased so both devices name the same set. */
export function recordMembers(...ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== 'string') throw new RecordSendError('This conversation has no address to seal for');
    const member = EVM.test(id) ? id.toLowerCase() : id.trim();
    if (member) out.push(member);
  }
  return out;
}

export async function sealNoteMessage(text: string, members: string[], label = 'Note'): Promise<string> {
  const pointer = await sealNote({ text, members: recordMembers(...members), label });
  return encodeRecordMessage(pointer);
}

async function uploadCiphertext(ciphertext: Uint8Array, fetchImpl: typeof fetch): Promise<{ url: string; contentDigest: string }> {
  let res: Response;
  try {
    res = await fetchImpl('/api/chat/attachments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: ciphertext as BodyInit,
      credentials: 'same-origin',
    });
  } catch {
    throw new RecordSendError('File storage is unavailable');
  }
  const data = await res.json().catch(() => ({} as { url?: unknown; contentDigest?: unknown; error?: unknown }));
  if (!res.ok || typeof data.url !== 'string' || typeof data.contentDigest !== 'string') {
    throw new RecordSendError(typeof data.error === 'string' ? data.error : 'Could not store the sealed file');
  }
  if (!URL_RE.test(data.url)) throw new RecordSendError('Storage returned a path this chat will not open');
  return { url: data.url, contentDigest: data.contentDigest };
}

/** Encrypt on this device, upload ciphertext only, return the pointer message. */
export async function sealFileMessage(
  file: Blob,
  filename: string,
  members: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (file.size === 0) throw new RecordSendError('The file is empty');
  const plain = new Uint8Array(await file.arrayBuffer());
  const label = (filename || 'File').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80) || 'File';
  // A second attempt covers the rare ciphertext the server mistakes for a plain file.
  let last = 'Could not store the sealed file';
  for (let attempt = 0; attempt < 2; attempt++) {
    const sealed = await sealFileBody(plain);
    try {
      const up = await uploadCiphertext(sealed.ciphertext, fetchImpl);
      if (up.contentDigest !== sealed.digest) throw new RecordSendError('The server stored something other than what was sent');
      const pointer: RecordPointer = await buildPointer({
        kind: 'file',
        label,
        members: recordMembers(...members),
        plain,
        sealed,
        url: up.url,
      });
      return encodeRecordMessage(pointer);
    } catch (error) {
      last = error instanceof Error ? error.message : last;
      if (last === 'The server stored something other than what was sent') throw error;
    }
  }
  throw new RecordSendError(last);
}

export { toHex };
