import crypto from 'node:crypto';

/**
 * lib/security/canary.ts
 *
 * Implements Canary monitoring tokens, honey-keys, and log scrubbing
 * to detect intrusions and prevent leakage of private keys or PII
 * (Fortification Items 5, 11, 233, 237, 248).
 */

// Canonical Canary Key — this key must NEVER be used for legitimate state transitions
// If this canary key or its derived address ever appears in telemetry, egress, or logs,
// an immediate intrusion alert is triggered (Nation-state / Lazarus honeypot trap).
export const CANARY_PRIVATE_KEY_HEX = '0x0000deadbeefc001cafe00000000000000000000000000000000000000000001';
export const CANARY_IDENTIFIER = 'hl_canary_trap_lazarus_defense_v1';

/**
 * Checks whether an arbitrary string, log entry, or network payload
 * contains the canary token or private key signatures.
 */
export function detectCanaryBreach(content: string): { breached: boolean; reason?: string } {
  if (content.includes(CANARY_PRIVATE_KEY_HEX)) {
    return { breached: true, reason: 'Canary private key detected in payload or logs!' };
  }
  if (content.includes(CANARY_IDENTIFIER)) {
    return { breached: true, reason: 'Canary honey-token accessed or transmitted!' };
  }
  return { breached: false };
}

/**
 * Scrubs logs, error traces, and telemetry strings to strip:
 * - 32-byte hex private keys (0x[0-9a-fA-F]{64})
 * - BIP-39 mnemonic seeds (12 or 24 word patterns)
 * - Bearer tokens and session secrets
 */
export function scrubSensitiveData(logMessage: string): string {
  if (!logMessage || typeof logMessage !== 'string') return '';

  let scrubbed = logMessage;

  // 1. Scrub 64-char hex strings (typically private keys, spending secrets)
  scrubbed = scrubbed.replace(/(0x)?[0-9a-fA-F]{64}/g, '[REDACTED_SECRET_KEY]');

  // 2. Scrub canary tokens
  scrubbed = scrubbed.replace(new RegExp(CANARY_IDENTIFIER, 'g'), '[REDACTED_CANARY]');

  // 3. Scrub common authorization headers
  scrubbed = scrubbed.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, 'Bearer [REDACTED_TOKEN]');

  // 4. Scrub mnemonic seed phrases (sequences of 12+ lower-case dictionary words)
  scrubbed = scrubbed.replace(/\b([a-z]{3,12}\s+){11,23}[a-z]{3,12}\b/g, '[REDACTED_MNEMONIC]');

  return scrubbed;
}
