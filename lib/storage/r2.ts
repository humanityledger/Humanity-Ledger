/**
 * lib/storage/r2.ts — minimal Cloudflare R2 client (S3 API, AWS Signature V4).
 *
 * Server only. Holds ciphertext for chat attachments (lib/chat/remote-attachment.ts);
 * it is never given plaintext. The bucket should be PRIVATE: objects are served
 * through /api/chat/attachments/[id], not from a public bucket URL.
 *
 * Written against the SigV4 spec instead of pulling in @aws-sdk/client-s3,
 * which is only a transitive dependency of this repo. signV4() is checked
 * against AWS's published "GET Object" example in
 * test/unit/chat/remote-attachment.test.ts.
 *
 * Env: R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.
 * Recommended: an R2 lifecycle rule that deletes objects under
 * "chat-attachments/" after 30 days (Ledger Chat keeps decrypted copies on
 * the devices that received them; the server copy is only for delivery).
 */
import { createHash, createHmac } from 'crypto';

export interface R2Config {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function r2ConfigFromEnv(env: Record<string, string | undefined> = process.env): R2Config | null {
  const accountId = env.R2_ACCOUNT_ID;
  const bucket = env.R2_BUCKET_NAME;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { accountId, bucket, accessKeyId, secretAccessKey };
}

const sha256Hex = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data).digest();

/** RFC 3986 encoding of each path segment, as S3 expects (slashes kept). */
function encodePath(path: string): string {
  return path
    .split('/')
    .map(seg => encodeURIComponent(seg).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase()))
    .join('/');
}

export interface SignInput {
  method: string;
  host: string;
  /** Absolute path, not yet encoded. */
  path: string;
  region: string;
  service: string;
  /** Extra headers to sign (lower-case names). host, x-amz-date and x-amz-content-sha256 are added. */
  headers?: Record<string, string>;
  payloadHash: string;
  /** YYYYMMDD'T'HHMMSS'Z' */
  amzDate: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Returns every header to send, including Authorization. No query string support (not needed). */
export function signV4(input: SignInput): Record<string, string> {
  const dateStamp = input.amzDate.slice(0, 8);
  const all: Record<string, string> = {
    ...Object.fromEntries(Object.entries(input.headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v).trim()])),
    host: input.host,
    'x-amz-content-sha256': input.payloadHash,
    'x-amz-date': input.amzDate,
  };
  const names = Object.keys(all).sort();
  const canonicalHeaders = names.map(n => `${n}:${all[n]}\n`).join('');
  const signedHeaders = names.join(';');
  const canonicalRequest = [
    input.method.toUpperCase(),
    encodePath(input.path),
    '',
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join('\n');
  const scope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', input.amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const kDate = hmac('AWS4' + input.secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, input.service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  const { host: _host, ...rest } = all; // fetch sets Host itself
  return {
    ...rest,
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

function amzNow(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function target(cfg: R2Config, key: string) {
  const host = `${cfg.accountId}.r2.cloudflarestorage.com`;
  const path = `/${cfg.bucket}/${key}`;
  return { host, path, url: `https://${host}${encodePath(path)}` };
}

export async function r2Put(cfg: R2Config, key: string, body: Uint8Array, contentType = 'application/octet-stream'): Promise<void> {
  const { host, path, url } = target(cfg, key);
  const headers = signV4({
    method: 'PUT', host, path, region: 'auto', service: 's3',
    headers: { 'content-type': contentType },
    payloadHash: sha256Hex(body),
    amzDate: amzNow(),
    accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey,
  });
  const res = await fetch(url, { method: 'PUT', headers, body: body as BodyInit });
  if (!res.ok) throw new Error(`R2 PUT failed with ${res.status}`);
}

/** Returns null when the object does not exist. */
export async function r2Get(cfg: R2Config, key: string): Promise<Uint8Array | null> {
  const { host, path, url } = target(cfg, key);
  const headers = signV4({
    method: 'GET', host, path, region: 'auto', service: 's3',
    payloadHash: sha256Hex(''),
    amzDate: amzNow(),
    accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey,
  });
  const res = await fetch(url, { method: 'GET', headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 GET failed with ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}
