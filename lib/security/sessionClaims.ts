/**
 * lib/security/sessionClaims.ts — which signed tokens count as a sign-in.
 *
 * Several routes sign tokens with the same key as the session (lib/jwt.ts,
 * lib/session.ts). A token that verifies is therefore not automatically a
 * session: it has to be one of the kinds a sign-in produces.
 *
 * Rejected here:
 *  - refresh tokens (type 'refresh'): 30-day tokens meant only for
 *    /api/auth/refresh, never for reaching data;
 *  - tokens from the retired /api/premium/webauthn route (authMethod
 *    'webauthn'). That route signed { sub: <any cookie value> } for any
 *    signed-in caller, so it handed out a session for any wallet. Tokens it
 *    issued stay valid until they expire unless they are refused by name;
 *  - wallet tokens whose address is not an EVM address.
 *
 * Pure function: used by the edge middleware and by the Node session code.
 */

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function isSessionPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  if (p.type === 'refresh') return false;
  if (p.authMethod === 'webauthn') return false;
  const wallet = p.walletAddress ?? p.address;
  if (wallet !== undefined && (typeof wallet !== 'string' || !EVM_ADDRESS.test(wallet))) return false;
  // A token that names its subject only through `sub` must name a wallet.
  if (wallet === undefined && p.userId === undefined) {
    if (typeof p.sub !== 'string' || !EVM_ADDRESS.test(p.sub)) return false;
  }
  return true;
}
