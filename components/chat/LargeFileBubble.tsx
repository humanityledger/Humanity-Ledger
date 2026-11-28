'use client';

/**
 * components/chat/LargeFileBubble.tsx
 *
 * A file sent in encrypted pieces (lib/chat/large-file.ts). It is never opened inside the chat:
 * the person downloads it, each piece is checked and decrypted on this device, and the result goes
 * straight to a file they choose (Chrome and Edge) or to a download (other browsers). Nothing is
 * rendered from it, so a file that lies about its type cannot run here.
 */
import React from 'react';
import { Download, FileText, Lock, X } from 'lucide-react';
import { blobSink, diskSink, formatBytes, receiveLargeFile, type LargeFileMessage } from '@/lib/chat/large-file';
import { useT } from '@/lib/i18n/client';

const CARD = 'bg-white border border-[#e4e7ec] rounded-2xl';

export function LargeFileBubble({ file, isMe }: { file: LargeFileMessage; isMe: boolean }) {
  const t = useT();
  const [state, setState] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [done, setDone] = React.useState(0);
  const [error, setError] = React.useState('');
  const ctrl = React.useRef<AbortController | null>(null);
  const corner = isMe ? 'rounded-br-md' : 'rounded-bl-md';
  const pct = file.contentLength ? Math.floor((done / file.contentLength) * 100) : 0;

  const start = async () => {
    setError('');
    setDone(0);
    ctrl.current = new AbortController();
    let sink;
    try {
      sink = (await diskSink(file.filename)) ?? blobSink(file.mimeType);
    } catch {
      return; // the person closed the save dialog
    }
    setState('loading');
    try {
      const blob = await receiveLargeFile(file, sink, { signal: ctrl.current.signal, onProgress: (p) => setDone(p.done) });
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      setState('done');
    } catch (e) {
      setState('error');
      setError(e instanceof Error && e.message !== 'Cancelled' ? e.message : t("Download cancelled"));
    }
  };

  return (
    <div className={`${CARD} ${corner} w-[300px] max-w-full px-3.5 py-3`}>
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl lg-recessed text-[#15171c] flex items-center justify-center shrink-0" aria-hidden="true">
          <FileText size={18} strokeWidth={1.8} />
        </span>
        <span className="flex flex-col min-w-0 flex-1">
          <span className="text-[14.5px] font-medium text-[#15171c] truncate" title={file.filename}>{file.filename}</span>
          <span className="text-[13px] text-[#727a88] flex items-center gap-1">
            <Lock size={11} strokeWidth={2} aria-hidden="true" />
            {formatBytes(file.contentLength)}{t(", end-to-end encrypted")}
          </span>
        </span>
        {state === 'loading' ? (
          <button type="button" onClick={() => ctrl.current?.abort()} aria-label={t("Cancel download")} className="icon-btn w-10 h-10 rounded-full flex items-center justify-center text-[#4a505c] hover:bg-[#f2f4f7]">
            <X size={17} strokeWidth={1.9} />
          </button>
        ) : (
          <button type="button" onClick={() => void start()} aria-label={t("Download {filename}", { filename: file.filename })} className="icon-btn w-10 h-10 rounded-full flex items-center justify-center text-[#15171c] hover:bg-[#f2f4f7]">
            <Download size={17} strokeWidth={1.9} />
          </button>
        )}
      </div>
      {state === 'loading' && (
        <div className="mt-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t("Download progress")}>
          <div className="h-1 rounded-full bg-[#eef0f3] overflow-hidden">
            <div className="h-full bg-[#15171c] transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-[12px] text-[#727a88] tabular-nums">{t("Decrypting on this device, {formatBytes} of {formatBytes2}", { formatBytes: formatBytes(done), formatBytes2: formatBytes(file.contentLength) })}</p>
        </div>
      )}
      {state === 'done' && <p className="mt-2 text-[12px] text-[#0a7a55]">{t("Saved. Every piece was checked before it was decrypted.")}</p>}
      {state === 'error' && <p className="mt-2 text-[12px] text-[#b42318]" role="alert">{error}</p>}
    </div>
  );
}
