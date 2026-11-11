/**
 * Whether Ledger Chat shows the six digit PIN screen before the chat (and asks for a PIN while
 * creating an account).
 *
 * Off by default since 2026-11-11: the PIN blocked people who had forgotten it or could not set it
 * on a phone, and it is only a lock in front of the screen. It does not encrypt messages or guard
 * any key (docs/pin), and no server route checks it. Signing in with the wallet (SIWE) is still
 * required: the gate still asks the server for the session and sends you to /connect without one.
 *
 * To bring the screen back, build with NEXT_PUBLIC_ENCLAVE_PIN_LOCK=on. Only the exact value "on"
 * enables it. The optional app lock in Settings (biometric_lock) is a separate setting and unchanged.
 */
export function pinLockEnabled(): boolean {
  // Written out in full so that Next.js can inline the value at build time.
  return process.env.NEXT_PUBLIC_ENCLAVE_PIN_LOCK === 'on';
}
