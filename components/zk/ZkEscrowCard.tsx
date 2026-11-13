'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, CheckCircle, Clock, AlertTriangle,
  ChevronDown, ChevronUp, ExternalLink, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { EscrowInvite, AgreementInvite } from '@/lib/aztec/agreement-invite';
import { actOnAgreement } from '@/lib/aztec/chat-agreements';
import { AZTEC_WALLET_CONFIG } from '@/lib/aztec/wallet/config';
import { getPrivateWallet } from '@/lib/aztec/wallet/client';

// ─── Legacy type (for backward-compatibility with old __ZK_ESCROW__ messages) ─

/** @deprecated Use ZkEscrowCardProps with `invite` prop instead. */
export interface ZkEscrowState {
  id: string;
  senderTag: string;
  recipientTag: string;
  amount: string;
  token: string;
  status: 'locked' | 'released' | 'partially_released' | 'completed' | 'disputed' | 'cancelled';
  conditions: string;
  milestones: { id: string; description: string; amount: string; status: 'pending' | 'approved' | 'released' | 'rejected' }[];
  expiresAt: number;
  createdAt: number;
  txHash?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtBaseUnits(units: string, decimals = 18): string {
  try {
    const n = BigInt(units);
    const divisor = 10n ** BigInt(decimals);
    const whole = n / divisor;
    const frac = n % divisor;
    if (frac === 0n) return whole.toString();
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${whole}.${fracStr}`;
  } catch {
    return units;
  }
}

function aztecExplorerTx(txHash: string): string {
  const net = AZTEC_WALLET_CONFIG.network === 'mainnet' ? 'alpha' : 'testnet';
  return `https://aztec-explorer.vercel.app/${net}/tx/${txHash}`;
}

// ─── Props — discriminated union supporting both legacy and real invite ────────

type ZkEscrowCardProps =
  | {
      /** Real Aztec v6 EscrowInvite from XMTP. */
      invite: EscrowInvite;
      myAztecAddress?: string;
      onUpdate?: () => void;
      className?: string;
      // legacy props must not appear alongside invite
      escrow?: never;
      currentUserTag?: never;
    }
  | {
      /** @deprecated Legacy __ZK_ESCROW__ payload. Only renders a read-only view. */
      escrow: ZkEscrowState;
      currentUserTag?: string;
      onUpdate?: () => void;
      className?: string;
      invite?: never;
      myAztecAddress?: never;
    };

// ─── Status Badge ──────────────────────────────────────────────────────────────

function Badge({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <span
      className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full"
      style={{ background: bg, color: fg }}
    >
      {label}
    </span>
  );
}

// ─── Legacy read-only card ─────────────────────────────────────────────────────

function LegacyEscrowView({ escrow, className }: { escrow: ZkEscrowState; className?: string }) {
  const statusColors: Record<ZkEscrowState['status'], { label: string; fg: string; bg: string }> = {
    locked:             { label: 'Locked',             fg: '#1C1C1E', bg: '#1C1C1E20' },
    released:           { label: 'Released',           fg: '#065f46', bg: '#d1fae520' },
    partially_released: { label: 'Partial',            fg: '#1d4ed8', bg: '#dbeafe20' },
    completed:          { label: 'Completed',          fg: '#065f46', bg: '#d1fae520' },
    disputed:           { label: 'Disputed',           fg: '#b45309', bg: '#fef3c720' },
    cancelled:          { label: 'Cancelled',          fg: '#b91c1c', bg: '#fee2e220' },
  };
  const s = statusColors[escrow.status] ?? statusColors.locked;
  return (
    <div
      className={`bg-white rounded-2xl border border-black/[0.06] overflow-hidden shadow-sm ${className ?? ''}`}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.04]">
        <div className="w-9 h-9 rounded-full flex items-center justify-center bg-[#1C1C1E]">
          <Lock size={15} className="text-white" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 text-[14px]">Shielded Escrow</span>
            <Badge label={s.label} fg={s.fg} bg={s.bg} />
          </div>
          <div className="text-[11px] text-gray-400 truncate">{escrow.senderTag} → {escrow.recipientTag}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[15px] font-semibold text-gray-900">{escrow.amount}</div>
          <div className="text-[12px] text-gray-400">zk{escrow.token}</div>
        </div>
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="bg-[#f2f4f7] rounded-xl px-3 py-2.5">
          <div className="text-[11px] text-gray-400 font-semibold mb-1">Conditions</div>
          <p className="text-[12px] text-gray-700 leading-relaxed">{escrow.conditions}</p>
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span className="flex items-center gap-1">
            <Clock size={9} />
            {escrow.expiresAt > Date.now()
              ? `Expires in ${Math.max(0, Math.floor((escrow.expiresAt - Date.now()) / 86_400_000))}d`
              : 'Expired'}
          </span>
          {escrow.txHash && (
            <a
              href={aztecExplorerTx(escrow.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-0.5 text-[#15171c]"
            >
              <ExternalLink size={9} /> AztecScan
            </a>
          )}
        </div>
        <div className="flex items-start gap-1.5 pt-1">
          <AlertTriangle size={10} className="text-gray-300 mt-0.5 flex-shrink-0" />
          <span className="text-[10px] text-gray-300 leading-relaxed">Legacy escrow format — use the Private Wallet to manage active agreements</span>
        </div>
      </div>
    </div>
  );
}

// ─── Real Aztec v6 card ────────────────────────────────────────────────────────

function RealEscrowCard({ invite, myAztecAddress, onUpdate, className }: {
  invite: EscrowInvite;
  myAztecAddress?: string;
  onUpdate?: () => void;
  className?: string;
}) {
  const me = (myAztecAddress ?? getPrivateWallet().state.aztecAddress ?? '').toLowerCase();
  const isSender    = me && invite.sender.toLowerCase()    === me;
  const isRecipient = me && invite.recipient.toLowerCase() === me;

  const deadlineMs   = invite.deadline * 1000;
  const deadlinePast = Date.now() > deadlineMs;
  const daysLeft     = Math.max(0, Math.floor((deadlineMs - Date.now()) / 86_400_000));
  const hoursLeft    = Math.max(0, Math.floor((deadlineMs - Date.now()) / 3_600_000));

  const [status,      setStatus]      = useState<'locked' | 'claimed' | 'refunded' | 'error'>('locked');
  const [busy,        setBusy]        = useState(false);
  const [txHash,      setTxHash]      = useState<string | null>(null);
  const [confirming,  setConfirming]  = useState<'claim' | 'refund' | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const humanAmount = fmtBaseUnits(invite.amount);

  const run = useCallback(async (action: 'claim' | 'refund') => {
    setBusy(true);
    setConfirming(null);
    try {
      const hash = await actOnAgreement(invite as AgreementInvite, action);
      setTxHash(hash ?? null);
      setStatus(action === 'claim' ? 'claimed' : 'refunded');
      onUpdate?.();
      window.dispatchEvent(new CustomEvent('ledger_zk_notification', {
        detail: { type: action, tokenSymbol: invite.tokenSymbol, amount: invite.amount, txHash: hash },
      }));
      toast.success(
        action === 'claim'
          ? `Escrow claimed — ${humanAmount} ${invite.tokenSymbol} arriving in your private balance`
          : `Escrow refunded — ${humanAmount} ${invite.tokenSymbol} returned`,
        { duration: 8000 },
      );
    } catch (err: any) {
      setStatus('error');
      toast.error(err?.shortMessage || err?.message || 'Transaction failed');
    } finally {
      setBusy(false);
    }
  }, [invite, humanAmount, onUpdate]);

  const statusBadge = (() => {
    if (status === 'claimed')  return <Badge label="Claimed"  fg="#065f46" bg="#d1fae520" />;
    if (status === 'refunded') return <Badge label="Refunded" fg="#b91c1c" bg="#fee2e220" />;
    if (status === 'error')    return <Badge label="Error"    fg="#b91c1c" bg="#fee2e220" />;
    if (deadlinePast)          return <Badge label="Expired"  fg="#b45309" bg="#fef3c720" />;
    return <Badge label="Locked" fg="#1C1C1E" bg="#1C1C1E20" />;
  })();

  return (
    <div
      className={`bg-white rounded-2xl border border-black/[0.06] overflow-hidden shadow-sm ${className ?? ''}`}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.04]">
        <div className="w-9 h-9 rounded-full flex items-center justify-center bg-[#1C1C1E]">
          <Lock size={15} className="text-white" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 text-[14px]">Shielded Escrow</span>
            {statusBadge}
          </div>
          <div className="text-[11px] text-gray-400 font-mono truncate">
            {invite.sender.slice(0, 10)}…{invite.sender.slice(-6)} →{' '}
            {invite.recipient.slice(0, 10)}…{invite.recipient.slice(-6)}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[15px] font-semibold text-gray-900">{humanAmount}</div>
          <div className="text-[12px] text-gray-400">{invite.tokenSymbol}</div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Deadline */}
        <div className="flex items-center justify-between text-[12px] text-gray-400">
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {status === 'claimed' || status === 'refunded'
              ? 'Settled'
              : deadlinePast
              ? 'Deadline passed'
              : daysLeft > 0
              ? `${daysLeft}d ${hoursLeft % 24}h remaining`
              : `${hoursLeft}h remaining`}
          </span>
          {txHash && (
            <a
              href={aztecExplorerTx(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-0.5 text-[#1C1C1E] hover:underline"
            >
              <ExternalLink size={9} /> AztecScan
            </a>
          )}
        </div>

        {/* Details toggle */}
        <button
          onClick={() => setShowDetails(v => !v)}
          className="w-full flex items-center justify-between py-1 text-[11px] font-semibold text-gray-500"
        >
          <span>Contract details</span>
          {showDetails ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
        </button>

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="bg-[#f2f4f7] rounded-xl px-3 py-2.5 space-y-1.5">
                {[
                  { label: 'Token',    value: invite.tokenSymbol },
                  { label: 'Amount',   value: `${humanAmount} ${invite.tokenSymbol}` },
                  { label: 'Deadline', value: new Date(deadlineMs).toLocaleString() },
                  { label: 'Instance', value: `${invite.instanceAddress.slice(0, 14)}…${invite.instanceAddress.slice(-6)}` },
                  { label: 'Network',  value: AZTEC_WALLET_CONFIG.network === 'mainnet' ? 'Aztec Alpha' : 'Aztec Testnet' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-[11px]">
                    <span className="text-gray-400 font-medium">{label}</span>
                    <span className="text-gray-700 font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success confirmation */}
        {(status === 'claimed' || status === 'refunded') && (
          <div className="flex items-center gap-2 bg-[#1C1C1E]/10 rounded-xl px-3 py-2.5">
            <CheckCircle size={14} className="text-[#1C1C1E]" strokeWidth={2.5} />
            <span className="text-[12px] font-semibold text-[#1C1C1E]">
              {status === 'claimed'
                ? `Claimed — ${humanAmount} ${invite.tokenSymbol} in your private balance`
                : `Refunded — ${humanAmount} ${invite.tokenSymbol} returned to sender`}
            </span>
          </div>
        )}

        {/* Proving busy indicator */}
        {busy && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <Loader2 size={14} className="text-amber-600 animate-spin flex-shrink-0" />
            <span className="text-[12px] font-medium text-amber-800">
              Generating zero-knowledge proof on this device. This can take a few minutes…
            </span>
          </div>
        )}

        {/* Actions */}
        {status === 'locked' && (isSender || isRecipient) && (
          <div className="flex gap-2 pt-1">
            {confirming === 'claim' ? (
              <>
                <button
                  onClick={() => setConfirming(null)}
                  disabled={busy}
                  className="flex-1 py-2 rounded-xl text-[12px] font-semibold bg-[#f2f4f7] text-gray-600 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => run('claim')}
                  disabled={busy}
                  className="flex-1 py-2 rounded-xl text-[12px] font-semibold text-white bg-[#1C1C1E] disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                  Confirm Claim
                </button>
              </>
            ) : confirming === 'refund' ? (
              <>
                <button
                  onClick={() => setConfirming(null)}
                  disabled={busy}
                  className="flex-1 py-2 rounded-xl text-[12px] font-semibold bg-[#f2f4f7] text-gray-600 disabled:opacity-50"
                >
                  Keep Escrow
                </button>
                <button
                  onClick={() => run('refund')}
                  disabled={busy}
                  className="flex-1 py-2 rounded-xl text-[12px] font-semibold text-white bg-[#e5484d] disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : null}
                  Confirm Refund
                </button>
              </>
            ) : (
              <>
                {isRecipient && !deadlinePast && (
                  <button
                    onClick={() => setConfirming('claim')}
                    disabled={busy}
                    className="flex-1 py-2 rounded-xl text-[12.5px] font-semibold text-white bg-[#1C1C1E] disabled:opacity-50"
                  >
                    Claim
                  </button>
                )}
                {isSender && deadlinePast && (
                  <button
                    onClick={() => setConfirming('refund')}
                    disabled={busy}
                    className="flex-1 py-2 rounded-xl text-[12.5px] font-semibold text-[#d93036] bg-red-50 disabled:opacity-50"
                  >
                    Refund (deadline passed)
                  </button>
                )}
                {isSender && !deadlinePast && (
                  <div className="flex-1 py-2 rounded-xl text-[12px] font-medium text-gray-400 bg-[#f2f4f7] text-center">
                    Waiting for recipient to claim
                  </div>
                )}
                {isRecipient && deadlinePast && (
                  <div className="flex-1 py-2 rounded-xl text-[12px] font-medium text-gray-400 bg-[#f2f4f7] text-center">
                    Deadline passed — sender can refund
                  </div>
                )}
                {!isSender && !isRecipient && !me && (
                  <div className="flex-1 py-2 rounded-xl text-[12px] font-medium text-gray-400 bg-[#f2f4f7] text-center">
                    Open Private Wallet to act
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <div className="flex items-start gap-1.5 pt-1">
          <AlertTriangle size={10} className="text-gray-300 mt-0.5 flex-shrink-0" />
          <span className="text-[10px] text-gray-300 leading-relaxed">
            Unaudited Alpha — do not use with funds you cannot afford to lose
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Public export — discriminated union entry point ──────────────────────────

export function ZkEscrowCard(props: ZkEscrowCardProps) {
  if (props.invite) {
    return (
      <RealEscrowCard
        invite={props.invite}
        myAztecAddress={props.myAztecAddress}
        onUpdate={props.onUpdate}
        className={props.className}
      />
    );
  }
  return <LegacyEscrowView escrow={props.escrow} className={props.className} />;
}
