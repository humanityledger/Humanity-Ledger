'use client';

/**
 * One ledger.record message. The key stays in the message, which the
 * conversation already encrypts. This card never prints it. A file is fetched
 * only from our attachment path, then checked and decrypted on this device.
 * A handoff opens the payment or the agreement in Ledger Chat. It does not
 * move money by itself.
 */
import React, { useState } from 'react';
import { FileText, Lock } from 'lucide-react';
import { openRecord, recordPreview, type RecordPointer } from '@/vendor/ledger-record/src/index';
import { requestValueHandoff } from '@/lib/chat/value-handoff';

export function RecordCard({
  pointer,
  members,
}: {
  pointer: RecordPointer;
  members: string[];
}) {
  const [text, setText] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [handoff, setHandoff] = useState<{ action: 'pay' | 'agreement'; peer: string } | null>(null);

  const open = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let cipher: Uint8Array | undefined;
      if (pointer.url) {
        const res = await fetch(pointer.url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('The sealed file is no longer available');
        cipher = new Uint8Array(await res.arrayBuffer());
      }
      const opened = await openRecord(pointer, members, cipher);
      if (opened.handoff) setHandoff(opened.handoff);
      else if (opened.text != null) setText(opened.text);
      else {
        const blob = new Blob([opened.plain as BlobPart], { type: 'application/octet-stream' });
        setFileUrl(URL.createObjectURL(blob));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The record could not be opened');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-[260px] max-w-full rounded-2xl bg-white border border-[#e6e8ec] px-3.5 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start gap-2.5">
        <span className="w-9 h-9 rounded-xl bg-[#f2f4f7] text-[#15171c] flex items-center justify-center shrink-0" aria-hidden="true">
          {pointer.kind === 'file' ? <FileText size={16} strokeWidth={1.8} /> : <Lock size={16} strokeWidth={1.8} />}
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold text-[#15171c] truncate">{recordPreview(pointer)}</span>
          <span className="block text-[12px] text-[#727a88] mt-0.5">Sealed record · version {pointer.generation}</span>
        </span>
      </div>
      {text != null && (
        <p className="mt-3 text-[14px] text-[#15171c] whitespace-pre-wrap break-words">{text}</p>
      )}
      {fileUrl && (
        <a href={fileUrl} download={pointer.label || 'record'} className="mt-3 inline-flex text-[13px] font-semibold text-[#15171c] underline underline-offset-2">
          Download
        </a>
      )}
      {handoff && (
        <button
          type="button"
          onClick={() => requestValueHandoff(handoff)}
          className="mt-3 h-9 px-3 rounded-xl bg-[#15171c] text-white text-[13px] font-semibold"
        >
          {handoff.action === 'pay' ? 'Open payment' : 'Open agreement'}
        </button>
      )}
      {error && <p className="mt-3 text-[12.5px] text-[#9a3412]">{error}</p>}
      {text == null && !fileUrl && !handoff && (
        <button
          type="button"
          onClick={() => { void open(); }}
          disabled={busy}
          className="mt-3 h-9 px-3 rounded-xl bg-[#15171c] text-white text-[13px] font-semibold disabled:opacity-50"
        >
          {busy ? 'Opening' : 'Open'}
        </button>
      )}
    </div>
  );
}
