/**
 * lib/security/ssrfGuard.ts — B-031: SSRF Protection
 *
 * Validates user-provided URLs before making server-side fetch requests.
 * Prevents attackers from using the server to probe internal networks,
 * cloud metadata endpoints, or localhost services.
 *
 * Blocked targets:
 *   - Private IP ranges (RFC 1918, RFC 6598, loopback, link-local)
 *   - IPv6 loopback and private ranges
 *   - Cloud metadata endpoints (169.254.169.254, fd00:ec2::254, etc.)
 *   - Non-HTTP/HTTPS schemes (file://, ftp://, etc.)
 *
 * Usage:
 *   const result = validateUrlForFetch(userSuppliedUrl);
 *   if (!result.safe) return NextResponse.json({ error: result.reason }, { status: 400 });
 *   const response = await fetch(userSuppliedUrl);
 */

interface SsrfGuardResult {
  safe: boolean;
  reason?: string;
}

/** Private/reserved IP CIDR ranges that must never be fetched server-side */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '0.0.0.0',
  '::1',
  '0:0:0:0:0:0:0:1',
]);

/** Cloud metadata endpoints — must be blocked regardless of IP resolution */
const BLOCKED_METADATA_HOSTS = [
  '169.254.169.254',       // AWS/GCP/Azure IMDS
  '100.100.100.200',       // Alibaba Cloud metadata
  'metadata.google.internal',
  'metadata.goog',
  'fd00:ec2::254',         // AWS IPv6 metadata
  '169.254.170.2',         // ECS task metadata
];

/** Checks if an IPv4 address is in a private/reserved range */
function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return false; // Not a valid IPv4
  }
  const [a, b] = parts;
  return (
    a === 10 ||                         // 10.0.0.0/8
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) ||          // 192.168.0.0/16
    a === 127 ||                         // 127.0.0.0/8 (loopback)
    (a === 169 && b === 254) ||          // 169.254.0.0/16 (link-local / metadata)
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 (shared address)
    a === 0                              // 0.0.0.0/8
  );
}

/** Checks if a hostname looks like an IPv6 private/loopback address */
function isPrivateIpv6(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||  // fc00::/7 (unique local)
    normalized.startsWith('fd') ||  // fd00::/8 (unique local)
    normalized.startsWith('fe80') || // fe80::/10 (link-local)
    normalized.startsWith('::ffff:') // IPv4-mapped
  );
}

/**
 * Validates a URL is safe to fetch from the server.
 * Call this before any server-side fetch of user-supplied URLs.
 */
export function validateUrlForFetch(url: string): SsrfGuardResult {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }

  // Only allow HTTP and HTTPS
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return {
      safe: false,
      reason: `Disallowed URL scheme: ${parsed.protocol}. Only http:// and https:// are permitted.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block known metadata endpoints
  if (BLOCKED_METADATA_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`))) {
    return { safe: false, reason: 'Cloud metadata endpoints are blocked (SSRF protection)' };
  }

  // Block known private/localhost hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { safe: false, reason: 'Localhost and reserved hostnames are blocked (SSRF protection)' };
  }

  // Block IPv4 private ranges
  if (isPrivateIpv4(hostname)) {
    return { safe: false, reason: 'Private IP ranges are blocked (SSRF protection)' };
  }

  // Block IPv6 private/loopback
  if (isPrivateIpv6(hostname)) {
    return { safe: false, reason: 'Private IPv6 ranges are blocked (SSRF protection)' };
  }

  // Block internal .local and .internal domains
  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname === 'internal') {
    return { safe: false, reason: 'Internal DNS names are blocked (SSRF protection)' };
  }

  return { safe: true };
}

/**
 * Wraps fetch with SSRF protection.
 * Throws if the URL is unsafe. Use instead of bare fetch for user-provided URLs.
 */
export async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
  const guard = validateUrlForFetch(url);
  if (!guard.safe) {
    throw new Error(`[SSRF] Blocked fetch to unsafe URL: ${guard.reason}`);
  }
  return fetch(url, options);
}
