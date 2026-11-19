'use client';

/**
 * One ledger.record message. Version 2 does not carry the content key.
 * Opening uses a key stored on this device, or the MLS exporter secret of
 * the epoch named on the record. If neither is available, it stops.
 * Version 1 still opens, and the card says that its key sits in the message.
 */
import React, { useState } from 'react';
import { FileText, Lock } from 'lucide-react';
import {
  legacyPreview,
  openLegacyRecord,
  openRecord,
  parseLegacyMessage,
  parseRecordMessage,
  recordPreview,
  wipeRecordKeys,
  type OpenedRecord,
} from '@/vendor/ledger-record/src/index';
import { requestValueHandoff } from '@/lib/chat/value-handoff';
import { requestRecordEpoch } from '@/lib/chat/record-epoch';
import { recallRecordKey, rememberRecordKey } from '@/lib/chat/record-keys';

const SEAL_BUBBLES = 12;

export function RecordCard({ message, members, arrive = false }: { message: string; members: string[]; arrive?: boolean }) {
  const modern = parseRecordMessage(message);
  const legacy = modern ? null : parseLegacyMessage(message);
  const label = modern ? recordPreview(modern) : legacy ? legacyPreview(legacy) : 'Sealed note';
  const generation = modern?.generation ?? legacy?.generation ?? 1;
  const kind = modern?.kind ?? legacy?.kind ?? 'note';

  const [text, setText] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [handoff, setHandoff] = useState<{ action: 'pay' | 'agreement'; peer: string } | null>(null);

  const show = (opened: { text: string | null; plain: Uint8Array; handoff: { action: 'pay' | 'agreement'; peer: string } | null }) => {
    if (opened.handoff) setHandoff({ action: opened.handoff.action, peer: opened.handoff.peer });
    else if (opened.text != null) setText(opened.text);
    else {
      const blob = new Blob([opened.plain as BlobPart], { type: 'application/octet-stream' });
      setFileUrl(URL.createObjectURL(blob));
    }
  };

  const open = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (legacy) {
        let cipher: Uint8Array | undefined;
        if (legacy.url) {
          const res = await fetch(legacy.url, { credentials: 'same-origin' });
          if (!res.ok) throw new Error('The sealed file is no longer available');
          cipher = new Uint8Array(await res.arrayBuffer());
        }
        const opened = await openLegacyRecord(legacy, members, cipher);
        show(opened);
        return;
      }
      if (!modern) throw new Error('This record is not a format this chat can open');
      const cached = await recallRecordKey(modern.id, modern.generation);
      const epoch = cached ? null : await requestRecordEpoch();
      let cipher: Uint8Array | undefined;
      if (modern.url) {
        const res = await fetch(modern.url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('The sealed file is no longer available');
        cipher = new Uint8Array(await res.arrayBuffer());
      }
      let opened: OpenedRecord;
      try {
        opened = await openRecord(modern, members, epoch, cipher, cached);
      } finally {
        wipeRecordKeys(cached);
      }
      try {
        await rememberRecordKey(modern.id, modern.generation, opened.contentKey);
      } finally {
        wipeRecordKeys(opened.contentKey);
      }
      show(opened);
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
      if (code === 'locked') {
        setError('This device is locked. Unlock it to open the record. Other people in the chat are not affected.');
      } else if (code === 'passphrase' || code === 'passkey') {
        setError('That passphrase or passkey did not open the record.');
      } else if (code === 'epoch' || code === 'unwrap') {
        setError('This record cannot be opened on this device. It belongs to an earlier epoch, and no local key is stored.');
      } else {
        setError(err instanceof Error ? err.message : 'The record could not be opened');
      }
    } finally {
      setBusy(false);
    }
  };

  const glass = kind === 'note';
  const [play, setPlay] = useState(arrive && glass);
  return (
    <div
      className={`w-[260px] max-w-full rounded-2xl border border-[#e6e8ec] px-3.5 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${glass ? 'bg-white/70' : 'bg-white'} ${play ? 'hl-seal-arrive' : ''}`}
      onAnimationEnd={play ? (e) => { if (e.target === e.currentTarget) setPlay(false); } : undefined}
    >
      {play && Array.from({ length: SEAL_BUBBLES }, (_, n) => <i key={n} aria-hidden="true" />)}
      <div className="flex items-start gap-2.5">
        <span className="w-9 h-9 rounded-xl bg-[#f2f4f7] text-[#15171c] flex items-center justify-center shrink-0" aria-hidden="true">
          {kind === 'file' ? <FileText size={16} strokeWidth={1.8} /> : <Lock size={16} strokeWidth={1.8} />}
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold text-[#15171c] truncate">{label}</span>
          <span className="block text-[12px] text-[#727a88] mt-0.5">
            {legacy ? 'Sealed in this encrypted chat' : `Sealed record · version ${generation}`}
          </span>
        </span>
      </div>
      {text != null && <p className="mt-3 text-[14px] text-[#15171c] whitespace-pre-wrap break-words">{text}</p>}
      {fileUrl && (
        <a href={fileUrl} download={label || 'record'} className="mt-3 inline-flex text-[13px] font-semibold text-[#15171c] underline underline-offset-2">
          Download
        </a>
      )}
      {handoff && (
        <button type="button" onClick={() => requestValueHandoff(handoff)} className="mt-3 h-9 px-3 rounded-xl bg-[#15171c] text-white text-[13px] font-semibold">
          {handoff.action === 'pay' ? 'Open payment' : 'Open agreement'}
        </button>
      )}
      {error && <p className="mt-3 text-[12.5px] text-[#9a3412]">{error}</p>}
      {text == null && !fileUrl && !handoff && (
        <button type="button" onClick={() => { void open(); }} disabled={busy} className="mt-3 h-9 px-3 rounded-xl bg-[#15171c] text-white text-[13px] font-semibold disabled:opacity-50">
          {busy ? 'Opening' : 'Open'}
        </button>
      )}
    </div>
  );
}
