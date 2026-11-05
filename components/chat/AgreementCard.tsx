'use client';

/**
 * A private agreement (escrow or payment stream) or an Aztec address
 * announcement, shown inside a Ledger Chat conversation.
 *
 * The card shows only the public fields of an invitation (summarizeInvite);
 * the contract secret and the claim secret never reach the screen.
 *
 * For the receiver, nothing is trusted until "Verify and accept": the
 * invitation must come from the peer's pinned Aztec address, name a genuine
 * instance of the recorded class for an accepted token, and match the
 * contract's own stored note (lib/aztec/chat-agreements.ts). Settlement
 * actions are real transactions on the Aztec test network, proven on this
 * device with the private wallet.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, Waves, KeyRound, ShieldCheck, AlertTriangle, LoaderCircle } from 'lucide-react';
import { summarizeInvite, agreementMessageKind } from '@/lib/aztec/agreement-message';
import { localStoragePeerBindingStore, peerAztecAddress, recordPeerAnnouncement, type AnnouncementResult } from '@/lib/aztec/peer-binding';
import { getPrivateWallet, humanError, type WalletSnapshot } from '@/lib/aztec/wallet/client';
import { formatUnits } from '@/lib/aztec/wallet/amounts';
import { AZTEC_WALLET_CONFIG } from '@/lib/aztec/wallet/config';

const CARD = 'rounded-2xl bg-white border border-[#e6e8ec] shadow-[0_1px_2px_rgba(16,24,40,0.04)]';
const BTN = 'h-9 px-3.5 rounded-full text-[13.5px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_PRIMARY = `${BTN} bg-[#15171c] text-white hover:bg-[#2a2d35]`;
const BTN_SECONDARY = `${BTN} bg-[#eff1f4] text-[#15171c] hover:bg-[#e4e7ec]`;

const store = typeof window === 'undefined' ? null : localStoragePeerBindingStore();
const short = (v: string) => (v.length > 14 ? `${v.slice(0, 8)}…${v.slice(-4)}` : v);
const acceptedKey = (instance: string) => `hl.agreement.accepted.${instance.toLowerCase()}`;

function useWalletState(): WalletSnapshot | null {
  const [s, setS] = useState<WalletSnapshot | null>(() => (typeof window === 'undefined' ? null : getPrivateWallet().state));
  useEffect(() => (typeof window === 'undefined' ? undefined : getPrivateWallet().subscribe(setS)), []);
  return s;
}

function decimalsOf(token: string): number | null {
  const t = AZTEC_WALLET_CONFIG.tokens.find((x) => x.address.toLowerCase() === token.toLowerCase());
  return t ? t.decimals : null;
}

function amountText(units: bigint, token: string, symbol: string) {
  const d = decimalsOf(token);
  return d === null ? `${units.toString()} base units of ${symbol || 'an unknown token'}` : `${formatUnits(units, d)} ${symbol}`;
}

function Label({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-[13px] text-[#727a88]">
      <span className="w-6 h-6 rounded-full bg-[#eff1f4] text-[#15171c] flex items-center justify-center" aria-hidden="true">{icon}</span>
      {children}
    </span>
  );
}

function Note({ tone, children }: { tone: 'info' | 'warn' | 'ok'; children: React.ReactNode }) {
  const cls =
    tone === 'warn'
      ? 'text-[#7a2e12] bg-[#fdf0eb] border-[#f5d3c4]'
      : tone === 'ok'
        ? 'text-[#14532d] bg-[#ecfdf3] border-[#c6f0d6]'
        : 'text-[#4a505c] bg-[#f7f8fa] border-[#eceef2]';
  return <p className={`mt-3 text-[13px] leading-snug border rounded-xl px-3 py-2 ${cls}`}>{children}</p>;
}

/** An Aztec address the peer shared in this conversation; pinned on first use. */
function AddressAnnouncement({ raw, isMe, dmPeerInboxId, senderInboxId }: { raw: string; isMe: boolean; dmPeerInboxId?: string; senderInboxId?: string }) {
  const [result, setResult] = useState<AnnouncementResult | null>(null);
  const address = useMemo(() => {
    try {
      return String(JSON.parse(raw).address || '');
    } catch {
      return '';
    }
  }, [raw]);

  useEffect(() => {
    if (isMe || !store || !dmPeerInboxId || !senderInboxId) return;
    recordPeerAnnouncement(store, { senderInboxId, peerInboxId: dmPeerInboxId, body: raw }).then(setResult).catch(() => {});
  }, [raw, isMe, dmPeerInboxId, senderInboxId]);

  return (
    <div className={`${CARD} min-w-[240px] max-w-[320px] p-4`}>
      <Label icon={<KeyRound size={13} strokeWidth={2} />}>{isMe ? 'You shared your Aztec address' : 'Shared their Aztec address'}</Label>
      <p className="mt-2 font-mono text-[12.5px] text-[#15171c] break-all">{address}</p>
      {!isMe && result?.status === 'pinned' && <Note tone="ok">Saved for this chat. Agreements from this person must come from this address.</Note>}
      {!isMe && result?.status === 'conflict' && (
        <Note tone="warn">
          This is not the address saved for this person ({short(result.pinned)}). It was not saved. Confirm the change with them another way before trusting it.
        </Note>
      )}
      {!isMe && !dmPeerInboxId && <Note tone="info">Not saved yet: the other person in this conversation is still being confirmed.</Note>}
    </div>
  );
}

export interface AgreementCardProps {
  raw: string;
  isMe: boolean;
  /** The XMTP inbox of the other person in this direct conversation (absent in groups). */
  dmPeerInboxId?: string;
  /** The XMTP inbox that sent this message. */
  senderInboxId?: string;
}

export const AgreementCard = React.memo(function AgreementCard({ raw, isMe, dmPeerInboxId, senderInboxId }: AgreementCardProps) {
  const kind = agreementMessageKind(raw);
  if (kind === 'address') return <AddressAnnouncement raw={raw} isMe={isMe} dmPeerInboxId={dmPeerInboxId} senderInboxId={senderInboxId} />;
  return <InviteCard raw={raw} isMe={isMe} dmPeerInboxId={dmPeerInboxId} senderInboxId={senderInboxId} />;
});

type Status = Awaited<ReturnType<typeof import('@/lib/aztec/chat-agreements')['agreementStatus']>>;

function InviteCard({ raw, isMe, dmPeerInboxId, senderInboxId }: AgreementCardProps) {
  const summary = useMemo(() => summarizeInvite(raw), [raw]);
  const wallet = useWalletState();
  const ready = wallet?.phase === 'ready';
  const me = wallet?.aztecAddress?.toLowerCase();
  const [accepted, setAccepted] = useState<boolean>(() => {
    try {
      return !!summary && localStorage.getItem(acceptedKey(summary.instanceAddress)) === 'confirmed';
    } catch {
      return false;
    }
  });
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mismatches, setMismatches] = useState<string[] | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 15_000);
    return () => clearInterval(t);
  }, []);

  const role: 'sender' | 'recipient' | 'other' | null = !summary || !me ? null : me === summary.sender.toLowerCase() ? 'sender' : me === summary.recipient.toLowerCase() ? 'recipient' : 'other';
  const canRead = ready && (role === 'sender' || (role === 'recipient' && accepted));

  const refresh = useCallback(async () => {
    if (!summary || !canRead) return;
    try {
      const { agreementStatus } = await import('@/lib/aztec/chat-agreements');
      setStatus(await agreementStatus(JSON.parse(raw)));
    } catch (e) {
      setError(humanError(e));
    }
  }, [raw, summary, canRead]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!summary) {
    return <div className={`${CARD} p-4 max-w-[300px] text-[13.5px] text-[#727a88]`}>This agreement message is not valid and was ignored.</div>;
  }

  const isEscrow = summary.kind === 'escrow';
  const amount = amountText(summary.amount, summary.token, summary.tokenSymbol);

  const accept = async () => {
    setError(null);
    setMismatches(null);
    if (!store || !dmPeerInboxId || senderInboxId !== dmPeerInboxId) {
      setError('Agreements can only be accepted in a direct conversation, from the other person.');
      return;
    }
    const pinned = await peerAztecAddress(store, dmPeerInboxId);
    if (!pinned) {
      setError('Ask this person to share their Aztec address in this chat first (Private agreement, Share my Aztec address).');
      return;
    }
    setBusy('Checking the invitation');
    try {
      const { acceptChatAgreement } = await import('@/lib/aztec/chat-agreements');
      const r = await acceptChatAgreement(raw, pinned, setBusy);
      if (!r.ok) setError(`Refused: ${r.reason}.`);
      else if (!r.confirmed) setMismatches(r.mismatches);
      else {
        try {
          localStorage.setItem(acceptedKey(summary.instanceAddress), 'confirmed');
        } catch {}
        setAccepted(true);
      }
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(null);
    }
  };

  const act = async (action: 'claim' | 'refund' | 'withdraw' | 'cancel') => {
    setError(null);
    setBusy(action === 'claim' ? 'Claiming' : action === 'refund' ? 'Refunding' : action === 'withdraw' ? 'Withdrawing' : 'Cancelling');
    try {
      const { actOnAgreement } = await import('@/lib/aztec/chat-agreements');
      const amountUnits = action === 'withdraw' && status?.kind === 'stream' ? status.available : undefined;
      await actOnAgreement(JSON.parse(raw), action, amountUnits);
      await refresh();
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(null);
    }
  };

  const deadlinePassed = isEscrow && summary.deadline !== undefined && now > summary.deadline;
  let line: string;
  let actions: React.ReactNode = null;

  if (!ready) {
    line = 'Open your private wallet (Private payment) to see and settle this agreement.';
  } else if (role === 'other') {
    line = 'This agreement is between other Aztec accounts.';
  } else if (role === 'recipient' && !accepted) {
    line = isEscrow ? `${isMe ? 'You' : 'They'} offered you ${amount} in escrow.` : `${isMe ? 'You' : 'They'} opened a payment stream to you: ${amount}.`;
    actions = (
      <button type="button" className={BTN_PRIMARY} disabled={!!busy} onClick={accept}>
        Verify and accept
      </button>
    );
  } else if (!status) {
    line = 'Reading the agreement from the contract.';
  } else if (status.kind === 'escrow') {
    if (status.role === 'recipient') {
      if (!status.found) line = 'Claimed, or not yet visible to your wallet.';
      else if (status.settled) line = 'Settled.';
      else if (!deadlinePassed) {
        line = `You can claim ${amount} until ${new Date(summary.deadline! * 1000).toLocaleString()}.`;
        actions = <button type="button" className={BTN_PRIMARY} disabled={!!busy} onClick={() => act('claim')}>Claim</button>;
      } else line = 'The claim window has closed. The sender can take the funds back.';
    } else {
      if (!status.found) line = 'Refunded, or not yet visible to your wallet.';
      else if (status.settled) line = 'Settled: claimed by the recipient or refunded to you.';
      else if (deadlinePassed) {
        line = `Not claimed in time. You can take back ${amount}.`;
        actions = <button type="button" className={BTN_PRIMARY} disabled={!!busy} onClick={() => act('refund')}>Refund</button>;
      } else line = `Waiting for the recipient to claim, until ${new Date(summary.deadline! * 1000).toLocaleString()}.`;
    }
  } else {
    const d = decimalsOf(summary.token);
    const fmt = (u: bigint) => (d === null ? u.toString() : `${formatUnits(u, d)} ${summary.tokenSymbol}`);
    if (!status.found) line = 'Not yet visible to your wallet.';
    else if (!status.live) line = `Ended. ${fmt(status.withdrawn)} of ${fmt(status.total)} withdrawn before the end.`;
    else if (status.role === 'recipient') {
      line = `${fmt(status.withdrawn)} withdrawn of ${fmt(status.total)}. Available now: ${fmt(status.available)}.`;
      actions = <button type="button" className={BTN_PRIMARY} disabled={!!busy || status.available <= 0n} onClick={() => act('withdraw')}>Withdraw</button>;
    } else {
      line = `${fmt(status.withdrawn)} withdrawn of ${fmt(status.total)}. Cancelling pays the recipient what has accrued and returns the rest to you.`;
      actions = <button type="button" className={BTN_SECONDARY} disabled={!!busy} onClick={() => act('cancel')}>Cancel stream</button>;
    }
  }

  return (
    <div className={`${CARD} min-w-[260px] max-w-[340px] p-4`}>
      <Label icon={isEscrow ? <Lock size={13} strokeWidth={2} /> : <Waves size={13} strokeWidth={2} />}>
        {isEscrow ? 'Private escrow' : 'Private payment stream'}
      </Label>
      <p className="text-[22px] font-semibold tracking-[-0.02em] tabular-nums text-[#15171c] mt-2.5">{amount}</p>
      {!isEscrow && summary.rate !== undefined && decimalsOf(summary.token) !== null && (
        <p className="text-[13px] text-[#727a88] mt-0.5">
          {formatUnits(summary.rate, decimalsOf(summary.token)!)} {summary.tokenSymbol} per second
        </p>
      )}
      <p className="text-[13.5px] text-[#4a505c] mt-2 leading-snug">{line}</p>
      {accepted && role === 'recipient' && (
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-[#14532d]">
          <ShieldCheck size={13} strokeWidth={2} aria-hidden="true" /> Verified against the contract
        </p>
      )}
      {mismatches && (
        <Note tone="warn">
          <AlertTriangle size={13} strokeWidth={2} className="inline mr-1 -mt-0.5" aria-hidden="true" />
          The contract does not hold what the invitation says ({mismatches.join(', ')}). Do not rely on it.
        </Note>
      )}
      {error && <Note tone="warn">{error}</Note>}
      {busy && (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-[#727a88]" role="status">
          <LoaderCircle size={13} strokeWidth={2} className="animate-spin" aria-hidden="true" /> {busy}
        </p>
      )}
      {actions && !busy && <div className="mt-3 flex gap-2">{actions}</div>}
      <p className="mt-3 text-[11.5px] text-[#9aa0ab]">Aztec test network · test tokens with no value · contract {short(summary.instanceAddress)}</p>
    </div>
  );
}

export default AgreementCard;
