'use client';

/**
 * components/chat/settings/HistoryBackupSheet.tsx — export and restore the chat history of this
 * device as a file sealed with a passphrase only the person knows (lib/backup/encrypted-archive.ts).
 *
 * Nothing is uploaded. The file contains the messages and conversations this browser keeps
 * (lib/chat/indexeddb.ts); keys and sessions are not in it. Restoring merges: it never deletes.
 */

import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { openArchive, passphraseProblem, sealArchive } from '@/lib/backup/encrypted-archive';
import { restoreChatHistory, snapshotChatHistory, type ChatHistorySnapshot } from '@/lib/chat/indexeddb';

const FIELD = 'w-full h-12 rounded-xl border border-[#d0d5dd] px-4 text-[15px] text-[#15171c] outline-none focus:border-[#15171c]';
const PRIMARY = 'w-full h-12 rounded-xl bg-[#15171c] text-white font-semibold text-[15px] disabled:opacity-50';
const SECONDARY = 'w-full h-12 rounded-xl border border-[#d0d5dd] bg-white text-[#15171c] font-semibold text-[15px] disabled:opacity-50';

export function HistoryBackupSheet({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'export' | 'restore'>('export');
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const weak = mode === 'export' && pass ? passphraseProblem(pass) : null;
  const mismatch = mode === 'export' && confirm && confirm !== pass ? 'The two passphrases differ.' : null;

  const doExport = async () => {
    setBusy(true);
    setError(null);
    try {
      const snap = await snapshotChatHistory();
      const sealed = await sealArchive(snap, pass);
      const blob = new Blob([JSON.stringify(sealed)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ledger-chat-history-${new Date().toISOString().slice(0, 10)}.lcarchive`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      toast.success(`Exported ${snap.messages.length} messages, encrypted`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('Choose the archive file first.'); return; }
    setBusy(true);
    setError(null);
    try {
      const sealed = JSON.parse(await file.text());
      const snap = await openArchive<ChatHistorySnapshot>(sealed, pass);
      const n = await restoreChatHistory(snap);
      toast.success(`Restored ${n.messages} messages in ${n.conversations} conversations`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-6 pb-6" data-testid="history-backup">
      <h3 className="text-[20px] font-semibold text-[#15171c] mb-1">Chat history backup</h3>
      <p className="text-[14px] text-[#5b606b] leading-relaxed mb-4">
        A file sealed with a passphrase you choose. It never leaves your device unless you move it. We cannot open it, and we cannot recover a forgotten passphrase.
      </p>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#f2f4f7] p-1 mb-4" role="tablist">
        {(['export', 'restore'] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); }} className={`h-9 rounded-lg text-[14px] font-semibold ${mode === m ? 'bg-white text-[#15171c] shadow-sm' : 'text-[#5b606b]'}`}>
            {m === 'export' ? 'Export' : 'Restore'}
          </button>
        ))}
      </div>
      {mode === 'restore' && (
        <input ref={fileRef} type="file" accept=".lcarchive,application/json" className="mb-3 block w-full text-[14px] text-[#3d424b]" aria-label="Archive file" />
      )}
      <label className="block text-[12px] font-semibold uppercase tracking-[0.1em] text-[#5b606b] mb-1.5" htmlFor="hist-pass">Passphrase</label>
      <input id="hist-pass" type="password" autoComplete={mode === 'export' ? 'new-password' : 'current-password'} value={pass} onChange={(e) => setPass(e.target.value)} className={FIELD} />
      {mode === 'export' && (
        <>
          <label className="block mt-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-[#5b606b] mb-1.5" htmlFor="hist-pass2">Repeat it</label>
          <input id="hist-pass2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={FIELD} />
        </>
      )}
      {(weak || mismatch || error) && <p role="alert" className="mt-2 text-[13px] text-[#b42318]">{error || weak || mismatch}</p>}
      <div className="mt-5 grid gap-2">
        {mode === 'export' ? (
          <button type="button" className={PRIMARY} disabled={busy || !!weak || !pass || confirm !== pass} onClick={doExport}>{busy ? 'Encrypting…' : 'Export encrypted file'}</button>
        ) : (
          <button type="button" className={PRIMARY} disabled={busy || !pass} onClick={doRestore}>{busy ? 'Opening…' : 'Restore into this device'}</button>
        )}
        <button type="button" className={SECONDARY} onClick={onClose}>Cancel</button>
      </div>
      <p className="mt-4 text-[12.5px] leading-relaxed text-[#5b606b]">Keys and sessions are never in the file. Restoring adds messages; it never deletes any.</p>
    </div>
  );
}
