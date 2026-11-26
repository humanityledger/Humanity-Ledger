/**
 * SCAN instead of KEYS (Titan V4 §2): KEYS blocks Redis for the whole keyspace.
 * Iterates with a cursor, COUNT per step, and stops at `max` keys so a request
 * can never walk an unbounded keyspace. Works with ioredis-style clients
 * (scan(cursor, 'MATCH', p, 'COUNT', n) → [cursor, keys]).
 */
export interface ScanClient { scan: (...args: any[]) => Promise<[string | number, string[]] | unknown> }

export async function scanKeys(client: ScanClient | null | undefined, pattern: string, max = 10_000, count = 500): Promise<string[]> {
  if (!client || typeof client.scan !== 'function') return [];
  const out = new Set<string>();
  let cursor = '0';
  for (let i = 0; i < 10_000; i++) {
    const r = (await client.scan(cursor, 'MATCH', pattern, 'COUNT', count)) as [string | number, string[]];
    if (!Array.isArray(r) || r.length < 2) break;
    for (const k of r[1] ?? []) { out.add(k); if (out.size >= max) return [...out]; }
    cursor = String(r[0]);
    if (cursor === '0') break;
  }
  return [...out];
}

/** Deletes every key matching `pattern`, in batches of 500. Returns how many were deleted. */
export async function scanDelete(client: (ScanClient & { del: (...k: string[]) => Promise<unknown> }) | null | undefined, pattern: string, max = 10_000): Promise<number> {
  const keys = await scanKeys(client, pattern, max);
  for (let i = 0; i < keys.length; i += 500) await client!.del(...keys.slice(i, i + 500));
  return keys.length;
}
