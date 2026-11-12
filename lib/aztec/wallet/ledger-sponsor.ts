/**
 * LedgerSponsor in the browser (contracts/aztec/sponsor; proposal P1 in docs/MAINNET_READINESS.md).
 *
 * - Users: when an account has no Fee Juice, ask the server for a one-use voucher and let the sponsor
 *   pay that transaction (account creation first). If sponsorship is off, used up or fails, the
 *   caller falls back to the usual "add Fee Juice" path; nothing is sent.
 * - The operator (from the phone, no terminal): deploy the sponsor from their own private wallet,
 *   bridge AZTEC from their own Ethereum wallet to the sponsor's address, and claim it into the
 *   sponsor. Every on-chain step is signed by the operator's own wallets.
 */
import { AZTEC_WALLET_CONFIG } from './config';

const ADDRESS_RE = /^0x[0-9a-fA-F]{64}$/;

/** The sponsor this build uses, on Alpha only (NEXT_PUBLIC_AZTEC_SPONSOR). */
export function ledgerSponsorAddress(): string {
  const a = (process.env.NEXT_PUBLIC_AZTEC_SPONSOR || '').trim();
  return AZTEC_WALLET_CONFIG.network === 'mainnet' && ADDRESS_RE.test(a) ? a : '';
}

/** Ethereum address allowed to see the operator tools (NEXT_PUBLIC_AZTEC_SPONSOR_ADMIN; public, not a secret). */
export function isSponsorAdmin(evmAddress: string | undefined | null): boolean {
  const admin = (process.env.NEXT_PUBLIC_AZTEC_SPONSOR_ADMIN || '').trim().toLowerCase();
  return !!admin && !!evmAddress && evmAddress.toLowerCase() === admin;
}

/**
 * Largest maximum fee the sponsor pays for one transaction: 40 AZTEC of Fee Juice. The wallet
 * asks for up to 2x the current minimum fees (about 28 AZTEC at the fees of 12 November 2026);
 * only the gas actually used is charged.
 */
export const SPONSOR_MAX_FEE = 40n * 10n ** 18n;

let artifactP: Promise<any> | null = null;
export function sponsorArtifact(): Promise<any> {
  artifactP ??= (async () => {
    const [{ loadContractArtifact }, json] = await Promise.all([
      import('@aztec-labs/aztec.js/abi'),
      import('../../../contracts/aztec/sponsor/target/ledger_sponsor-LedgerSponsor.json'),
    ]);
    return loadContractArtifact(((json as any).default ?? json) as any);
  })();
  artifactP.catch(() => { artifactP = null; });
  return artifactP;
}

interface Ctx { sdk: any; wallet: any; node: any }

/** Registers the deployed sponsor with this wallet and returns a contract handle. */
export async function sponsorContract(ctx: Ctx, address: string) {
  const [artifact, { Contract }] = await Promise.all([sponsorArtifact(), import('@aztec-labs/aztec.js/contracts')]);
  const addr = ctx.sdk.AztecAddress.fromString(address);
  const instance = await ctx.node.getContract(addr);
  if (!instance) throw new Error('The Ledger sponsor is not deployed at the configured address.');
  // Registration recomputes the class from the artifact: a different contract at that address is refused.
  await ctx.wallet.registerContract(instance, artifact);
  return { addr, contract: (Contract as any).at(addr, artifact, ctx.wallet) };
}

/**
 * A fee option paid by the sponsor for one transaction, or null when sponsorship is off, used up
 * for this account or for today, or the voucher cannot be used.
 */
export async function sponsoredFee(ctx: Ctx): Promise<{ paymentMethod: any } | null> {
  const address = ledgerSponsorAddress();
  if (!address) return null;
  try {
    const res = await fetch('/api/aztec/sponsor', { method: 'POST', credentials: 'include' });
    if (!res.ok) return null;
    const v = await res.json();
    if (String(v.sponsor || '').toLowerCase() !== address.toLowerCase()) return null;
    const { addr, contract } = await sponsorContract(ctx, address);
    const call = contract.methods.sponsor(ctx.sdk.Fr.fromString(v.voucherId), BigInt(v.expiresAt), v.signerX, v.signerY, v.signature);
    return {
      paymentMethod: {
        getAsset: async () => { throw new Error('This fee is paid by the Ledger sponsor in Fee Juice.'); },
        getFeePayer: async () => addr,
        getExecutionPayload: async () => call.request(),
        getGasSettings: () => undefined,
      },
    };
  } catch {
    return null;
  }
}

// ── Operator tools ──────────────────────────────────────────────────────────

export interface SponsorFunding { sponsor: string; secret: string; claimAmount: string; messageHash: string; messageLeafIndex: string; l1TxHash?: string; claimed?: boolean }
const FUNDING_KEY = 'hl:aztec-sponsor-funding';

export function loadFundings(): SponsorFunding[] {
  try { return JSON.parse(localStorage.getItem(FUNDING_KEY) || '[]'); } catch { return []; }
}
export function saveFundings(list: SponsorFunding[]) {
  try { localStorage.setItem(FUNDING_KEY, JSON.stringify(list)); } catch { /* nothing kept */ }
}

/** Public key halves and cap for the constructor, from the server (GET /api/aztec/sponsor). */
export async function sponsorDeployArgs(): Promise<{ xHi: string; xLo: string; yHi: string; yLo: string }> {
  const r = await fetch('/api/aztec/sponsor', { credentials: 'include' });
  const j = await r.json().catch(() => null);
  if (!j?.signer) throw new Error('The server has no sponsor key yet (AZTEC_SPONSOR_SIGNER_KEY or JWT_SECRET).');
  return j.signer;
}
