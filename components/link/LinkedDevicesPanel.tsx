'use client';

/**
 * Settings → Linked devices (WhatsApp / Signal model).
 *
 * On the phone (the device that signed in with the wallet): the computers linked to this
 * account, when each was linked and last active, "Link a device" (opens the scanner) and
 * "Unlink" (signs that computer out at once: its session token is revoked on the server).
 * On a linked computer: which phone it depends on, and "Unlink this computer".
 */

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Laptop, Loader2, QrCode, ShieldCheck, Smartphone, X } from 'lucide-react';
import { toast } from 'sonner';
import { clearSelfLink, removePeer } from '@/lib/link/channel';

const UniversalScanModal = dynamic(() => import('@/components/scan/UniversalScanModal'), { ssr: false });

interface Device { id: string; label: string; createdAt: number; lastSeenAt: number; expiresAt: number; current: boolean }

function when(ts: number) {
  const d = Date.now() - ts;
  if (d < 90_000) return 'just now';
  if (d < 3_600_000) return `${Math.round(d / 60_000)} min ago`;
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)} h ago`;
  return new Date(ts).toLocaleDateString();
}

export function LinkedDevicesPanel({ address, onClose }: { address?: string | null; onClose: () => void }) {
  const [data, setData] = useState<{ primary: boolean; devices: Device[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch('/api/auth/link?devices=1', { credentials: 'include', cache: 'no-store' });
      if (r.status === 401) { setError('Your session has ended. Sign in again.'); return; }
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setError('Linked devices could not be loaded. Check your connection.');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const unlink = useCallback(async (d: Device) => {
    setBusyId(d.id);
    try {
      const r = await fetch('/api/auth/link', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'revoke', id: d.id }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error);
      if (d.current) {
        clearSelfLink();
        window.location.replace('/connect');
        return;
      }
      removePeer(d.id);
      toast.success(`${d.label} was signed out.`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Could not unlink the device.');
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const primary = data?.primary ?? true;
  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[20px] font-semibold text-[#15171c]">Linked devices</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-[#f2f4f7] flex items-center justify-center shrink-0">
          <X size={16} className="text-[#727a88]" />
        </button>
      </div>
      <p className="text-[14px] text-[#727a88] mb-5 leading-relaxed">
        {primary
          ? 'Use Ledger Chat on a computer: open ledgerchat.org there and scan the code with this phone. Your wallet stays on this phone; the computer asks it for every signature.'
          : 'This computer is linked to Ledger Chat on your phone. Your wallet stays on the phone, which approves the signatures this computer needs.'}
      </p>

      {primary && (
        <button type="button" onClick={() => setScan(true)} className="w-full h-12 rounded-xl bg-[#15171c] text-white text-[15px] font-medium flex items-center justify-center gap-2 mb-5">
          <QrCode size={17} /> Link a device
        </button>
      )}

      {error && <p className="text-[13px] text-[#b42318] mb-3">{error}</p>}
      {!data && !error && <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[#727a88]" size={20} /></div>}

      {data && (
        <ul className="space-y-2 mb-4">
          {primary && (
            <li className="flex items-center gap-3 p-3 rounded-2xl bg-[#f7f8fa]">
              <Smartphone size={18} className="text-[#15171c]" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#15171c]">This phone</p>
                <p className="text-[12px] text-[#727a88] truncate">Holds your account{address ? ` · ${address.slice(0, 6)}…${address.slice(-4)}` : ''}</p>
              </div>
            </li>
          )}
          {data.devices.length === 0 && primary && <li className="text-[13px] text-[#727a88] px-1">No computers linked yet.</li>}
          {data.devices.map(d => (
            <li key={d.id} className="flex items-center gap-3 p-3 rounded-2xl border border-[#eceef2]">
              <Laptop size={18} className="text-[#15171c]" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#15171c] truncate">{d.label}{d.current ? ' · this computer' : ''}</p>
                <p className="text-[12px] text-[#727a88]">Linked {when(d.createdAt)} · active {when(d.lastSeenAt)}</p>
              </div>
              {(primary || d.current) && (
                <button type="button" onClick={() => unlink(d)} disabled={busyId === d.id} className="h-8 px-3 rounded-lg text-[13px] text-[#d93036] hover:bg-[#fdf2f2] disabled:opacity-50">
                  {busyId === d.id ? <Loader2 size={14} className="animate-spin" /> : d.current ? 'Unlink this computer' : 'Unlink'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[12px] text-[#727a88] flex items-start gap-1.5 leading-relaxed">
        <ShieldCheck size={14} className="shrink-0 mt-0.5" />
        Linking uses a one-time code encrypted end to end between the two devices. Unlinking signs the computer out immediately. A linked computer stays signed in for 7 days; scan again to renew it.
      </p>

      {primary && (
        <UniversalScanModal
          isOpen={scan}
          onClose={() => setScan(false)}
          address={address ?? ''}
          mode="session-only"
          onScan={() => { setScan(false); setTimeout(load, 1500); toast.success('Computer linked.'); }}
        />
      )}
    </div>
  );
}
