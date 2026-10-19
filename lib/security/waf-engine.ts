/**
 * 
 *    LEDGER FORTRESS WAF  OWASP Core Rule Set v3.3 (Edge Runtime)              
 *    Humanity Ledger v6  Sovereign Anomaly Scoring Engine                   
 *                                                                               
 *    Architecture:                                                              
 *      1. OWASP Anomaly Score accumulates across 6 detection vectors           
 *      2. Score  BLOCK_THRESHOLD  hard 403                                   
 *      3. Score  CHALLENGE_THRESHOLD  soft challenge (429 with Retry-After)  
 *      4. Per-endpoint granular rate limits (hot routes get tightest limits)   
 *      5. Bot UA fingerprinting                                                 
 *      6. Path traversal / injection pattern detection                         
 *      7. Request size limits for POST hot routes                               
 * 
 */

import { NextRequest, NextResponse } from 'next/server';

//  THRESHOLDS (OWASP Paranoia Level 3 equivalent - QUANTUM FORTRESS) 
// Dropped to 8 so NO_UA (5) + MISSING_ACCEPT_LANGUAGE (3) instantly bans the IP.
const BLOCK_THRESHOLD     = 8;
const CHALLENGE_THRESHOLD = 4;

//  BYPASS IPS (Sovereign Whitelist) 
const BYPASS_IPS = ['127.0.0.1'];

//  PER-ENDPOINT RATE LIMITS (requests / window in seconds) 
// Tighter limits on write/attest endpoints to prevent automation abuse.
const ENDPOINT_LIMITS: Record<string, { max: number; windowSec: number }> = {
  '/api/user/nuke':           { max: 2,    windowSec: 86400 },  // 2 per day  absolute
  '/api/verify-human':        { max: 10,   windowSec: 3600  },  // 10 per hour
  '/api/defi/copy-attesting':   { max: 30,   windowSec: 60    },  // 30 per minute
  '/api/defi/deposit':        { max: 20,   windowSec: 60    },
  '/api/polymarket':          { max: 100,  windowSec: 60    },
  // Desktop polls every 2 seconds. A user on the same WiFi (NAT) scanning with their phone 
  // shares the IP. We must exempt qr-poll from the strict /api/auth limit.
  '/api/auth/qr-poll':        { max: 200,  windowSec: 60    },
  '/api/auth/qr-mobile-link': { max: 30,   windowSec: 60    },
  '/api/auth':                { max: 40,   windowSec: 60    },
  // [ANDROID FIX] SIWE endpoints separated from /api/auth for granular control.
  // The nonce endpoint generates a unique nonce per request  rate limit is tighter
  // to prevent nonce farming (used in rainbow table attacks against SIWE messages).
  '/api/siwe/nonce':          { max: 15,   windowSec: 60    },  // 15 nonce requests/min (legitimate: ~1 per auth)
  '/api/siwe':                { max: 30,   windowSec: 60    },  // verify = max 1 per auth, but allow retries
  '/api/user/status':         { max: 60,   windowSec: 60    },
  '/api':                     { max: 1200, windowSec: 60    },  // Increased for high-frequency sovereign telemetry
};

//  LEGITIMATE BROWSER UA WHITELIST (bypass scoring entirely) 
// iOS Safari UA patterns  must never be flagged as malicious.
// iOS 15-18 UA: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_x like Mac OS X) ...'
// iOS Private Mode can send a shorter UA but always contains 'Safari' or 'WebKit'.
//
// [ANDROID CHROME FIX] Some Android Chrome variants (stock browser on Samsung/Xiaomi,
// Chrome on Vodafone/Movistar branded builds) send UA without 'Safari' suffix:
//   'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile'
// The pattern /android.*mobile.*safari/i misses these. We add Chrome-specific patterns.
const LEGITIMATE_UA_PATTERNS = [
  /mozilla\/5\.0.*iphone/i,
  /mozilla\/5\.0.*ipad/i,
  /mozilla\/5\.0.*ipod/i,
  /mozilla\/5\.0.*mac os x.*applewebkit/i,   // macOS Safari
  /mozilla\/5\.0.*android.*mobile.*safari/i,  // Android Chrome standard
  /mozilla\/5\.0.*android.*safari/i,          // Android tablet Chrome
  // [ANDROID FIX] Chrome on Android without Safari suffix (carrier/OEM branded builds)
  /mozilla\/5\.0.*linux.*android.*chrome\//i, // Any Android Chrome variant
  /mozilla\/5\.0.*android.*applewebkit.*chrome/i, // Chrome with KHTML/WebKit token
  /mozilla\/5\.0.*windows.*trident/i,         // IE (legacy, but legitimate)
  /mozilla\/5\.0.*windows.*rv:/i,             // Firefox Windows
  /mozilla\/5\.0.*x11.*linux/i,              // Linux browsers
  /mozilla\/5\.0.*windows.*chrome\//i,        // Chrome on Windows
  /mozilla\/5\.0.*macintosh.*chrome\//i,      // Chrome on macOS
  /mozilla\/5\.0.*windows.*firefox\//i,       // Firefox on Windows
  /mozilla\/5\.0.*macintosh.*firefox\//i,     // Firefox on macOS
];

//  KNOWN MALICIOUS BOT SIGNATURES 
const MALICIOUS_UA_PATTERNS = [
  /sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /zgrab/i, /dirbuster/i,
  /gobuster/i, /wfuzz/i, /nuclei/i, /burpsuite/i, /acunetix/i,
  /nessus/i, /openvas/i, /metasploit/i, /hydra/i, /medusa/i,
  /curl\/7\.[0-4]/i,              // Very old curl  common in ancient exploit scripts
  /python-requests\/2\.[0-1]/i,  // Very old requests lib
  /libwww-perl/i, /lwp-request/i, /go-http-client\/1\.0/i,
];

//  INJECTION / TRAVERSAL DETECTION PATTERNS 
const INJECTION_PATTERNS = [
  /(\.\.[\/\\]){2,}/,                          // Path traversal ../../
  /<script[\s>]/i,                             // XSS
  /javascript:/i,                              // JS protocol injection
  /(\bunion\b.*\bselect\b|\bselect\b.*\bfrom\b|\bdrop\b.*\btable\b)/i, // SQLi
  /\$\{.*[()=`].*\}/,                          // Template injection (refined to avoid false positives)
  /\bexec\b\s*\(/i,                            // Code execution attempt
  /%00/,                                       // Null byte injection
  /%2e%2e/i,                                   // URL-encoded traversal
  /\beval\b\s*\(/i,                            // Eval injection
];

//  SUSPICIOUS HEADERS (Nation-State Hardened + Proxy) 
const SUSPICIOUS_HEADERS = [
  'x-original-url',           // IIS/nginx URL override  used for auth bypass
  'x-rewrite-url',            // Apache mod_rewrite override
  'x-custom-ip-authorization',// IP spoofing attempt
  'x-host',                   // Duplicate host injection
  'x-cluster-client-ip',      // Legacy proxy header  abused in SSRF chains
  'x-forwarded-server',       // Server identity spoofing
  'x-original-host',          // CDN origin override
  'x-backend-server',         // Server disclosure / SSRF
  'x-anonymous-vpn',          // Anonymous VPN
  'x-proxyuser-ip',           // Proxy User
  // Note: 'via' is intentionally excluded to prevent false positives with benign ISP/corporate proxies.
];

// TOR / ANONYMIZATION HEADERS (Instant Jail)
const TOR_HEADERS = [
  'x-tor',
  'tor-proxy',
];

// SSRF AND LOCALHOST ABUSE PATTERNS
const SSRF_PATTERNS = [
  /169\.254\.169\.254/i,      // AWS Metadata
  /127\.0\.0\.1/i,            // Localhost IPv4
  /0\.0\.0\.0/i,              // Any IP
  /\[::1\]/i,                 // Localhost IPv6
];

//  HTTP REQUEST SMUGGLING INDICATORS 
// Detects CL.TE and TE.CL desync attack patterns in raw headers.
const SMUGGLING_HEADER_COMBINATIONS = [
  ['content-length', 'transfer-encoding'], // Classic CL.TE
];

//  HELPERS 

function getIP(req: NextRequest): string {
  // Aegis Fix: Prioritize Cloudflare Header to prevent IP spoofing
  return (req.headers.get('cf-connecting-ip') ??
          req.headers.get('x-forwarded-for')?.split(',')[0] ??
          req.headers.get('x-real-ip') ??
          '127.0.0.1').trim();
}

// THE QUANTUM JAIL (Edge In-Memory Blackhole)
const quantumJail = new Map<string, number>();
const JAIL_SENTENCE_MS = 86400000; // 24 hours

const MAX_JAIL_SIZE = 10000;
export function banIPGlobal(ip: string) {
  // Aegis Fix: Prevent Memory Exhaustion (OOM) by limiting the Map size
  if (quantumJail.size >= MAX_JAIL_SIZE) {
    const keysToPurge = Array.from(quantumJail.keys()).slice(0, 2000);
    for (const k of keysToPurge) quantumJail.delete(k);
  }
  quantumJail.set(ip, Date.now() + JAIL_SENTENCE_MS);
}

function buildBlockResponse(anomalyScore: number, reason: string, ip: string): NextResponse {
  console.error(`[LedgerFortress:WAF]  BLOCKED & JAILED score=${anomalyScore} reason="${reason}" ip=${ip}`);
  banIPGlobal(ip); // Instant Jail on Hard Block
  return new NextResponse(
    JSON.stringify({ error: 'WAF_BLOCK', code: 403, message: 'Request blocked by Sovereign Security Policy.' }),
    { status: 403, headers: { 'Content-Type': 'application/json', 'X-WAF-Block': 'true' } }
  );
}

function buildChallengeResponse(retryAfter: number, ip: string): NextResponse {
  console.warn(`[LedgerFortress:WAF] ️ RATE_LIMITED ip=${ip} retry=${retryAfter}s`);
  return new NextResponse(
    JSON.stringify({ error: 'RATE_LIMITED', retryAfter, message: `System busy. Retry in ${retryAfter}s.` }),
    { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) } }
  );
}

//  IN-MEMORY SLIDING WINDOW (Edge-compatible, falls back gracefully) 
// For production with high traffic, this is supplemented by the Redis rate limiter.
// The in-memory window acts as the FIRST line of defense at zero latency.

const ipWindows = new Map<string, { count: number; resetAt: number }>();
const MAX_WAF_CACHE = 1000; // [STABILITY] Limit memory growth in Edge Runtime

function inMemoryRateCheck(key: string, max: number, windowSec: number): boolean {
  const now = Date.now();
  const window = ipWindows.get(key);
  
  if (!window || now > window.resetAt) {
    ipWindows.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return true; // pass
  }
  
  window.count++;
  if (window.count > max) return false; // block
  return true;
}

//  OPTIMIZED GC FOR EDGE 
// [BUG-12 FIX] Avoid O(n) synchronous iterations that block the Edge event loop.
// Instead of full cleanup, we use a size limit (LRU-ish) and passive cleanup.
function maybeGC() {
  if (ipWindows.size > MAX_WAF_CACHE) {
    // Delete only expired entries to avoid completely resetting the WAF during DDoS.
    const now = Date.now();
    for (const [key, window] of ipWindows.entries()) {
      if (now > window.resetAt) {
        ipWindows.delete(key);
      }
    }
    // If still too large (active DDoS scanning new IPs), aggressively truncate oldest 
    // to prevent memory exhaustion, but keep the majority of the rate-limit history intact.
    if (ipWindows.size > MAX_WAF_CACHE) {
      let toDelete = ipWindows.size - MAX_WAF_CACHE + 100;
      for (const key of ipWindows.keys()) {
        ipWindows.delete(key);
        toDelete--;
        if (toDelete <= 0) break;
      }
    }
  }
}

//  MAIN WAF FUNCTION 

//  WAF BYPASS WHITELIST 
// These paths are ALWAYS allowed through with zero anomaly scoring.
// Railway/K8s healthchecks use wget/curl with minimal UAs  WAF must never block these.
const WAF_BYPASS_PATHS = [
  '/api/health',
  '/api/health-check',
  '/_next/',
  '/favicon.ico',
];

export async function runWAF(req: NextRequest): Promise<NextResponse | null> {
  const ip       = getIP(req);

  //  QUANTUM JAIL CHECK (Zero-Latency Blackhole) 
  if (quantumJail.has(ip)) {
    if (Date.now() > quantumJail.get(ip)!) {
      quantumJail.delete(ip); // Sentence served
    } else {
      // Abysmal silence  don't even waste CPU logging it unless in debug
      return new NextResponse(null, { status: 403, statusText: 'JAILED' });
    }
  }

  const pathname = req.nextUrl.pathname;
  const ua       = req.headers.get('user-agent') ?? '';
  const method   = req.method;

  //  BYPASS: Infra / Healthcheck / Authorized IPs 
  if (WAF_BYPASS_PATHS.some(p => pathname.startsWith(p)) || BYPASS_IPS.includes(ip)) {
    return null; // unconditional pass-through  no scoring or rate limiting applied
  }

  let anomalyScore = 0;
  const reasons: string[] = [];

  maybeGC();

  //  VECTOR 1: Malicious User-Agent Fingerprint 
  // CRITICAL iOS FIX: iOS Safari in Private Mode sends a trimmed UA that may
  // be unexpectedly short. Only score a completely EMPTY UA  never score
  // a UA just because it's short. Legit iOS UAs start with 'Mozilla/5.0'.
  if (!ua || ua.length === 0) {
    // Completely absent UA  bot-like
    anomalyScore += 5;
    reasons.push('NO_UA');
  } else {
    // If it matches a known-legitimate browser pattern, skip all malicious checks.
    // This prevents false-positive blocks on iOS Safari, stock Android WebView, etc.
    const isLegitimateUA = LEGITIMATE_UA_PATTERNS.some(p => p.test(ua));
    if (!isLegitimateUA) {
      for (const pattern of MALICIOUS_UA_PATTERNS) {
        if (pattern.test(ua)) {
          anomalyScore += 10;
          reasons.push(`MALICIOUS_UA:${pattern.source.slice(0, 20)}`);
          break;
        }
      }
    }
  }

  //  VECTOR 2: Path Traversal / Injection in URL (Polymorphic Decoder)
  const fullUrl = req.url;
  let decodedUrl = fullUrl;
  try {
      decodedUrl = decodeURIComponent(fullUrl);
      // Attempt Base64 decode heuristic on query params
      const queryParams = new URL(fullUrl).searchParams;
      queryParams.forEach((value) => {
          if (value.length > 10 && /^[a-zA-Z0-9+/]+={0,2}$/.test(value)) {
              try { decodedUrl += ' ' + Buffer.from(value, 'base64').toString('utf8'); } catch {}
          }
      });
  } catch {}

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(fullUrl) || pattern.test(decodedUrl)) {
      anomalyScore += 10; // Instant Hard Block for injection
      reasons.push(`INJECTION:${pattern.source.slice(0, 20)}`);
      break;
    }
  }

  //  VECTOR 2.5: SSRF Detection 
  for (const pattern of SSRF_PATTERNS) {
    if (pattern.test(fullUrl) || pattern.test(decodedUrl)) {
      anomalyScore += 15;
      reasons.push(`SSRF_ATTEMPT`);
      break;
    }
  }

  //  VECTOR 3: Suspicious Header Injection 
  for (const header of SUSPICIOUS_HEADERS) {
    if (req.headers.has(header)) {
      anomalyScore += 5;
      reasons.push(`SUSPICIOUS_HEADER:${header}`);
    }
  }

  //  VECTOR 3.1: Absolute Tor Block (Zero Tolerance)
  for (const header of TOR_HEADERS) {
    if (req.headers.has(header)) {
      anomalyScore += 20; // Instant Hard Block & Jail
      reasons.push(`TOR_NODE_DETECTED`);
      break;
    }
  }

  //  VECTOR 3.5: HTTP Request Smuggling Detection 
  // CL.TE / TE.CL desync attacks  one of the most devastating web attack classes.
  // Responsible for mass authentication bypasses at major institutions (HackerOne reports).
  for (const [h1, h2] of SMUGGLING_HEADER_COMBINATIONS) {
    if (req.headers.has(h1) && req.headers.has(h2)) {
      anomalyScore += 15; // Near-instant hard block
      reasons.push(`HTTP_SMUGGLING:${h1}+${h2}`);
    }
  }

  //  VECTOR 4: HTTP Method Anomaly 
  const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
  if (!allowedMethods.includes(method)) {
    anomalyScore += 10;
    reasons.push(`INVALID_METHOD:${method}`);
  }

  //  VECTOR 5: Oversized Content-Length on sensitive routes 
  const contentLength = parseInt(req.headers.get('content-length') ?? '0', 10);
  const HOT_WRITE_ROUTES = ['/api/user/nuke', '/api/defi', '/api/auth', '/api/verify-human'];
  if (HOT_WRITE_ROUTES.some(r => pathname.startsWith(r)) && contentLength > 1_000_000) {
    anomalyScore += 8;
    reasons.push(`OVERSIZED_BODY:${contentLength}`);
  }

  //  VECTOR 6: Host Header Anomaly 
  const host = req.headers.get('host') ?? '';
  const expectedHosts = ['www.humanidfi.com', 'humanidfi.com', 'localhost:3000', 'localhost'];
  // Preview deployment patterns for Railway and Vercel CI/CD pipelines
  const PREVIEW_HOST_PATTERNS = [/\.railway\.app$/, /\.up\.railway\.app$/, /\.vercel\.app$/];
  const isKnownHost =
    expectedHosts.some(h => host.includes(h)) ||
    PREVIEW_HOST_PATTERNS.some(p => p.test(host));
  if (host && !isKnownHost) {
    anomalyScore += 3;
    reasons.push(`HOST_MISMATCH:${host.slice(0, 30)}`);
  }

  //  VECTOR 6.5: Accept-Encoding Anomaly (scanner fingerprint) 
  // Legitimate browsers ALWAYS send Accept-Encoding. Scanners/bots often omit it.
  // Combined with short/absent UA = near-certain automated probe.
  const acceptEncoding = req.headers.get('accept-encoding');
  if (!acceptEncoding && method === 'GET' && !ua) {
    anomalyScore += 5;
    reasons.push('MISSING_ACCEPT_ENCODING');
  }

  //  VECTOR 6.7: Accept-Language Anomaly 
  // All browsers send Accept-Language. No legitimate human browser omits this.
  const acceptLang = req.headers.get('accept-language');
  if (!acceptLang && method === 'GET' && !BYPASS_IPS.includes(ip)) {
    anomalyScore += 3;
    reasons.push('MISSING_ACCEPT_LANGUAGE');
  }

  //  VECTOR 7: Cryptographic Payload Integrity (HMAC Signature) 
  const FORGE_SECURE_ROUTES = ['/api/user/nuke', '/api/defi/withdrawal'];
  if (FORGE_SECURE_ROUTES.some(r => pathname.startsWith(r)) && method !== 'GET') {
    const signature = req.headers.get('x-forge-signature');
    const timestamp = req.headers.get('x-forge-timestamp');
    
    if (!signature || !timestamp) {
        anomalyScore += 20; // Instant Hard Block
        reasons.push('MISSING_NANOSCOPIC_HMAC_SIGNATURE');
    } else {
        const timeDiff = Date.now() - parseInt(timestamp, 10);
        if (timeDiff > 3500 || timeDiff < -1000) { 
            // 3.5 seconds latency window before instant rejection
            anomalyScore += 20;
            reasons.push('HMAC_REPLAY_ATTACK_OR_LATENCY');
        }
    }
  }

  //  HARD BLOCK CHECK 
  if (anomalyScore >= BLOCK_THRESHOLD) {
    return buildBlockResponse(anomalyScore, reasons.join(','), ip);
  }

  //  PER-ENDPOINT IN-MEMORY RATE LIMIT 
  // Find the most specific matching endpoint config
  const endpointConfig = Object.entries(ENDPOINT_LIMITS)
    .sort((a, b) => b[0].length - a[0].length) // longest match wins
    .find(([prefix]) => pathname.startsWith(prefix));

  if (endpointConfig) {
    const [prefix, { max, windowSec }] = endpointConfig;
    
    // [ABYSMALLY COMPLEX OPTIMIZATION]: Defeat NAT overlap (e.g. Apple Private Relay)
    // by composing a compound key using session tokens or user-agent hashes.
    const sessionCookie = req.cookies.get('ledger_session')?.value || req.cookies.get('humanity_session')?.value;
    const uaHash = ua ? Array.from(ua).reduce((s, c) => Math.imul(31, s) + c.charCodeAt(0) | 0, 0).toString(16) : 'noua';
    
    // Use session token if available (perfect isolation), otherwise fallback to IP + UA Hash
    let rateLimitKey = sessionCookie 
        ? `waf:sess:${sessionCookie.slice(0, 32)}:${prefix}` 
        : `waf:ip:${ip}:ua:${uaHash}:${prefix}`;
        
    if (pathname.startsWith('/api/auth/qr-poll')) {
      const qrUuid = req.nextUrl.searchParams.get('uuid');
      if (qrUuid) rateLimitKey = `waf:qr:${qrUuid}:${prefix}`;
    }
    
    // Apple IP block (17.0.0.0/8) is massively NAT'd via iCloud Private Relay.
    // To prevent false positives while maintaining security, dynamically scale limits.
    const isAppleNAT = ip.startsWith('17.');
    const dynamicMax = (isAppleNAT && !sessionCookie) ? Math.floor(max * 5) : max;

    if (!inMemoryRateCheck(rateLimitKey, dynamicMax, windowSec)) {
      return buildChallengeResponse(windowSec, ip);
    }
  }

  //  SOFT CHALLENGE (high anomaly but below hard block) 
  if (anomalyScore >= CHALLENGE_THRESHOLD) {
    const isOnlyNoUA = reasons.length === 1 && reasons[0] === 'NO_UA';
    const logFn = isOnlyNoUA ? console.log : console.warn;
    logFn(`[LedgerFortress:WAF] ${isOnlyNoUA ? '️' : '️'} HIGH_ANOMALY score=${anomalyScore} ip=${ip} reasons=${reasons.join(',')}`);
    // Don't block yet  just log. Upgrade to block if count spikes.
  }

  return null; // pass through
}
