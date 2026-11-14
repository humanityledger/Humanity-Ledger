/**
 * lib/aztec/token-issuer.ts — who may issue a token on Aztec Alpha, from deployments/aztec-mainnet.json.
 *
 * HLC is issued by Humanity Ledger: the token's admin (recorded with its deployment) may mint. The
 * wallet offers "Issue" only when the open account IS that admin, and the contract checks it again,
 * so this is a convenience, never the authority. A mint is capped per transaction (ISSUE_MAX) so a
 * mistyped amount cannot create a large supply in one step.
 */
import mainnetRecord from '../../deployments/aztec-mainnet.json';

const HEX32 = /^0x[0-9a-f]{64}$/;

/** Most that one issue may create, in whole tokens. */
export const ISSUE_MAX_WHOLE = 1000n;

/** The admin (lowercase) recorded for a token address on Alpha, or null. */
export function recordedAdmin(tokenAddress: string, record: { tokens?: Array<{ address?: string; admin?: string; status?: string }> } = mainnetRecord as any): string | null {
  const a = tokenAddress.trim().toLowerCase();
  const t = (record.tokens ?? []).find((x) => (x.address ?? '').toLowerCase() === a && x.status !== 'do-not-use');
  const admin = (t?.admin ?? '').toLowerCase();
  return HEX32.test(admin) ? admin : null;
}

/** Base units cap for one issue. */
export function issueCap(decimals: number): bigint {
  return ISSUE_MAX_WHOLE * 10n ** BigInt(decimals);
}
