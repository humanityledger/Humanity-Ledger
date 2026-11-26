import { promises as dns } from 'dns';
import { isIP, BlockList } from 'net';
import { validateUrlForFetch } from '@/lib/security/ssrfGuard';
import { isBlockedIp } from '@/lib/security/ipPolicy';

/**
 * Checks a user-supplied webhook URL before it is stored: https only, port 443,
 * no credentials, not a private/metadata host, and every address the name
 * resolves to is public. Delivery must still fetch through
 * lib/security/publicFetch (publicOnlyLookup) so a later DNS change
 * (rebinding) cannot point it inward.
 */
export async function checkWebhookUrl(raw: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (raw.length > 512) return { ok: false, reason: 'webhookUrl too long (max 512 chars).' };
  let u: URL;
  try { u = new URL(raw); } catch { return { ok: false, reason: 'webhookUrl is not a valid URL.' }; }
  if (u.protocol !== 'https:') return { ok: false, reason: 'webhookUrl must use https://.' };
  if (u.port && u.port !== '443') return { ok: false, reason: 'webhookUrl must use port 443.' };
  if (u.username || u.password) return { ok: false, reason: 'webhookUrl must not contain credentials.' };
  const guard = validateUrlForFetch(raw);
  if (!guard.safe) return { ok: false, reason: `webhookUrl rejected: ${guard.reason}` };
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) return isBlockedIp(host) ? { ok: false, reason: 'webhookUrl points to a private address.' } : { ok: true };
  try {
    const addrs = await dns.lookup(host, { all: true, verbatim: true });
    if (!addrs.length || addrs.some(a => isBlockedIp(a.address))) {
      return { ok: false, reason: 'webhookUrl resolves to a private address.' };
    }
  } catch {
    return { ok: false, reason: 'webhookUrl host does not resolve.' };
  }
  return { ok: true };
}

const MAX_WHITELIST = 32;

function validIpOrCidr(v: string): boolean {
  const [ip, bits, extra] = v.split('/');
  if (extra !== undefined) return false;
  const fam = isIP(ip);
  if (!fam) return false;
  if (bits === undefined) return true;
  if (!/^\d{1,3}$/.test(bits)) return false;
  const n = Number(bits);
  return fam === 4 ? n <= 32 : n <= 128;
}

/** ipWhitelist: at most 32 entries, each an IPv4/IPv6 address or CIDR. */
export function parseIpWhitelist(input: unknown): { ok: true; value: string[] } | { ok: false; reason: string } {
  if (!Array.isArray(input)) return { ok: false, reason: 'ipWhitelist must be an array of strings.' };
  if (input.length > MAX_WHITELIST) return { ok: false, reason: `ipWhitelist allows at most ${MAX_WHITELIST} entries.` };
  const out: string[] = [];
  for (const v of input) {
    if (typeof v !== 'string' || !validIpOrCidr(v.trim())) {
      return { ok: false, reason: 'Each ipWhitelist entry must be an IPv4/IPv6 address or CIDR.' };
    }
    out.push(v.trim());
  }
  return { ok: true, value: [...new Set(out)] };
}

/** True when ip equals an entry or falls inside a CIDR entry of the whitelist. */
export function ipInWhitelist(ip: string, whitelist: readonly string[]): boolean {
  const fam = isIP(ip);
  if (!fam) return false;
  const list = new BlockList();
  for (const entry of whitelist) {
    const [addr, bits] = entry.split('/');
    const f = isIP(addr);
    if (!f) continue;
    const type = f === 4 ? 'ipv4' : 'ipv6';
    try {
      if (bits === undefined) list.addAddress(addr, type);
      else list.addSubnet(addr, Number(bits), type);
    } catch {}
  }
  return list.check(ip, fam === 4 ? 'ipv4' : 'ipv6');
}
