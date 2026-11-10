import { describe, it, expect } from 'vitest';

import {
  attachmentPreview,
  decryptAttachment,
  encodeAttachmentMessage,
  encryptAttachment,
  fromHex,
  isAttachmentMessage,
  kindForMime,
  parseAttachmentMessage,
  sha256Hex,
  toHex,
} from '@/lib/chat/remote-attachment';
import { looksLikePlaintextFile, renderableAs, sniffType } from '@/lib/chat/file-sniff';
import { INLINE_MAX_BYTES, prepareAttachmentMessage } from '@/lib/chat/send-attachment';
import { signV4 } from '@/lib/storage/r2';

const bytes = (...b: number[]) => new Uint8Array(b);
const M4A = bytes(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20, 1, 2, 3, 4);

async function hkdfAesKey(secret: Uint8Array, salt: Uint8Array) {
  const ikm = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: new Uint8Array(0) }, ikm, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

describe('encryptAttachment / decryptAttachment', () => {
  it('round-trips and uses fresh key material every time', async () => {
    const plain = new TextEncoder().encode('voice note bytes');
    const a = await encryptAttachment(plain);
    const b = await encryptAttachment(plain);
    expect(a.secret).not.toBe(b.secret);
    expect(a.salt).not.toBe(b.salt);
    expect(toHex(a.ciphertext)).not.toBe(toHex(b.ciphertext));
    expect(a.ciphertext.byteLength).toBe(plain.byteLength + 16);
    expect(a.contentDigest).toBe(await sha256Hex(a.ciphertext));
    expect(new TextDecoder().decode(await decryptAttachment(a.ciphertext, a))).toBe('voice note bytes');
  });

  it('follows the XMTP RemoteAttachment derivation (HKDF-SHA256 secret+salt, empty info, AES-256-GCM)', async () => {
    const plain = new TextEncoder().encode('interop check');
    const enc = await encryptAttachment(plain);
    const key = await hkdfAesKey(fromHex(enc.secret), fromHex(enc.salt));
    const out = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromHex(enc.nonce) }, key, enc.ciphertext));
    expect(new TextDecoder().decode(out)).toBe('interop check');
  });

  it('rejects a swapped, truncated or tampered ciphertext before rendering anything', async () => {
    const a = await encryptAttachment(bytes(1, 2, 3, 4, 5));
    const b = await encryptAttachment(bytes(9, 9, 9, 9, 9));
    await expect(decryptAttachment(b.ciphertext, a)).rejects.toThrow(/digest/);
    await expect(decryptAttachment(a.ciphertext.subarray(0, 10), a)).rejects.toThrow(/digest/);
    const flipped = a.ciphertext.slice();
    flipped[0] ^= 1;
    // Digest updated to match, so only the GCM tag can catch it.
    await expect(decryptAttachment(flipped, { ...a, contentDigest: await sha256Hex(flipped) })).rejects.toThrow(/decrypted/);
  });

  it('refuses an empty file', async () => {
    await expect(encryptAttachment(new Uint8Array(0))).rejects.toThrow(/empty/);
  });
});

describe('attachment message', () => {
  const base = {
    kind: 'audio' as const,
    url: '/api/chat/attachments/' + 'a'.repeat(32),
    contentDigest: 'b'.repeat(64),
    secret: 'c'.repeat(64),
    salt: 'd'.repeat(64),
    nonce: 'e'.repeat(24),
    contentLength: 1234,
    mimeType: 'audio/mp4;codecs=mp4a.40.2',
    filename: 'voice.m4a',
  };

  it('encodes, parses and labels without the key', () => {
    const text = encodeAttachmentMessage(base);
    const parsed = parseAttachmentMessage(text);
    expect(parsed?.mimeType).toBe('audio/mp4');
    expect(isAttachmentMessage(text)).toBe(true);
    expect(attachmentPreview(parsed)).toBe('Voice message');
    expect(attachmentPreview(parsed)).not.toContain(base.secret);
  });

  it('only accepts our own attachment path, never another host', () => {
    for (const url of ['https://evil.example/x', '//evil.example/api/chat/attachments/' + 'a'.repeat(32), '/api/chat/attachments/../../x', '/api/chat/attachments/' + 'A'.repeat(32)]) {
      const text = JSON.stringify({ type: 'hl.attachment', v: 1, scheme: 'aes-256-gcm-hkdf-sha256', ...base, mimeType: 'audio/mp4', url });
      expect(parseAttachmentMessage(text)).toBeNull();
    }
    expect(() => encodeAttachmentMessage({ ...base, url: 'https://evil.example/x' })).toThrow();
  });

  it('rejects malformed key material and ordinary text', () => {
    expect(parseAttachmentMessage(JSON.stringify({ type: 'hl.attachment', v: 1, scheme: 'aes-256-gcm-hkdf-sha256', ...base, nonce: 'e'.repeat(23) }))).toBeNull();
    expect(parseAttachmentMessage('hello')).toBeNull();
    expect(parseAttachmentMessage('{"type":"hl.attachment"')).toBeNull();
  });

  it('cleans file names that try to be paths', () => {
    const parsed = parseAttachmentMessage(encodeAttachmentMessage({ ...base, kind: 'file', filename: '../../etc/passwd\n' }));
    expect(parsed?.filename).not.toMatch(/[\/\n]/);
  });

  it('never treats SVG as an image', () => {
    expect(kindForMime('image/svg+xml')).toBe('file');
    expect(kindForMime('image/png')).toBe('image');
    expect(kindForMime('application/octet-stream', true)).toBe('audio');
  });
});

describe('file-sniff', () => {
  it('identifies voice-note containers by their bytes', () => {
    expect(sniffType(M4A, 'audio')).toBe('audio/mp4');
    expect(sniffType(bytes(0x1a, 0x45, 0xdf, 0xa3, 0), 'audio')).toBe('audio/webm');
    expect(sniffType(bytes(0xff, 0xf1, 0x50, 0x80), 'audio')).toBe('audio/aac');
    expect(renderableAs(sniffType(M4A, 'audio'), 'audio')).toBe(true);
  });

  it('does not render HTML or SVG claiming to be an image', () => {
    const svg = new TextEncoder().encode('<svg onload=alert(1)>');
    expect(renderableAs(sniffType(svg, 'image'), 'image')).toBe(false);
    expect(looksLikePlaintextFile(svg)).toBe(true);
  });

  it('flags plain files but almost never random ciphertext', async () => {
    expect(looksLikePlaintextFile(M4A)).toBe(true);
    let flagged = 0;
    for (let i = 0; i < 2000; i++) {
      const enc = await encryptAttachment(bytes(i & 255, 1, 2, 3));
      if (looksLikePlaintextFile(enc.ciphertext)) flagged++;
    }
    expect(flagged).toBe(0);
  });
});

describe('prepareAttachmentMessage', () => {
  const file = new Blob([M4A], { type: 'audio/mp4' });

  it('uploads only ciphertext and returns an encrypted message', async () => {
    let sent: Uint8Array | null = null;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      sent = new Uint8Array(init.body as Uint8Array);
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/octet-stream');
      return new Response(JSON.stringify({ url: '/api/chat/attachments/' + 'f'.repeat(32), contentDigest: await sha256Hex(sent!), size: sent!.byteLength }), { status: 200 });
    }) as unknown as typeof fetch;
    const out = await prepareAttachmentMessage(file, { filename: 'v.m4a', mimeType: 'audio/mp4', isVoiceNote: true }, fetchImpl);
    expect(out.mode).toBe('encrypted');
    expect(looksLikePlaintextFile(sent!)).toBe(false);
    expect(toHex(sent!)).not.toContain(toHex(M4A));
    const att = parseAttachmentMessage(out.message)!;
    expect(new Uint8Array(await decryptAttachment(sent!, att))).toEqual(M4A);
  });

  it('refuses a server that reports a different digest', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ url: '/api/chat/attachments/' + 'f'.repeat(32), contentDigest: '0'.repeat(64) }), { status: 200 })) as unknown as typeof fetch;
    await expect(prepareAttachmentMessage(file, { filename: 'v.m4a', mimeType: 'audio/mp4' }, fetchImpl)).rejects.toThrow(/other than/);
  });

  it('falls back to an inline XMTP message only when storage is down and the file is small', async () => {
    const down = (async () => new Response(JSON.stringify({ error: 'storage_unavailable' }), { status: 503 })) as unknown as typeof fetch;
    const small = await prepareAttachmentMessage(file, { filename: 'v.m4a', mimeType: 'audio/mp4', isVoiceNote: true }, down);
    expect(small.mode).toBe('inline');
    expect(small.message.startsWith('__AUDIO__data:audio/mp4;base64,')).toBe(true);
    const big = new Blob([new Uint8Array(INLINE_MAX_BYTES + 1)], { type: 'application/pdf' });
    await expect(prepareAttachmentMessage(big, { filename: 'a.pdf', mimeType: 'application/pdf' }, down)).rejects.toThrow(/700 KB/);
  });

  it('re-encrypts once when the server suspects plaintext', async () => {
    let calls = 0;
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      calls++;
      if (calls === 1) return new Response(JSON.stringify({ error: 'plaintext_suspected' }), { status: 422 });
      const body = new Uint8Array(init.body as Uint8Array);
      return new Response(JSON.stringify({ url: '/api/chat/attachments/' + 'f'.repeat(32), contentDigest: await sha256Hex(body) }), { status: 200 });
    }) as unknown as typeof fetch;
    const out = await prepareAttachmentMessage(file, { filename: 'v.m4a', mimeType: 'audio/mp4' }, fetchImpl);
    expect(calls).toBe(2);
    expect(out.mode).toBe('encrypted');
  });
});

describe('signV4 (R2 / S3)', () => {
  it('matches the AWS documentation example "GET Object"', () => {
    // https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
    const headers = signV4({
      method: 'GET',
      host: 'examplebucket.s3.amazonaws.com',
      path: '/test.txt',
      region: 'us-east-1',
      service: 's3',
      headers: { range: 'bytes=0-9' },
      payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      amzDate: '20130524T000000Z',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    });
    expect(headers.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, ' +
      'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, ' +
      'Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
  });
});
