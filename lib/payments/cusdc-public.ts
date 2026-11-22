/**
 * lib/payments/cusdc-public.ts: cUSDC for everyone in the private wallet, replacing HLC.
 *
 * The operator's switch is `cusdcPublic.enabled` in deployments/aztec-mainnet.json, off by default
 * and changed only in a pull request. Turning it on does not mark any of CUSDC_GATES as met: they
 * stay a factual record (lib/payments/assets.ts). The wallet lists cUSDC only when every technical
 * check below holds as well, so a wrong or unconfirmed contract is never listed. Exits-only mode
 * (AZTEC_VALUE_MODE) still stops new payments at once, and every payment still needs its cap.
 */
export const CUSDC_ADDRESS = '0x30112e52178143b74cf6037d047bbba924f4b0db8aab587a340aacfc6ecb4f38';

export type CusdcPublicEntry = { enabled: boolean };

export function cusdcPublicEntry(record: unknown): CusdcPublicEntry | null {
  const e = (record as { cusdcPublic?: unknown } | null)?.cusdcPublic as { enabled?: unknown } | undefined;
  return e && typeof e === 'object' ? { enabled: e.enabled === true } : null;
}

export const PUBLIC_REASONS = {
  off: 'cUSDC for everyone is switched off.',
  notVerified: 'The cUSDC contract is not confirmed on the network yet.',
  notConfigured: 'The CUSDC slot of this build is not the confirmed cUSDC contract.',
  noCap: 'There is no cap per payment for cUSDC.',
} as const;

export type PublicInput = {
  entry: CusdcPublicEntry | null;
  planned: { address: string; decimals?: number; verifiedOnChain?: boolean } | null;
  configured: { address: string; symbol: string; decimals: number } | null | undefined;
  cap: bigint | null | undefined;
};

/** Why cUSDC is not listed for everyone, or { ok: true }. Fail-closed on anything missing. */
export function cusdcPublicDecision(i: PublicInput): { ok: true } | { ok: false; reasons: string[] } {
  if (i.entry?.enabled !== true) return { ok: false, reasons: [PUBLIC_REASONS.off] };
  const reasons: string[] = [];
  const planned = i.planned;
  if (!planned || planned.verifiedOnChain !== true || planned.address.toLowerCase() !== CUSDC_ADDRESS) reasons.push(PUBLIC_REASONS.notVerified);
  const c = i.configured;
  if (!c || c.address.toLowerCase() !== CUSDC_ADDRESS || c.symbol !== 'cUSDC' || Number(c.decimals) !== 6) reasons.push(PUBLIC_REASONS.notConfigured);
  if (typeof i.cap !== 'bigint' || i.cap <= 0n) reasons.push(PUBLIC_REASONS.noCap);
  return reasons.length ? { ok: false, reasons } : { ok: true };
}
