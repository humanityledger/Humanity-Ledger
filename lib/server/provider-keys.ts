/**
 * lib/server/provider-keys.ts — server only (F-07).
 *
 * Third-party API keys are read here, at run time, from server variables without the
 * NEXT_PUBLIC_ prefix. Next.js copies every NEXT_PUBLIC_* value into the JavaScript it builds,
 * so a key under that prefix is one client import away from being published to every visitor.
 * `import 'server-only'` makes the build fail if a client component ever imports this module.
 *
 * Publishable keys that are meant for the browser (the PeerJS signalling key, the MoonPay
 * publishable key) are not here; they keep NEXT_PUBLIC_ and are restricted by domain in the
 * provider's console instead.
 */
import 'server-only';

export type ProviderKeyName = 'ALCHEMY_API_KEY' | 'PIMLICO_API_KEY' | 'COINGECKO_KEY' | 'ONEINCH_API_KEY' | 'NEWS_API_KEY';

/** The key, or undefined when it is not configured. Never a default value. */
export function providerKey(name: ProviderKeyName): string | undefined {
  const v = process.env[name];
  const t = typeof v === 'string' ? v.trim() : '';
  return t ? t : undefined;
}
