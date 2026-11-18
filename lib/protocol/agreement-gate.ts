/**
 * lib/protocol/agreement-gate.ts
 *
 * Why an escrow or a payment stream may not be deployed right now, or null.
 * Shared by assertCanOpen (lib/aztec/agreements.ts), the agreement composer
 * and the deploy scripts, so the reason shown before any transaction is the
 * one the code enforces.
 *
 * Order matters for the message a person sees:
 *  1. On Aztec Alpha, no external audit: refused (deployments/aztec-mainnet.json
 *     "audit" is null; launch condition 1 is unmet).
 *  2. The contract source is ahead of its committed artifact
 *     (deployments/aztec-pending-recompile.json): the artifact the app would
 *     deploy still carries the zero treasury placeholder.
 *  3. No treasury designated.
 */

export type AgreementKind = 'escrow' | 'streams';
export type AgreementNetwork = 'testnet' | 'mainnet';

export const CONTRACT_NAME: Readonly<Record<AgreementKind, string>> = Object.freeze({
  escrow: 'PrivateEscrow',
  streams: 'PaymentStream',
});

export const AUDIT_REFUSED =
  'Escrows and streams cannot be opened on Aztec Alpha. The contracts have no external audit, so nothing is deployed there.';
export const RECOMPILE_REFUSED =
  'This agreement contract is being recompiled with the treasury address. Opening one is paused until the new contract is tested and recorded.';
export const TREASURY_REFUSED = 'No treasury address is set. This agreement cannot be deployed.';

export interface GateInput {
  kind: AgreementKind;
  network: AgreementNetwork;
  /** deployments/aztec-mainnet.json → audit. Anything but a non-empty object counts as no audit. */
  audit: unknown;
  /** deployments/aztec-pending-recompile.json → pending[].contract */
  pendingContracts: ReadonlyArray<string>;
  treasurySet: boolean;
  /**
   * The closed alpha decision for this account and class (lib/alpha/gate.ts). Only an `ok`
   * result lets an unaudited class be opened on Alpha; absent or refused, the audit rule stands.
   * It never counts as an audit.
   */
  closedAlpha?: { ok: true } | { ok: false; reasons: string[] };
}

export function hasAudit(audit: unknown): boolean {
  return !!audit && typeof audit === 'object' && Object.keys(audit as object).length > 0;
}

export function deployRefusal(i: GateInput): string | null {
  if (i.network === 'mainnet' && !hasAudit(i.audit)) {
    if (!i.closedAlpha) return AUDIT_REFUSED;
    if (!i.closedAlpha.ok) return i.closedAlpha.reasons[0] ?? AUDIT_REFUSED;
  }
  if (i.pendingContracts.includes(CONTRACT_NAME[i.kind])) return RECOMPILE_REFUSED;
  if (!i.treasurySet) return TREASURY_REFUSED;
  return null;
}

/**
 * The network the build targets: Alpha only when asked for by name (the rule of
 * lib/aztec/wallet/config.ts). The variable is read by its literal name so Next.js
 * inlines it in the browser bundle.
 */
export function buildNetwork(value: string | undefined = process.env.NEXT_PUBLIC_AZTEC_NETWORK): AgreementNetwork {
  return value === 'alpha' ? 'mainnet' : 'testnet';
}
