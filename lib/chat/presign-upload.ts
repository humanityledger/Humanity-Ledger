/**
 * Shared client helper for requesting short-lived S3v4 presigned PUT URLs from
 * /api/chat/attachments/presign and uploading encrypted blobs directly to R2.
 */

export interface PresignSlot {
  id: string;
  uploadUrl: string;
  url: string;
  headers?: Record<string, string>;
}

export type PresignBatchResult =
  | { mode: 'direct'; slots: PresignSlot[] }
  | { mode: 'proxy' }
  | { mode: 'rejected'; status: number; error: string };

export function shouldAttemptDirectPresign(fetchImpl: typeof fetch, directUpload?: boolean): boolean {
  if (directUpload === true) return true;
  if (directUpload === false) return false;
  return typeof window !== 'undefined' && fetchImpl === globalThis.fetch;
}

export async function requestPresignSlots(
  fetchImpl: typeof fetch,
  sizes: number[],
  scope: 'attachment' | 'status' | 'avatar' = 'attachment',
  signal?: AbortSignal,
): Promise<PresignBatchResult> {
  if (!sizes.length) return { mode: 'proxy' };
  let res: Response;
  try {
    res = await fetchImpl('/api/chat/attachments/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sizes.length === 1 ? { size: sizes[0], scope } : { sizes, scope }),
      credentials: 'same-origin',
      signal,
    });
  } catch {
    return { mode: 'proxy' };
  }

  if (res.status === 404 || res.status === 405 || res.status === 501) {
    return { mode: 'proxy' };
  }

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    return {
      mode: 'rejected',
      status: res.status,
      error: typeof data?.error === 'string' ? data.error : `Presign failed (${res.status})`,
    };
  }

  if (data?.mode !== 'direct' || !Array.isArray(data?.items) || data.items.length !== sizes.length) {
    return { mode: 'proxy' };
  }

  const slots: PresignSlot[] = [];
  for (const item of data.items) {
    if (!item || typeof item.id !== 'string' || typeof item.uploadUrl !== 'string' || typeof item.url !== 'string') {
      return { mode: 'proxy' };
    }
    slots.push({ id: item.id, uploadUrl: item.uploadUrl, url: item.url, headers: item.headers });
  }
  return { mode: 'direct', slots };
}

export async function putToPresignedUrl(
  fetchImpl: typeof fetch,
  slot: PresignSlot,
  ciphertext: Uint8Array,
  signal?: AbortSignal,
): Promise<Response> {
  return fetchImpl(slot.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': slot.headers?.['Content-Type'] || 'application/octet-stream' },
    body: ciphertext as BodyInit,
    signal,
  });
}
