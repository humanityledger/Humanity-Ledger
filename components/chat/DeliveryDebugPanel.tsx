'use client';
/**
 * /chat?debug=delivery: the delivery events of this browser (lib/xmtp/diag.ts), live, with a
 * button that copies them for a report. Shows only this device's own events, with ids shortened
 * and no message content. Nothing is sent anywhere.
 */
import React, { useEffect, useState } from 'react';
import { diagEvents, diagText, onDiag, type DiagEvent } from '@/lib/xmtp/diag';

export default function DeliveryDebugPanel() {
  const [events, setEvents] = useState<DiagEvent[]>(() => diagEvents());
  const [copied, setCopied] = useState(false);
  useEffect(() => onDiag(() => setEvents(diagEvents())), []);
  const last = events.slice(-60).reverse();
  const copy = () => {
    navigator.clipboard?.writeText(diagText()).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }).catch(() => undefined);
  };
  return (
    <aside
      aria-label="Delivery diagnostics"
      className="fixed z-[3000] bottom-3 right-3 w-[min(560px,calc(100vw-24px))] max-h-[45vh] flex flex-col rounded-[20px] border border-[#e4e7ec] bg-white shadow-[0_18px_40px_-20px_rgba(16,24,40,0.35)] text-[12px] text-[#15171c]"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#e4e7ec]">
        <b>Delivery diagnostics · {events.length} events</b>
        <button type="button" onClick={copy} className="h-8 px-3 rounded-full border border-[#e4e7ec] font-semibold">
          {copied ? 'Copied' : 'Copy all'}
        </button>
      </div>
      <ol className="overflow-y-auto px-4 py-2 font-mono leading-[1.5]">
        {last.map((e, i) => (
          <li key={`${e.t}-${i}`}>
            <span className="text-[#667085]">{new Date(e.t).toISOString().slice(11, 19)}</span>{' '}
            <b className={e.kind.includes('fail') || e.kind === 'drop' || e.kind.includes('error') ? 'text-[#ff3b30]' : ''}>{e.kind}</b>{' '}
            {e.detail ? JSON.stringify(e.detail) : ''}
          </li>
        ))}
        {last.length === 0 && <li className="text-[#667085]">No events yet. Keep this open and send or wait for a message.</li>}
      </ol>
    </aside>
  );
}
