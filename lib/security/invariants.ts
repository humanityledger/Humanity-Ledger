/**
 * Security Invariants — PROTOCOL_SPEC §V
 * Runtime enforcement of security guarantees.
 */

// Invariant 1: Never reuse a nonce
const usedNonces = new Map<string, number>(); // nonce → timestamp
const NONCE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export function checkNonce(nonce: string): boolean {
  const now = Date.now();
  // Clean expired nonces
  for (const [n, ts] of usedNonces.entries()) {
    if (now - ts > NONCE_WINDOW_MS) usedNonces.delete(n);
  }
  if (usedNonces.has(nonce)) return false; // Nonce replay detected!
  usedNonces.set(nonce, now);
  return true;
}

// Invariant 2: Never log private keys or seeds
const SENSITIVE_PATTERNS = [
  /private.?key/i,
  /seed.?phrase/i,
  /mnemonic/i,
  /0x[a-fA-F0-9]{64}/, // 32-byte hex private key
];

export function sanitizeForLogging(data: any): any {
  if (typeof data === 'string') {
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(data)) return '[REDACTED_SENSITIVE]';
    }
    return data;
  }
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [k, v] of Object.entries(data)) {
      if (SENSITIVE_PATTERNS.some(p => p.test(k))) {
        sanitized[k] = '[REDACTED]';
      } else {
        sanitized[k] = sanitizeForLogging(v);
      }
    }
    return sanitized;
  }
  return data;
}

// Invariant 3: Check request for private key leakage
export function scanRequestForLeaks(body: string): string | null {
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(body)) {
      return `Potential private key in request body — pattern: ${pattern.source}`;
    }
  }
  return null;
}

// Security headers
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=self, microphone=self',
  'X-ZK-Status': process.env.ZK_PROVING_ENABLED === 'true' ? 'active' : 'mock',
  'X-Protocol-Version': '5.0.0',
};
