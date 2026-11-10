/**
 * lib/payments/direct-private.ts — a private payment from a DM to the peer (R-11).
 *
 * The payee is never typed or taken from the caller: it is the Aztec address
 * pinned for the DM peer (lib/aztec/peer-binding.ts). Before anything is
 * proven, on Aztec Alpha:
 *   - the node must be on the build's network, with Alpha enabled;
 *   - the pinned address must carry a G7 proof that verifies now;
 *   - the user must have acknowledged the unaudited client and the public fee payer;
 *   - the amount must be within the operator's per-token cap (same caps as agreements).
 * The transfer then goes through PrivateWallet.send, which re-checks the node
 * and Fee Juice pins and picks the fee (resolveFee). Open gates: G6 (two-account
 * session in real browsers) and G8 (no external audit).
 */
import { checkAgreementContext, type PolicyResult } from '../aztec/agreement-policy';
import { feeNetworkFromL1ChainId, type FeeNetwork } from '../aztec/fees';
import { parseUnits } from '../aztec/wallet/amounts';
import { AZTEC_WALLET_CONFIG, explorerTxUrl, networkLabel, tokenConfig, type TokenKey } from '../aztec/wallet/config';
import type { RiskAcknowledgement } from '../aztec/chat-agreements';

export interface DirectPolicyInput {
  network: FeeNetwork;
  token: string;
  amount: bigint;
  caps?: Readonly<Record<string, bigint>>;
  peerVerified: boolean;
  acknowledgedUnaudited: boolean;
  acknowledgedPublicFeePayer: boolean;
}

/** Size and consent rules for a direct payment; anything goes on testnet except a non-positive amount. */
export function checkDirectPaymentPolicy(p: DirectPolicyInput): PolicyResult {
  const reasons: string[] = [];
  if (p.amount <= 0n) reasons.push('amount must be positive');
  if (p.network === 'testnet' || p.network === 'local') return reasons.length ? { ok: false, reasons } : { ok: true };
  if (!p.peerVerified) reasons.push("the payee's Aztec address has no verified proof of control (G7)");
  if (!p.acknowledgedUnaudited) reasons.push('this app is unaudited and the user has not acknowledged it');
  if (!p.acknowledgedPublicFeePayer) reasons.push('the fee payer is public and the user has not acknowledged it');
  const cap = p.caps?.[p.token.toLowerCase()];
  if (cap === undefined) reasons.push('no amount cap configured for this token on mainnet');
  else if (p.amount > cap) reasons.push(`amount exceeds the mainnet cap of ${cap} base units`);
  return reasons.length ? { ok: false, reasons } : { ok: true };
}

export interface DirectPaymentRequest {
  token: TokenKey;
  /** Whole tokens, as typed ("12.5"). */
  amount: string;
  dmPeerInboxId: string;
  selfInboxId: string;
  ack?: RiskAcknowledgement;
}

export interface DirectPaymentDeps {
  nodeInfo(): Promise<{ l1ChainId: number | bigint | string }>;
  /** Pinned address and fresh G7 status (verifiedPeerBinding). */
  binding(dmPeerInboxId: string, selfInboxId: string): Promise<{ address?: string; verified: boolean }>;
  send(token: TokenKey, amount: string, to: string): Promise<any>;
  config?: Pick<typeof AZTEC_WALLET_CONFIG, 'network' | 'alphaEnabled' | 'agreementCaps'>;
  tokenOf?: (key: TokenKey) => { address: string; decimals: number };
}

async function defaultDeps(): Promise<DirectPaymentDeps> {
  const [{ getPrivateWallet }, pb] = await Promise.all([import('../aztec/wallet/client'), import('../aztec/peer-binding')]);
  return {
    nodeInfo: () => getPrivateWallet().agreementContext().node.getNodeInfo(),
    binding: async (peer, self) => pb.verifiedPeerBinding(pb.localStoragePeerBindingStore(), peer, self, await pb.sdkBindingCrypto()),
    send: (t, a, to) => getPrivateWallet().send(t, a, to),
  };
}

const sentence = (r: string) => `${r[0].toUpperCase()}${r.slice(1)}.`;

/** Checks everything, then sends. Throws (nothing proven, nothing sent) on any failed check. */
export async function sendDirectPrivatePayment(r: DirectPaymentRequest, deps?: DirectPaymentDeps): Promise<{ txHash: string; payee: string }> {
  const d = deps ?? (await defaultDeps());
  const cfg = d.config ?? AZTEC_WALLET_CONFIG;
  const t = (d.tokenOf ?? tokenConfig)(r.token);
  const units = parseUnits(r.amount, t.decimals);
  const network = feeNetworkFromL1ChainId(Number((await d.nodeInfo()).l1ChainId));
  const binding = await d.binding(r.dmPeerInboxId, r.selfInboxId);
  if (!binding.address) throw new Error('This person has not shared an Aztec address in this chat yet.');
  const pre = checkAgreementContext({
    nodeNetwork: network,
    buildNetwork: cfg.network,
    alphaEnabled: cfg.alphaEnabled,
    pinnedAddress: binding.address,
    claimedAddress: binding.address, // the payee is the pin itself, never caller input
  });
  if (!pre.ok) throw new Error(sentence(pre.reasons[0]));
  const pol = checkDirectPaymentPolicy({
    network: network!,
    token: t.address,
    amount: units,
    caps: cfg.agreementCaps,
    peerVerified: binding.verified,
    acknowledgedUnaudited: r.ack?.unaudited === true,
    acknowledgedPublicFeePayer: r.ack?.publicFeePayer === true,
  });
  if (!pol.ok) throw new Error(sentence(pol.reasons[0]));
  const receipt = await d.send(r.token, r.amount, binding.address);
  const txHash = String(receipt?.txHash?.toString?.() ?? receipt?.txHash ?? '');
  // Never report a payment without a hash the peer can check.
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new Error('The payment has no transaction hash. Check your wallet activity before trying again.');
  return { txHash, payee: binding.address };
}

/** The DM message announcing a payment: network named, hash always included, no unlinkability claim. */
export function directPaymentMessage(p: { token: TokenKey; txHash: string; senderAztec?: string; network?: 'testnet' | 'mainnet' }): string {
  const mainnet = (p.network ?? AZTEC_WALLET_CONFIG.network) === 'mainnet';
  const url = explorerTxUrl(p.txHash);
  return (
    (mainnet
      ? `I sent you a private payment in ${p.token} on ${networkLabel()}. The amount is private; the network fee is paid publicly by my account. `
      : `I sent you a private payment in ${p.token} test tokens on the Aztec test network. Only you and I can see the amount. `) +
    `Transaction: ${p.txHash}${url ? ` (${url})` : ''}.` +
    (p.senderAztec ? ` If it does not show in your private wallet, add my Aztec address under Receive: ${p.senderAztec}` : '')
  );
}
