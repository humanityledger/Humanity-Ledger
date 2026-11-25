import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { r2PresignGet, r2PresignPut } from '@/lib/storage/r2';
import { prepareAttachmentMessage } from '@/lib/chat/send-attachment';
import { decryptAttachment, parseAttachmentMessage, sha256Hex } from '@/lib/chat/remote-attachment';
import { blobSink, PIECE_BYTES, parseLargeFileMessage, receiveLargeFile, sendLargeFile } from '@/lib/chat/large-file';

const h = vi.hoisted(() => ({
  caller: '0x' + 'a'.repeat(40) as string | null,
  rlAllowed: true,
  quotaAllowed: true,
  localData: new Map<string, Uint8Array>(),
}));

vi.mock('@/lib/security/verifiedCaller', () => ({
  getVerifiedCaller: async () => h.caller,
}));

vi.mock('@/lib/security/rateLimiter', () => ({
  checkRateLimit: async () => ({ allowed: h.rlAllowed, remaining: h.rlAllowed ? 100 : 0, resetAt: 9999999999 }),
}));

vi.mock('@/lib/redis/client', () => ({
  redisClient: {
    __isMock: false,
    eval: async () => (h.quotaAllowed ? 1024 : -1),
  },
}));

import { POST as PRESIGN_POST } from '@/app/api/chat/attachments/presign/route';
import { GET as ATT_GET } from '@/app/api/chat/attachments/[id]/route';

const R2_KEYS = ['R2_ACCOUNT_ID', 'R2_BUCKET_NAME', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'] as const;
const savedEnv: Record<string, string | undefined> = {};

function setR2(enabled: boolean) {
  if (!enabled) {
    for (const k of R2_KEYS) delete process.env[k];
    return;
  }
  process.env.R2_ACCOUNT_ID = 'acct123';
  process.env.R2_BUCKET_NAME = 'hl-bucket';
  process.env.R2_ACCESS_KEY_ID = 'AKIA_TEST_KEY';
  process.env.R2_SECRET_ACCESS_KEY = 'secret_test_key_material';
}

describe('R2 presigned URLs & direct encrypted uploads', () => {
  beforeEach(() => {
    for (const k of R2_KEYS) savedEnv[k] = process.env[k];
    h.caller = '0x' + 'a'.repeat(40);
    h.rlAllowed = true;
    h.quotaAllowed = true;
    h.localData.clear();
  });

  afterEach(() => {
    for (const k of R2_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  it('generates valid SigV4 query presigned PUT and GET URLs', () => {
    const cfg = { accountId: 'acct123', bucket: 'hl-bucket', accessKeyId: 'AKIA1', secretAccessKey: 'SECRET1' };
    const put = new URL(r2PresignPut(cfg, 'chat-attachments/0123456789abcdef0123456789abcdef', { expiresSec: 900, contentType: 'application/octet-stream' }));
    expect(put.origin).toBe('https://acct123.r2.cloudflarestorage.com');
    expect(put.pathname).toBe('/hl-bucket/chat-attachments/0123456789abcdef0123456789abcdef');
    expect(put.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(put.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(put.searchParams.get('X-Amz-SignedHeaders')).toBe('content-type;host');
    expect(put.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);

    const get = new URL(r2PresignGet(cfg, 'avatars/0123456789abcdef0123456789abcdef', { expiresSec: 300 }));
    expect(get.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(get.searchParams.get('X-Amz-Expires')).toBe('300');
  });

  it('rejects unauthenticated callers and out-of-bounds sizes/MIMEs on /api/chat/attachments/presign', async () => {
    setR2(true);
    h.caller = null;
    const unauth = await PRESIGN_POST(new NextRequest('https://ledgerchat.org/api/chat/attachments/presign', {
      method: 'POST', body: JSON.stringify({ size: 1024 }),
    }));
    expect(unauth.status).toBe(401);

    h.caller = '0x' + 'a'.repeat(40);
    const tooSmall = await PRESIGN_POST(new NextRequest('https://ledgerchat.org/api/chat/attachments/presign', {
      method: 'POST', body: JSON.stringify({ size: 8 }),
    }));
    expect(tooSmall.status).toBe(413);

    const badMime = await PRESIGN_POST(new NextRequest('https://ledgerchat.org/api/chat/attachments/presign', {
      method: 'POST', body: JSON.stringify({ size: 1000, scope: 'avatar', contentType: 'image/svg+xml' }),
    }));
    expect(badMime.status).toBe(415);
  });

  it('returns proxy mode without R2, direct batch presign URLs with R2, and 429 on exceeded Redis quota', async () => {
    setR2(false);
    const proxyRes = await PRESIGN_POST(new NextRequest('https://ledgerchat.org/api/chat/attachments/presign', {
      method: 'POST', body: JSON.stringify({ size: 1024 }),
    }));
    expect(proxyRes.status).toBe(200);
    expect(await proxyRes.json()).toEqual({ mode: 'proxy', fallbackUrl: '/api/chat/attachments' });

    setR2(true);
    const batchRes = await PRESIGN_POST(new NextRequest('https://ledgerchat.org/api/chat/attachments/presign', {
      method: 'POST', body: JSON.stringify({ sizes: [512, 1024, 2048], scope: 'attachment' }),
    }));
    expect(batchRes.status).toBe(200);
    const batch = await batchRes.json();
    expect(batch.mode).toBe('direct');
    expect(batch.items).toHaveLength(3);
    for (const item of batch.items) {
      expect(item.id).toMatch(/^[0-9a-f]{32}$/);
      expect(item.url).toBe(`/api/chat/attachments/${item.id}`);
      expect(item.uploadUrl).toContain('acct123.r2.cloudflarestorage.com');
    }

    h.quotaAllowed = false;
    const quotaRes = await PRESIGN_POST(new NextRequest('https://ledgerchat.org/api/chat/attachments/presign', {
      method: 'POST', body: JSON.stringify({ size: 1024 }),
    }));
    expect(quotaRes.status).toBe(429);
  });

  it('GET /api/chat/attachments/[id] redirects 307 directly to R2 presigned GET URL when R2 is configured', async () => {
    setR2(true);
    const id = '11223344556677889900aabbccddeeff';
    const res = await ATT_GET(new NextRequest(`https://ledgerchat.org/api/chat/attachments/${id}`), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(307);
    const loc = res.headers.get('location')!;
    expect(loc).toContain(`https://acct123.r2.cloudflarestorage.com/hl-bucket/chat-attachments/${id}`);
    expect(loc).toContain('X-Amz-Signature=');
    expect(res.headers.get('cache-control')).toBe('private, max-age=120');
  });

  it('prepareAttachmentMessage and sendLargeFile upload ciphertext directly via presigned PUT without hitting proxy POST', async () => {
    setR2(true);
    const r2Bucket = new Map<string, Uint8Array>();
    let proxyUploads = 0;
    let presignCalls = 0;

    const directFetch = (async (url: string, init?: RequestInit) => {
      if (url === '/api/chat/attachments/presign') {
        presignCalls++;
        return PRESIGN_POST(new NextRequest('https://ledgerchat.org/api/chat/attachments/presign', {
          method: 'POST', body: init?.body as string, headers: { 'content-type': 'application/json' },
        }));
      }
      if (url === '/api/chat/attachments' && init?.method === 'POST') {
        proxyUploads++;
        throw new Error('Should not hit Node proxy when R2 presign succeeds');
      }
      if (url.startsWith('https://acct123.r2.cloudflarestorage.com/hl-bucket/')) {
        const u = new URL(url);
        const id = u.pathname.split('/').pop()!;
        if (init?.method === 'PUT') {
          r2Bucket.set(id, new Uint8Array(init.body as Uint8Array));
          return new Response(null, { status: 200 });
        }
        const obj = r2Bucket.get(id);
        return obj ? new Response(obj as BodyInit, { status: 200 }) : new Response(null, { status: 404 });
      }
      if (url.startsWith('/api/chat/attachments/')) {
        const id = url.split('/').pop()!;
        const obj = r2Bucket.get(id);
        return obj ? new Response(obj as BodyInit, { status: 200 }) : new Response(null, { status: 404 });
      }
      return new Response(null, { status: 404 });
    }) as unknown as typeof fetch;

    const smallPlain = new TextEncoder().encode('direct presigned small attachment payload');
    const prep = await prepareAttachmentMessage(
      new Blob([smallPlain], { type: 'text/plain' }),
      { filename: 'note.txt', mimeType: 'text/plain' },
      directFetch,
      { directUpload: true },
    );
    expect(proxyUploads).toBe(0);
    expect(prep.mode).toBe('encrypted');
    const attMsg = parseAttachmentMessage(prep.message)!;
    const smallId = attMsg.url.split('/').pop()!;
    const cipherSmall = r2Bucket.get(smallId)!;
    expect(await sha256Hex(cipherSmall)).toBe(attMsg.contentDigest);
    expect(Buffer.from(await decryptAttachment(cipherSmall, attMsg)).equals(Buffer.from(smallPlain))).toBe(true);

    const largePlain = new Uint8Array(PIECE_BYTES + 4096);
    for (let i = 0; i < largePlain.length; i += 257) largePlain[i] = (i * 31) & 255;
    presignCalls = 0;
    const largeMsgStr = await sendLargeFile(
      new Blob([largePlain], { type: 'application/octet-stream' }),
      { filename: 'big.bin', mimeType: 'application/octet-stream' },
      { fetchImpl: directFetch, directUpload: true },
    );
    expect(proxyUploads).toBe(0);
    expect(presignCalls).toBe(1);
    const largeMsg = parseLargeFileMessage(largeMsgStr)!;
    expect(largeMsg.pieces).toHaveLength(2);
    const restored = await receiveLargeFile(largeMsg, blobSink('application/octet-stream'), { fetchImpl: directFetch });
    expect(Buffer.from(await restored!.arrayBuffer()).equals(Buffer.from(largePlain))).toBe(true);
  }, 15_000);
});
