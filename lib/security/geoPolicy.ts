/**
 * Edge-safe configurable geofencing country list resolver.
 * Never imports Node built-ins so Next.js Edge Middleware can bundle it directly.
 */

export const DEFAULT_RESTRICTED_COUNTRIES = [
  'US',
  'CU',
  'IR',
  'KP',
  'SY',
  'RU',
  'BY',
] as const;

let cachedRaw: string | undefined;
let cachedList: readonly string[] = DEFAULT_RESTRICTED_COUNTRIES;

export function parseRestrictedCountries(raw?: string | null): string[] {
  if (raw === undefined || raw === null) {
    return [...DEFAULT_RESTRICTED_COUNTRIES];
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return [...DEFAULT_RESTRICTED_COUNTRIES];
  }
  const lowered = trimmed.toLowerCase();
  if (lowered === 'off' || lowered === 'none' || lowered === 'false' || lowered === 'disabled') {
    return [];
  }
  const seen = new Set<string>();
  for (const part of trimmed.split(/[\s,;]+/)) {
    const code = part.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(code)) {
      seen.add(code);
    }
  }
  return Array.from(seen);
}

export function resolveRestrictedCountries(
  raw: string | undefined = process.env.GEOBLOCK_RESTRICTED_COUNTRIES,
): readonly string[] {
  const normalizedRaw = raw ?? '';
  if (cachedRaw === normalizedRaw) {
    return cachedList;
  }
  cachedRaw = normalizedRaw;
  cachedList = parseRestrictedCountries(raw);
  return cachedList;
}

export function isCountryRestricted(
  country: string | null | undefined,
  raw: string | undefined = process.env.GEOBLOCK_RESTRICTED_COUNTRIES,
): boolean {
  if (!country) return false;
  const code = country.trim().toUpperCase();
  if (!code) return false;
  return resolveRestrictedCountries(raw).includes(code);
}
