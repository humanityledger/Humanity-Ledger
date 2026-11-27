'use client';
/**
 * Settings → Storage and data → Memory. Live numbers from the MemoryObservatory
 * (lib/perf/memory-observatory.ts) and a one-tap "Hibernate private node": closes
 * the Aztec PXE and its encrypted stores, revokes cached media URLs and clears
 * bounded caches. Keys, notes and messages stay on disk; nobody is signed out.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Cpu } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/client';
import { memorySnapshot, type MemorySnapshot } from '@/lib/perf/memory-observatory';
import { trimMediaUrls } from '@/lib/core/MediaArena';
import { medianMs } from '@/lib/perf/client-timings';

export function MemoryDiagnostics() {
  const t = useT();
  const [snap, setSnap] = useState<MemorySnapshot | null>(null);
  const [nodeActive, setNodeActive] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setSnap(await memorySnapshot());
    try {
      const { peekPrivateWallet } = await import('@/lib/aztec/wallet/client');
      setNodeActive(peekPrivateWallet()?.isNodeActive() ?? false);
    } catch { setNodeActive(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const hibernate = async () => {
    setBusy(true);
    try {
      const { peekPrivateWallet } = await import('@/lib/aztec/wallet/client');
      const ok = (await peekPrivateWallet()?.hibernate()) ?? true;
      const urls = trimMediaUrls();
      if (ok) toast.success(t("Private node hibernated. {count} media URLs released.", { count: urls }));
      else toast.error(t("A payment or proof is running. Try again when it finishes."));
    } finally { setBusy(false); void refresh(); }
  };

  const last = snap?.proverRuns.at(-1);
  const row = (label: string, value: string) => (
    <div className="flex items-center justify-between py-2 border-b border-[#f0f1f4] last:border-0">
      <span className="text-[13px] text-[#4a505c]">{label}</span>
      <span className="text-[13px] font-semibold text-[#15171c] tabular-nums">{value}</span>
    </div>
  );
  return (
    <div className="bg-white rounded-2xl border border-[#e6e8ec] p-5 mb-6" aria-busy={!snap}>
      <div className="flex items-center gap-2 mb-2">
        <Cpu size={16} aria-hidden="true" />
        <p className="text-[12px] text-[#727a88] font-semibold">{t("Memory")}</p>
      </div>
      {row(t("JS heap"), snap?.jsHeapUsedMb != null ? `${snap.jsHeapUsedMb} MB` : t("Not reported by this browser"))}
      {row(t("Private node"), nodeActive == null ? '…' : nodeActive ? t("Active") : t("Hibernated (0 MB)"))}
      {row(t("Last proof"), last ? t("{s} s · {threads} threads · SRS 2^{srs}", { s: (last.ms / 1000).toFixed(1), threads: last.threads, srs: last.srsSize ? Math.round(Math.log2(last.srsSize)) : '?' }) : t("None yet"))}
      {row(t("Media URLs in memory"), String(snap?.liveBlobUrls ?? 0))}
      {(() => { const a = medianMs('attachment.encrypt+upload'), v = medianMs('voice.encrypt+upload'); return (a !== null || v !== null) ? row(t("Encrypt + upload (median)"), [a !== null ? t("files {ms} ms", { ms: a }) : '', v !== null ? t("voice {ms} ms", { ms: v }) : ''].filter(Boolean).join(' · ')) : null; })()}
      {(snap?.caches ?? []).filter(c => c.size > 0).slice(0, 6).map(c => row(c.name, `${c.size}/${c.capacity}${c.bytes != null ? ` · ${(c.bytes / 1024).toFixed(0)} KB` : ''}`))}
      <button
        type="button"
        onClick={hibernate}
        disabled={busy}
        className="mt-4 w-full min-h-[44px] rounded-xl bg-[#15171c] text-white text-[14px] font-semibold disabled:opacity-50"
      >
        {busy ? t("Working…") : t("Hibernate private node and trim memory")}
      </button>
      <p className="text-[12px] text-[#727a88] mt-2">{t("Keys, notes and messages stay on this device. The node reopens on your next private payment.")}</p>
    </div>
  );
}
