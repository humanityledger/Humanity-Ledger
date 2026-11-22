/**
 * lib/beta/cusdc-beta.ts: the closed technical beta of private cUSDC payments (up to 100 people).
 *
 * The beta is a separate path from CUSDC_GATES (lib/payments/assets.ts). Those nine gates stay
 * untouched and unmet, so cusdcReady() stays false and the wallet keeps hiding cUSDC from everyone
 * (withoutGatedTokens). The beta shows cUSDC to one signed-in wallet only when every condition
 * below holds, and each one is checked again where value moves:
 *
 *   1. deployments/aztec-mainnet.json has cusdcBeta.enabled === true (Stefan's switch, in a PR);
 *   2. now is before cusdcBeta.until (a beta always has an end);
 *   3. the cUSDC entry in plannedTokens has verifiedOnChain === true: the read-only preflight
 *      confirmed the instance on the node, so real money cannot go to a wrong contract;
 *   4. a cap per payment in cUSDC is configured (NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS);
 *   5. the wallet is an active beta member (an invitation redeemed, not revoked, at most 100);
 *   6. the member acknowledged the current technical beta notice.
 *
 * The legal and company gates are deliberately not conditions of the beta: the operator decided on
 * 22 November 2026 to defer them to a later phase (docs/beta/CUSDC_BETA.md). The beta is a closed
 * technical test, not a launch; the public landing keeps saying "Not enabled yet".
 *
 * Pure functions, no I/O: used by the server routes (app/api/beta/cusdc/*) and by the client.
 */

/** At most this many members, enforced again by /api/beta/cusdc/redeem under a lock. */
export const MAX_BETA_TESTERS = 100;

export interface CusdcBetaEntry {
  enabled: boolean;
  /** ISO date-time the beta ends. Required: a beta without an end is refused. */
  until: string | null;
  maxTesters?: number;
}

export interface PlannedToken {
  symbol: string;
  address: string;
  decimals?: number;
  verifiedOnChain?: boolean;
}

export interface ProgramInput {
  entry: CusdcBetaEntry | null | undefined;
  /** The cUSDC entry of plannedTokens (or of tokens, once it moves there). */
  cusdc: PlannedToken | null | undefined;
  /** Cap per payment in base units for the cUSDC address, if configured. */
  cap: bigint | null | undefined;
  now: Date;
}

export interface MemberState {
  active: boolean;
  noticeVersion: string | null;
}

export type BetaResult = { ok: true } | { ok: false; reasons: string[] };

export const BETA_REASONS = {
  off: 'The cUSDC beta is not open.',
  noEnd: 'The cUSDC beta has no end date.',
  ended: 'The cUSDC beta has ended.',
  notVerified: 'The cUSDC contract has not been confirmed on the network yet.',
  noCap: 'No limit per payment is set for cUSDC yet.',
  member: 'This account has no cUSDC beta invitation.',
  revoked: 'This account’s cUSDC beta access was revoked.',
  notice: 'Read and confirm the beta notice first.',
} as const;

/**
 * The technical beta notice. It states facts about this test; it is not legal terms and does not
 * replace them (the legal texts of Ledger Chat are unchanged). Changing a word changes the version,
 * and every member confirms the new text again.
 */
export const BETA_NOTICE_VERSION = 'cusdc-beta-notice-1';
export const BETA_NOTICE: readonly string[] = [
  'This is a closed technical beta of private cUSDC payments, for at most 100 invited people. It is not a public launch.',
  'cUSDC is issued by human.tech through Shield, not by Ledger Chat. Ledger Chat never holds your keys or your funds: every payment is signed and proved on your device.',
  'The payments are real and cannot be reversed. Send only small amounts: each payment is limited.',
  'The Ledger Chat wallet code has had an internal security review only, no external audit.',
  'The account that pays the network fee is public. The amount and the recipient are private.',
  'The operator can pause new payments at any time (exits-only mode). Moving your own funds out keeps working.',
];

export function cusdcBetaEntry(record: unknown): CusdcBetaEntry | null {
  const e = (record as { cusdcBeta?: unknown } | null)?.cusdcBeta;
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  return {
    enabled: o.enabled === true,
    until: typeof o.until === 'string' ? o.until : null,
    maxTesters: typeof o.maxTesters === 'number' ? o.maxTesters : undefined,
  };
}

/** The cUSDC token from the record: tokens first (after the switch-on), else plannedTokens. */
export function recordedCusdc(record: unknown): PlannedToken | null {
  const r = record as { tokens?: PlannedToken[]; plannedTokens?: PlannedToken[] } | null;
  const pick = (list?: PlannedToken[]) => (Array.isArray(list) ? list.find((t) => String(t?.symbol).toLowerCase() === 'cusdc') : undefined);
  return pick(r?.tokens) ?? pick(r?.plannedTokens) ?? null;
}

/** Why the beta is not open for anyone, or { ok: true }. Fail-closed on anything malformed. */
export function cusdcBetaProgram(i: ProgramInput): BetaResult {
  const e = i.entry;
  if (!e || e.enabled !== true) return { ok: false, reasons: [BETA_REASONS.off] };
  const reasons: string[] = [];
  const until = e.until ? Date.parse(e.until) : NaN;
  if (!Number.isFinite(until)) reasons.push(BETA_REASONS.noEnd);
  else if (i.now.getTime() >= until) reasons.push(BETA_REASONS.ended);
  if (!i.cusdc || i.cusdc.verifiedOnChain !== true || !/^0x[0-9a-fA-F]{64}$/.test(String(i.cusdc.address))) reasons.push(BETA_REASONS.notVerified);
  if (typeof i.cap !== 'bigint' || i.cap <= 0n) reasons.push(BETA_REASONS.noCap);
  return reasons.length ? { ok: false, reasons } : { ok: true };
}

/** The program and this member together: true only when the wallet may see and send cUSDC. */
export function cusdcBetaDecision(i: ProgramInput & { member: MemberState | null }): BetaResult {
  const program = cusdcBetaProgram(i);
  const reasons = program.ok ? [] : [...program.reasons];
  if (!i.member) reasons.push(BETA_REASONS.member);
  else if (!i.member.active) reasons.push(BETA_REASONS.revoked);
  else if (i.member.noticeVersion !== BETA_NOTICE_VERSION) reasons.push(BETA_REASONS.notice);
  return reasons.length ? { ok: false, reasons } : { ok: true };
}

/**
 * What the wallet does with cUSDC for this account:
 *   send    listed, and new payments allowed (every condition holds);
 *   exits   listed so the balance stays visible and the person's own funds can still be moved
 *           (a member whose access was revoked, or a beta that was paused, ended or lost its cap),
 *           but new payments are refused;
 *   hidden  not listed: not a member, or the contract was never confirmed on the network.
 * Exits never depend on the beta being open: what someone holds stays theirs.
 */
export type BetaVisibility = 'send' | 'exits' | 'hidden';

export function cusdcBetaVisibility(i: ProgramInput & { member: MemberState | null }): BetaVisibility {
  if (!i.member) return 'hidden';
  if (!i.cusdc || i.cusdc.verifiedOnChain !== true) return 'hidden';
  return cusdcBetaDecision(i).ok ? 'send' : 'exits';
}

/** The member limit: the record may lower it, never raise it above MAX_BETA_TESTERS. */
export function betaCapacity(entry: CusdcBetaEntry | null | undefined): number {
  const n = entry?.maxTesters;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? Math.min(n, MAX_BETA_TESTERS) : MAX_BETA_TESTERS;
}

/** The cap for the cUSDC address from the parsed caps (keys are lower-case addresses). */
export function cusdcCap(caps: Readonly<Record<string, bigint>> | null | undefined, cusdc: PlannedToken | null | undefined): bigint | null {
  if (!caps || !cusdc?.address) return null;
  const v = caps[cusdc.address.toLowerCase()];
  return typeof v === 'bigint' ? v : null;
}
