'use client';
/**
 * Honest progress for a transaction proven on this device: what is happening
 * and how long it has taken, never an invented percentage. The proof, its
 * witness and the private inputs stay in this browser.
 */
import React, { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';

const SLOW_AFTER_S = 90;

export function ProvingStatus({ label, startedAt, proving = true }: { label: string; startedAt: number; proving?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return (
    <div className="rounded-2xl bg-[#f2f4f7] p-3.5 space-y-1.5" role="status" aria-live="polite">
      <p className="flex items-center gap-2 text-[13.5px] text-[#15171c]">
        <LoaderCircle size={14} className="animate-spin shrink-0" aria-hidden="true" />
        <span className="flex-1">{label}</span>
        <span className="tabular-nums text-[#727a88]">{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</span>
      </p>
      <p className="text-[12.5px] text-[#727a88] leading-snug">
        {!proving
          ? 'Reading from the Aztec node. Nothing is sent.'
          : s < SLOW_AFTER_S
          ? 'The proof is made on this device; your private data does not leave it.'
          : 'This is taking longer than usual. The first proof on a device can take several minutes. Keep this tab open; if it fails, nothing is sent.'}
      </p>
    </div>
  );
}
