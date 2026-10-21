/**
 * lib/env.ts — B-037: Server-side environment variable validation
 *
 * Validates that all required secrets are present at REQUEST TIME (not module load).
 * This is intentional: Next.js eagerly imports all server modules during build,
 * but secrets are only available when the container RUNS.
 *
 * Usage:
 *   import { requireEnv } from '@/lib/env';
 *   const secret = requireEnv('JWT_SECRET');
 *
 * SECURITY RULES:
 *   - No default values in code
 *   - No derivation of one secret from another
 *   - Each secret has a single purpose
 */

/**
 * Retrieves a required environment variable.
 * Throws a clear error at RUNTIME (request time) if the variable is absent.
 * Never returns a default — that would defeat the purpose.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `[SECURITY CRITICAL] Environment variable "${name}" is not set or is empty. ` +
      `This server cannot operate safely without it. ` +
      `Set "${name}" in your Railway / .env environment immediately.`
    );
  }
  return value;
}

/**
 * Retrieves an optional environment variable with a documented fallback.
 * Only use for non-security-sensitive settings (feature flags, URLs, etc.).
 */
export function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

/**
 * Required secrets — each has a SINGLE purpose.
 * B-038: Never derive one secret from another.
 *
 * Access pattern (lazy, at request time):
 *   secrets.jwtSecret()          → JWT signing for session tokens
 *   secrets.enclavePinPepper()   → Argon2id pepper for enclave PIN hashing
 *   secrets.enclavePinSecret()   → HMAC secret for clearance tokens
 */
export const secrets = {
  /** JWT_SECRET: Signs all session JWTs (SIWE + email). Purpose: auth session tokens. */
  jwtSecret: () => requireEnv('JWT_SECRET'),

  /** ENCLAVE_PIN_PEPPER: Argon2id pepper applied BEFORE hashing the PIN. Purpose: PIN hashing only. */
  enclavePinPepper: () => requireEnv('ENCLAVE_PIN_PEPPER'),

  /** ENCLAVE_PIN_SECRET: HMAC key for clearance tokens. Purpose: PIN clearance tokens only. */
  enclavePinSecret: () => requireEnv('ENCLAVE_PIN_SECRET'),

  /** DATABASE_URL: PostgreSQL connection string. Purpose: database access only. */
  databaseUrl: () => requireEnv('DATABASE_URL'),
} as const;

/**
 * Validates that all critical secrets are present.
 * Call this from an /api/health check to verify configuration on startup.
 */
export function validateCriticalSecrets(): { ok: boolean; missing: string[] } {
  const required = ['JWT_SECRET', 'ENCLAVE_PIN_PEPPER', 'ENCLAVE_PIN_SECRET', 'DATABASE_URL'];
  const missing = required.filter(name => !process.env[name] || process.env[name]!.trim() === '');
  return { ok: missing.length === 0, missing };
}
