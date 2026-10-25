/**
 * lib/security/requireSecret.ts
 *
 * Read a secret from the environment or fail.
 *
 * The codebase had `process.env.X || 'some-default'` for admin keys, MFA
 * codes, cron tokens and encryption keys. A default written in the source is
 * public the moment the source is: any deployment that forgot one variable
 * accepted the published value. A missing secret now stops the request
 * instead of silently opening it.
 */
export function requireSecret(name: string): string {
  const v = process.env[name];
  if (!v || v.length < 8) {
    throw new Error(`${name} is not set (or shorter than 8 characters). Set it in the environment.`);
  }
  return v;
}

/** Constant-time string comparison for shared-secret headers. */
export function secretEquals(given: string | null | undefined, expected: string): boolean {
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('crypto').timingSafeEqual(a, b);
}
