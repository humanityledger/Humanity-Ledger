/**
 * Turns a note, a file, or a handoff into one ledger.record message.
 * The content key is wrapped to the MLS exporter secret. It is not written
 * into the message. A copy is kept in this device's record-key store so the
 * record can still be opened after that epoch is gone.
 */
import {
  bindFileUrl,
  encodeRecordMessage,
  handoffBody,
  sealFileBody,
  sealHandoff,
  sealNote,
  wipeRecordKeys,
  type EpochSecret,
  type HandoffAction,
} from '@/vendor/ledger-record/src/index';
import { toHex } from '@/vendor/ledger-record/src/hex';
import { encodeRecordMessage as encodeLegacyMessage, sealNote as sealLegacyNote } from '@/vendor/ledger-record/src/v1';
import { rememberRecordKey } from './record-keys';

const EVM = /^0x[0-9a-fA-F]{40}$/;
const URL_RE = /^\/api\/chat\/attachments\/[0-9a-f]{32}$/;

export class RecordSendError extends Error {}

export function recordMembers(...ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== 'string') throw new RecordSendError('This conversation has no address to seal for');
    const member = EVM.test(id) ? id.toLowerCase() : id.trim();
    if (member) out.push(member);
  }
  return out;
}

async function keep(id: string, generation: number, key: Uint8Array): Promise<void> {
  try { await rememberRecordKey(id, generation, key); } finally { wipeRecordKeys(key); }
}

/**
 * This messaging build does not export the MLS epoch secret. The note is still
 * sealed, and the key rides inside the message. The message itself is already
 * end-to-end encrypted by MLS, so the other person can open it. This is not
 * the epoch wrap. It is the same protection as the rest of the chat.
 */
export async function sealNoteInsideMessage(text: string, members: string[], label = 'Note'): Promise<string> {
  const pointer = await sealLegacyNote({ text, members: recordMembers(...members), label });
  return encodeLegacyMessage(pointer);
}

export async function sealNoteMessage(text: string, members: string[], epoch: EpochSecret, label = 'Note'): Promise<string> {
  const sealed = await sealNote({ text, members: recordMembers(...members), epoch, label });
  const message = sealed.message;
  await keep(sealed.pointer.id, sealed.pointer.generation, sealed.contentKey);
  return message;
}

export async function sealHandoffMessage(args: {
  action: HandoffAction;
  peer: string;
  members: string[];
  epoch: EpochSecret;
  commitment?: string;
}): Promise<string> {
  const sealed = await sealHandoff({ ...args, members: recordMembers(...args.members) });
  const message = sealed.message;
  await keep(sealed.pointer.id, sealed.pointer.generation, sealed.contentKey);
  return message;
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
    if (res.status === 503 || data.error === 'storage_unavailable') {
      throw new RecordSendError('storage_unavailable');
    }
    throw new RecordSendError('Could not store the sealed file');
  }
  if (!URL_RE.test(data.url)) throw new RecordSendError('Storage returned a path this chat will not open');
  return { url: data.url, contentDigest: data.contentDigest };
}

export async function sealFileMessage(
  file: Blob,
  filename: string,
  members: string[],
  epoch: EpochSecret,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (file.size === 0) throw new RecordSendError('The file is empty');
  const label = (filename || 'File').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80) || 'File';
  const placeholder = '/api/chat/attachments/' + '00'.repeat(16);
  const reader = {
    size: file.size,
    read: async (start: number, end: number) => new Uint8Array(await file.slice(start, end).arrayBuffer()),
  };
  let last = 'Could not store the sealed file';
  for (let attempt = 0; attempt < 2; attempt++) {
    const sealed = await sealFileBody(new Uint8Array(), { label, members: recordMembers(...members), epoch, url: placeholder, reader });
    try {
      const up = await uploadCiphertext(sealed.ciphertext, fetchImpl);
      if (up.contentDigest !== sealed.pointer.digest) {
        wipeRecordKeys(sealed.contentKey);
        throw new RecordSendError('The server stored something other than what was sent');
      }
      const message = bindFileUrl(sealed.pointer, up.url);
      await keep(sealed.pointer.id, sealed.pointer.generation, sealed.contentKey);
      return message;
    } catch (error) {
      const reason = error instanceof Error ? error.message : last;
      if (reason === 'storage_unavailable' || reason === 'File storage is unavailable') {
        const inline = { ...sealed.pointer, inline: toHex(sealed.ciphertext) };
        delete inline.url;
        const message = encodeRecordMessage(inline);
        if (message.length <= 48_000) {
          await keep(sealed.pointer.id, sealed.pointer.generation, sealed.contentKey);
          return message;
        }
        wipeRecordKeys(sealed.contentKey);
        throw new RecordSendError('File storage is not available, and this file is too large to keep inside the message.');
      }
      wipeRecordKeys(sealed.contentKey);
      last = reason;
      if (last === 'The server stored something other than what was sent') throw error;
    }
  }
  throw new RecordSendError(last === 'storage_unavailable' ? 'File storage is not available, and this file is too large to keep inside the message.' : last);
}

export { encodeRecordMessage, handoffBody };
