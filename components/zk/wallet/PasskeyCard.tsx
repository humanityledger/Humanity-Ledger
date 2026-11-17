'use client';

/**
 * components/zk/wallet/PasskeyCard.tsx — passkeys of the private wallet (lib/aztec/wallet/passkey.ts).
 *
 *   PasskeyOpen   on the closed wallet, when this account has a passkey: open without the
 *                 Ethereum wallet.
 *   PasskeyCard   on the open wallet: the enrolled passkeys, Add, Remove, and what a passkey can do.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Fingerprint, Trash2 } from 'lucide-react';
import { AZTEC_WALLET_CONFIG } from '@/lib/aztec/wallet/config';
import { humanError } from '@/lib/aztec/wallet/client';
import type { PasskeyRecord } from '@/lib/aztec/wallet/passkey';
import { Card, CardHead, Notice, SecondaryButton } from './WalletUI';

const INK = '#15171c';
const INK_3 = '#5b606b';
const network = AZTEC_WALLET_CONFIG.network as 'testnet' | 'mainnet';

function usePasskeyRecords(address: string) {
  const [records, setRecords] = useState<PasskeyRecord[] | null>(null);
  const reload = useCallback(async () => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return setRecords([]);
    const store = await import('@/lib/aztec/wallet/passkey-store');
    setRecords(await store.allRecords(address.toLowerCase(), network));
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
    </div>
  );
}

export function PasskeyCard({ address, onEnroll, disabled }: { address: string; onEnroll: (label: string) => Promise<{ backedUp: boolean }>; disabled?: boolean }) {
  const { records, reload } = usePasskeyRecords(address);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState('');

  const add = async () => {
    setBusy(true);
    try {
      const { backedUp } = await onEnroll(label || defaultLabel());
      setLabel('');
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
    const store = await import('@/lib/aztec/wallet/passkey-store');
    await store.removeRecord(r.evm, r.network, r.credentialId);
    await reload();
    toast.success('Passkey removed from this wallet. You can also delete it from your password manager.');
  };

  return (
    <Card label="Passkeys">
      <CardHead title="Passkeys" sub="Open this wallet with Face ID, Touch ID, Windows Hello or a security key." />
      <div className="px-5 pb-5">
        {records === null ? (
          <p className="text-[14px]" style={{ color: INK_3 }}>Loading…</p>
        ) : records.length === 0 ? (
          <p className="text-[14px] leading-relaxed" style={{ color: INK_3 }}>No passkey yet. Your Ethereum wallet opens this wallet.</p>
        ) : (
          <ul className="divide-y divide-[#e4e7ec] -mx-1" aria-label="Enrolled passkeys">
            {records.map((r) => (
              <li key={r.credentialId} className="flex items-center gap-3 py-3 px-1">
                <span className="w-9 h-9 rounded-full bg-[#f2f4f7] grid place-items-center shrink-0" aria-hidden="true">
                  <Fingerprint size={17} strokeWidth={2} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium truncate" style={{ color: INK }}>{r.label}</span>
                  <span className="block text-[13px]" style={{ color: INK_3 }}>Added {new Date(r.createdAt).toLocaleDateString()}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void remove(r)}
                  aria-label={`Remove ${r.label}`}
                  className="w-11 h-11 rounded-full grid place-items-center hover:bg-[#f7f8fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#15171c]"
                >
                  <Trash2 size={17} strokeWidth={2} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <label className="block mt-4 text-[13px] font-medium" style={{ color: INK_3 }} htmlFor="passkey-label">
          Name for the new passkey
        </label>
        <input
          id="passkey-label"
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, 60))}
          placeholder={defaultLabel()}
          className="mt-1.5 w-full h-12 px-4 rounded-2xl border border-[#e4e7ec] bg-white text-[16px] focus:outline-none focus:border-[#15171c]"
        />
        <div className="mt-3">
          <SecondaryButton disabled={disabled || busy || (records?.length ?? 0) >= 10} onClick={() => void add()}>
            {busy ? 'Waiting for your wallet and passkey' : 'Add a passkey'}
          </SecondaryButton>
        </div>
        <div className="mt-3">
          <Notice tone="warn">
            A passkey opens this wallet and can spend from it, like your Ethereum wallet. Your wallet signs once more to confirm the account. If you lose your Ethereum wallet, a
            passkey still opens the account; if you lose both, nobody can open it.
          </Notice>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: INK_3 }}>
          The passkey never leaves your device or password manager. What is saved here and in your backup is the account key encrypted by the passkey; our server cannot open it.
        </p>
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
