/**
 * Files above 20 MB (lib/chat/large-file.ts): encrypted on the device in 16 MiB pieces, each
 * stored as ciphertext through /api/chat/attachments, and put back together only by a recipient
 * holding the key. A fake storage stands in for the route.
 */
import { describe, expect, it } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import {
  PIECE_BYTES, blobSink, formatBytes, parseLargeFileMessage, pieceCount, receiveLargeFile, sendLargeFile,
} from '@/lib/chat/large-file';
import { isAttachmentMessage } from '@/lib/chat/remote-attachment';

function fakeStorage(opts: { lie?: boolean; down?: boolean; busyOnce?: boolean } = {}) {
  const store = new Map<string, Uint8Array>();
  const seen: Uint8Array[] = [];
  let busy = opts.busyOnce ?? false;
  const f = (async (url: string, init?: RequestInit) => {
    if (opts.down) return new Response(JSON.stringify({ error: 'storage_unavailable' }), { status: 503 });
    if (busy) { busy = false; return new Response('{}', { status: 429, headers: { 'retry-after': '0.01' } }); }
    if (init?.method === 'POST') {
      const body = new Uint8Array(init.body as Uint8Array);
      seen.push(body);
      const id = randomBytes(16).toString('hex');
      store.set(id, body);
      const digest = opts.lie ? '0'.repeat(64) : createHash('sha256').update(body).digest('hex');
      return new Response(JSON.stringify({ url: `/api/chat/attachments/${id}`, contentDigest: digest }));
    }
    const id = url.split('/').pop()!;
    const b = store.get(id);
    return b ? new Response(b) : new Response('{}', { status: 404 });
  }) as unknown as typeof fetch;
  return { f, store, seen };
}

describe('large files', () => {
  it('round-trips a file of several pieces, and the server only ever sees ciphertext', async () => {
    const plain = randomBytes(PIECE_BYTES * 2 + 12345);
    const { f, seen } = fakeStorage();
    const progress: number[] = [];
    const text = await sendLargeFile(new Blob([plain]), { filename: 'archive.zip', mimeType: 'application/zip' }, { fetchImpl: f, onProgress: (p) => progress.push(p.done) });
    expect(seen).toHaveLength(3);
    for (const piece of seen) expect(Buffer.from(piece).includes(plain.subarray(0, 64))).toBe(false);
    expect(progress.at(-1)).toBe(plain.length);
    const msg = parseLargeFileMessage(text)!;
    expect(msg.pieces).toHaveLength(pieceCount(plain.length));
    expect(isAttachmentMessage(text)).toBe(true);
    const out = await receiveLargeFile(msg, blobSink(msg.mimeType), { fetchImpl: f });
    expect(Buffer.from(await out!.arrayBuffer()).equals(plain)).toBe(true);
  }, 60_000);

  it('refuses pieces swapped in the message, and a server that stored something else', async () => {
    const plain = randomBytes(PIECE_BYTES + 10);
    const { f } = fakeStorage();
    const msg = parseLargeFileMessage(await sendLargeFile(new Blob([plain]), { filename: 'a.bin', mimeType: '' }, { fetchImpl: f }))!;
    const swapped = { ...msg, pieces: [msg.pieces[1], msg.pieces[0]] };
    await expect(receiveLargeFile(swapped, blobSink(''), { fetchImpl: f })).rejects.toThrow(/could not be decrypted|does not match/);
    const liar = fakeStorage({ lie: true });
    await expect(sendLargeFile(new Blob([plain]), { filename: 'a.bin', mimeType: '' }, { fetchImpl: liar.f })).rejects.toThrow(/other than/);
  }, 60_000);

  it('says plainly when storage is off, and waits out a busy server', async () => {
    const plain = randomBytes(PIECE_BYTES + 1);
    await expect(sendLargeFile(new Blob([plain]), { filename: 'a.bin', mimeType: '' }, { fetchImpl: fakeStorage({ down: true }).f })).rejects.toThrow(/not switched on/);
    const busy = fakeStorage({ busyOnce: true });
    expect(parseLargeFileMessage(await sendLargeFile(new Blob([plain]), { filename: 'a.bin', mimeType: '' }, { fetchImpl: busy.f }))).not.toBeNull();
  }, 60_000);

  it('never accepts a malformed message, and labels sizes for people', () => {
    expect(parseLargeFileMessage('{"type":"hl.largefile","v":1}')).toBeNull();
    expect(parseLargeFileMessage('hello')).toBeNull();
    expect(isAttachmentMessage('{"type":"hl.largefile","v":9}')).toBe(true);
    expect(formatBytes(1536 * 1024 * 1024)).toBe('1.5 GB');
    expect(formatBytes(700 * 1024 * 1024)).toBe('700 MB');
  });
});
