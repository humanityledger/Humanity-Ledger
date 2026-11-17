'use client';

/**
 * components/zk/wallet/PasskeyCard.tsx — passkeys of the private wallet (lib/aztec/wallet/passkey.ts).
 *
 *   PasskeyOpen        on the closed wallet, when this account has a passkey: open without the
 *                      Ethereum wallet.
 *   PasskeyCard        on the open wallet: the enrolled passkeys, Add (a short guided step),
 *                      Remove (confirmed inline), and what a passkey can and cannot do.
 *   usePasskeyRecords  the records of this account on this network (device first, then backup).
 */
import React, { useCallback, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { Fingerprint, KeyRound, Laptop, Smartphone, Trash2 } from 'lucide-react';
import { AZTEC_WALLET_CONFIG } from '@/lib/aztec/wallet/config';
import { humanError } from '@/lib/aztec/wallet/client';
import { MAX_PASSKEYS, type PasskeyRecord } from '@/lib/aztec/wallet/passkey';
import { Card, CardHead, FOCUS, INK, INK_2, INK_3, Notice, Pill, PrimaryButton, SecondaryButton, TextButton } from './WalletUI';

const network = AZTEC_WALLET_CONFIG.network as 'testnet' | 'mainnet';

export function usePasskeyRecords(address: string) {
  const [records, setRecords] = useState<PasskeyRecord[] | null>(null);
  const reload = useCallback(async () => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return setRecords([]);
    try {
      const store = await import('@/lib/aztec/wallet/passkey-store');
      setRecords(await store.allRecords(address.toLowerCase(), network));
    } catch {
      setRecords([]);
    }
  }, [address]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { records, reload };
}

function passkeyMessage(err: unknown): string {
  const e = err as any;
  if (e?.name === 'PasskeyError') return e.code === 'CANCELLED' ? '' : String(e.message);
  return humanError(err);
}

function DeviceIcon({ label }: { label: string }) {
  const l = label.toLowerCase();
  const Icon = /iphone|android|phone|pixel|galaxy/.test(l) ? Smartphone : /mac|windows|laptop|pc|linux/.test(l) ? Laptop : /key|yubi|titan/.test(l) ? KeyRound : Fingerprint;
  return (
    <span className="w-10 h-10 rounded-full bg-[#f2f4f7] border border-[#eceef2] grid place-items-center shrink-0" aria-hidden="true">
      <Icon size={18} strokeWidth={1.9} style={{ color: INK }} />
    </span>
  );
}

export function PasskeyOpen({ address, onOpen, disabled }: { address: string; onOpen: () => Promise<void>; disabled?: boolean }) {
  const { records } = usePasskeyRecords(address);
  const [busy, setBusy] = useState(false);
  if (!records?.length) return null;
  return (
    <div className="mt-3">
      <SecondaryButton
        disabled={disabled || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onOpen();
            toast.success('Private wallet open');
          } catch (err) {
            const m = passkeyMessage(err);
            if (m) toast.error(m);
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="inline-flex items-center gap-2">
          <Fingerprint size={18} strokeWidth={2} aria-hidden="true" />
          {busy ? 'Waiting for your passkey' : 'Open with a passkey'}
        </span>
      </SecondaryButton>
      <p className="mt-2 text-center text-[12.5px]" style={{ color: INK_3 }}>
        {records.length === 1 ? 'One passkey' : `${records.length} passkeys`} can open this account without your Ethereum wallet.
      </p>
    </div>
  );
}

export function PasskeyCard({ address, onEnroll, disabled }: { address: string; onEnroll: (label: string) => Promise<{ backedUp: boolean }>; disabled?: boolean }) {
  const { records, reload } = usePasskeyRecords(address);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const inputId = useId();
  const count = records?.length ?? 0;
  const full = count >= MAX_PASSKEYS;

  const add = async () => {
    setBusy(true);
    try {
      const { backedUp } = await onEnroll(label.trim() || defaultLabel());
      setLabel('');
      setAdding(false);
      await reload();
      toast.success(backedUp ? 'Passkey added' : 'Passkey added on this device. The backup could not be saved; add it again later to use it elsewhere.');
    } catch (err) {
      const m = passkeyMessage(err);
      if (m) toast.error(m);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: PasskeyRecord) => {
    setBusy(true);
    try {
      const store = await import('@/lib/aztec/wallet/passkey-store');
      await store.removeRecord(r.evm, r.network, r.credentialId);
      await reload();
      toast.success('Passkey removed. You can also delete it from your password manager.');
    } catch (err) {
      toast.error(humanError(err));
    } finally {
      setConfirming(null);
      setBusy(false);
    }
  };

  return (
    <Card label="Passkeys">
      <CardHead
        title="Passkeys"
        sub="Open this wallet with Face ID, Touch ID, Windows Hello or a security key."
        action={records ? <Pill tone={count ? 'ok' : 'neutral'}>{`${count} of ${MAX_PASSKEYS}`}</Pill> : undefined}
      />
      <div className="px-5 pb-5">
        {records === null ? (
          <div className="mt-2 h-[60px] rounded-2xl bg-[#f7f8fa] animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Loading passkeys" />
        ) : count === 0 ? (
          <div className="mt-2 rounded-2xl border border-dashed border-[#d0d5dd] px-4 py-4 flex items-center gap-3">
            <DeviceIcon label="passkey" />
            <p className="text-[14px] leading-snug" style={{ color: INK_2 }}>
              No passkey yet. Only your Ethereum wallet opens this account. A passkey gives you a second way in.
            </p>
          </div>
        ) : (
          <ul className="mt-1 -mx-1" aria-label="Enrolled passkeys">
            {records.map((r) => (
              <li key={r.credentialId} className="px-1 py-3 border-t border-[#eef0f3] first:border-t-0">
                {confirming === r.credentialId ? (
                  <div className="flex items-center gap-3" role="group" aria-label={`Remove ${r.label}?`}>
                    <span className="flex-1 min-w-0 text-[14px] leading-snug" style={{ color: INK }}>
                      Remove <span className="font-semibold">{r.label}</span>? It will no longer open this wallet.
                    </span>
                    <TextButton onClick={() => setConfirming(null)} disabled={busy}>Cancel</TextButton>
                    <button
                      type="button"
                      onClick={() => void remove(r)}
                      disabled={busy}
                      className={`min-h-[40px] px-3 rounded-full text-[14px] font-semibold text-white bg-[#b42318] hover:bg-[#962018] disabled:opacity-40 ${FOCUS}`}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <DeviceIcon label={r.label} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-semibold truncate" style={{ color: INK }}>{r.label}</span>
                      <span className="block text-[13px]" style={{ color: INK_3 }}>
                        Added {new Date(r.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirming(r.credentialId)}
                      aria-label={`Remove ${r.label}`}
                      className={`w-11 h-11 rounded-full grid place-items-center hover:bg-[#f7f8fa] ${FOCUS}`}
                    >
                      <Trash2 size={17} strokeWidth={1.9} style={{ color: INK_2 }} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {adding ? (
          <div className="mt-4 rounded-2xl border border-[#e4e7ec] bg-[#f7f8fa] p-4">
            <label className="block text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: INK_3 }} htmlFor={inputId}>
              Name
            </label>
            <input
              id={inputId}
              value={label}
              onChange={(e) => setLabel(e.target.value.slice(0, 60))}
              placeholder={defaultLabel()}
              autoComplete="off"
              className="mt-1.5 w-full h-12 px-4 rounded-2xl border border-[#e4e7ec] bg-white text-[16px] focus:outline-none focus:border-[#15171c]"
              style={{ color: INK }}
            />
            <ol className="mt-3 space-y-1.5 text-[13.5px] leading-snug" style={{ color: INK_2 }}>
              <li className="flex gap-2"><span className="font-semibold tabular-nums" style={{ color: INK }}>1</span>Your Ethereum wallet signs once more, to confirm it is this account.</li>
              <li className="flex gap-2"><span className="font-semibold tabular-nums" style={{ color: INK }}>2</span>Your device asks for Face ID, Touch ID, your PIN or your security key.</li>
            </ol>
            <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
              <button
                type="button"
                onClick={() => setAdding(false)}
                disabled={busy}
                className={`min-h-[52px] px-5 rounded-2xl text-[16px] font-semibold border border-[#e4e7ec] bg-white hover:bg-[#f2f4f7] disabled:opacity-40 ${FOCUS}`}
                style={{ color: INK }}
              >
                Cancel
              </button>
              <PrimaryButton onClick={() => void add()} busy={busy} disabled={disabled}>
                {busy ? 'Waiting for your wallet' : 'Add passkey'}
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <SecondaryButton disabled={disabled || busy || full || records === null} onClick={() => setAdding(true)}>
              {full ? `At most ${MAX_PASSKEYS} passkeys` : 'Add a passkey'}
            </SecondaryButton>
          </div>
        )}

        <div className="mt-4">
          <Notice tone="warn">
            A passkey can open this wallet and spend from it, exactly like your Ethereum wallet. Add passkeys only on devices you control.
          </Notice>
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-[13px] leading-snug" style={{ color: INK_3 }}>
          <div>
            <dt className="inline font-semibold" style={{ color: INK_2 }}>Where it lives. </dt>
            <dd className="inline">The passkey stays in your device or password manager. Ledger Chat keeps only the account key encrypted by it, and cannot open that.</dd>
          </div>
          <div>
            <dt className="inline font-semibold" style={{ color: INK_2 }}>Recovery. </dt>
            <dd className="inline">Lose your Ethereum wallet and a passkey still opens the account. Lose both and nobody can open it, Ledger Chat included.</dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}

function defaultLabel() {
  if (typeof navigator === 'undefined') return 'Passkey';
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return 'iPhone passkey';
  if (/Mac/.test(ua)) return 'Mac passkey';
  if (/Android/.test(ua)) return 'Android passkey';
  if (/Windows/.test(ua)) return 'Windows passkey';
  return 'Passkey';
}
