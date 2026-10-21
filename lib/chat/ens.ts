// lib/chat/ens.ts
const cache = new Map<string, { name: string; expires: number }>();

export async function resolveCachedENS(address: string): Promise<string | null> {
  const cached = cache.get(address.toLowerCase());
  if (cached && cached.expires > Date.now()) return cached.name;
  return null;
}
