'use client';

/**
 * On the phone: answers the signing requests of computers linked to this account
 * (lib/link/channel.ts, lib/auth/linkedDevices.ts). Each one is shown with what it is for,
 * and signed with this phone's wallet only after the person taps "Approve". Mounted in the
 * chat; it does nothing on a linked computer or on a phone that has linked none.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount, useSignMessage, useSignTypedData } from 'wagmi';
import { Laptop, Loader2, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { getPeers, getSelfLink, hasPeers, open as openSealed, removePeer, seal, SIGN_PURPOSE, type SignPayload } from '@/lib/link/channel';
import { isMobileDevice, openMobileWalletApp } from '@/lib/wallet/mobileWallet';

interface Pending { id: string; deviceId: string; deviceLabel: string; kind: 'xmtp' | 'aztec'; ciphertext: string; iv: string; createdAt: number }

const POLL_MS = 4_000;

export function LinkedDeviceApprover({ wallet }: { wallet?: string | null }) {
  const { address, isConnected, connector } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { signTypedDataAsync } = useSignTypedData();
  const [current, setCurrent] = useState<{ req: Pending; payload: SignPayload } | null>(null);
  const [busy, setBusy] = useState(false);
  const seen = useRef(new Set<string>());

  const me = (wallet || address || '').toLowerCase();
  // A linked computer never answers; this phone only if it linked one.
  const active = !!me && !getSelfLink() && hasPeers();

  useEffect(() => {
    if (!active) return;
    let stop = false;
    const tick = async () => {
      if (stop || document.visibilityState !== 'visible' || current) return;
      try {
        const r = await fetch('/api/auth/link?pending=1', { credentials: 'include', cache: 'no-store' });
        if (!r.ok) return;
        const { requests = [] } = (await r.json()) as { requests: Pending[] };
        const peers = getPeers();
        for (const req of requests) {
          if (seen.current.has(req.id)) continue;
          const peer = peers[req.deviceId];
          if (!peer) continue;
          seen.current.add(req.id);
          try {
            const payload = await openSealed<SignPayload>(peer.key, `req|${req.deviceId}|${req.kind}`, req.ciphertext, req.iv);
            if (payload.kind !== req.kind) throw new Error('kind mismatch');
            setCurrent({ req, payload });
            return;
          } catch {
            // Not sealed with this device's key: refuse it.
            await fetch('/api/auth/link', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'decline', id: req.id }) }).catch(() => {});
          }
        }
      } catch { /* offline: next tick */ }
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { stop = true; clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [active, current]);

  const post = (body: unknown) => fetch('/api/auth/link', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const decline = useCallback(async () => {
    if (!current) return;
    await post({ action: 'decline', id: current.req.id }).catch(() => {});
    setCurrent(null);
  }, [current]);

  const approve = useCallback(async () => {
    if (!current || busy) return;
    const { req, payload } = current;
    const peer = getPeers()[req.deviceId];
    if (!peer) { setCurrent(null); return; }
    if (!isConnected || !address || address.toLowerCase() !== me) {
      toast.error('Connect the wallet of this account on this phone to approve.');
      return;
    }
    setBusy(true);
    try {
      // Start the request, then open the wallet app from this tap (the only moment iOS allows it).
      const pending = payload.kind === 'xmtp'
        ? signMessageAsync({ message: payload.message })
        : signTypedDataAsync(payload.typedData as any);
      const injected = typeof window !== 'undefined' && !!(window as any).ethereum;
      if (isMobileDevice() && !injected) setTimeout(() => openMobileWalletApp(connector?.name), 150);
      const signature = await pending;
      const sealed = await seal(peer.key, `ans|${req.id}|${req.kind}`, { signature });
      const r = await post({ action: 'answer', id: req.id, ...sealed });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'The answer could not be sent.');
      toast.success(`Approved on ${req.deviceLabel}.`);
      setCurrent(null);
    } catch (e: any) {
      const m = String(e?.shortMessage || e?.message || '');
      toast.error(/reject|denied|cancel/i.test(m) ? 'You declined in your wallet.' : m || 'Could not sign.');
      if (/reject|denied|cancel/i.test(m)) await decline();
    } finally {
      setBusy(false);
    }
  }, [current, busy, isConnected, address, me, signMessageAsync, signTypedDataAsync, connector, decline]);

  if (!current) return null;
  const purpose = SIGN_PURPOSE[current.req.kind];
  return (
    <div className="fixed inset-0 z-[600] bg-[#15171c]/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" role="alertdialog" aria-modal="true" aria-labelledby="link-approve-title">
      <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#f2f4f7] flex items-center justify-center"><Laptop size={19} /></span>
          <button type="button" aria-label="Decline" onClick={decline} className="w-8 h-8 rounded-full hover:bg-[#f2f4f7] flex items-center justify-center"><X size={16} /></button>
        </div>
        <h2 id="link-approve-title" className="mt-3 text-[17px] font-semibold text-[#15171c]">{purpose.title}</h2>
        <p className="mt-1 text-[13px] text-[#4a505c]"><strong>{current.req.deviceLabel}</strong> · linked computer</p>
        <p className="mt-3 text-[14px] leading-[1.55] text-[#4a505c]">{purpose.body}</p>
        <p className="mt-3 text-[12px] text-[#727a88] flex items-center gap-1.5"><ShieldCheck size={13} /> Sent end-to-end encrypted. Not this computer? Decline and unlink it in Settings → Linked devices.</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={decline} disabled={busy} className="flex-1 h-11 rounded-xl border border-[#e4e7ec] text-[14px] hover:bg-[#f2f4f7]">Decline</button>
          <button type="button" onClick={approve} disabled={busy} className="flex-1 h-11 rounded-xl bg-[#15171c] text-white text-[14px] font-medium flex items-center justify-center gap-2">
            {busy && <Loader2 size={15} className="animate-spin" />} Approve
          </button>
        </div>
      </div>
    </div>
  );
}

/** Forget a computer on this phone after unlinking it. */
export function forgetPeer(deviceId: string) { removePeer(deviceId); }
