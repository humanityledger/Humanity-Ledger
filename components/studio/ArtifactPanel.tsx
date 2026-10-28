'use client';

/**
 * The artifact panel: preview, code, edit (saved as a new version), version
 * history with restore, copy and download.
 *
 * HTML and SVG previews run in a sandboxed iframe (no same-origin, so the
 * page cannot read Ledger Chat's storage or cookies; no popups, forms,
 * downloads or top navigation) with a CSP that blocks every network request.
 * Scripts stay off until the person turns them on, and a page that navigates
 * away is reloaded and flagged.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, Code2, Copy, Download, Eye, History, Pencil, Play, RotateCcw, ShieldAlert, X } from 'lucide-react';
import type { Artifact } from '@/lib/studio/artifacts';
import { fileNameFor, sandboxDocument } from '@/lib/studio/artifacts';
import { parseCsv } from '@/lib/studio/csv';
import type { StudioStrings } from '@/lib/studio/i18n';
import { StudioMarkdown } from './StudioMarkdown';
import { StudioMermaid } from './StudioMermaid';

const PREVIEWABLE = new Set(['html', 'svg', 'markdown', 'mermaid', 'csv', 'json']);

function mimeFor(a: Artifact): string {
  switch (a.type) {
    case 'html': return 'text/html';
    case 'svg': return 'image/svg+xml';
    case 'json': return 'application/json';
    case 'csv': return 'text/csv';
    case 'markdown': return 'text/markdown';
    default: return 'text/plain';
  }
}

export function ArtifactPanel({
  artifact, t, onClose, onSaveEdit, onRestore, streaming,
}: {
  artifact: Artifact;
  t: StudioStrings;
  onClose: () => void;
  onSaveEdit: (a: Artifact, content: string) => Promise<void>;
  onRestore: (a: Artifact, index: number) => Promise<void>;
  streaming: boolean;
}) {
  const latestIndex = artifact.versions.length - 1;
  const [versionIndex, setVersionIndex] = useState(latestIndex);
  const [view, setView] = useState<'preview' | 'code'>(PREVIEWABLE.has(artifact.type) ? 'preview' : 'code');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  // Scripts are off until the person turns them on for this artifact: a
  // script can navigate the preview to another site and carry data with it,
  // which no sandbox flag or CSP can prevent.
  const [runScripts, setRunScripts] = useState(false);
  const [navBlocked, setNavBlocked] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const loads = useRef(0);
  const frameId = `${frameKey}:${runScripts ? 1 : 0}`;

  // Follow new versions as they arrive.
  useEffect(() => { setVersionIndex(artifact.versions.length - 1); }, [artifact.id, artifact.versions.length]);
  useEffect(() => { setEditing(false); setView(PREVIEWABLE.has(artifact.type) ? 'preview' : 'code'); setRunScripts(false); setNavBlocked(false); }, [artifact.id, artifact.type]);

  const version = artifact.versions[Math.min(versionIndex, latestIndex)];
  const content = version?.content ?? '';
  const isLatest = versionIndex >= latestIndex;
  const srcDoc = useMemo(() => (artifact.type === 'html' || artifact.type === 'svg' ? sandboxDocument({ type: artifact.type, content }) : ''), [artifact.type, content]);
  // A new frame (new key) starts counting loads again; runs before its load event.
  useLayoutEffect(() => { loads.current = 0; }, [frameId, srcDoc]);
  const csv = useMemo(() => (artifact.type === 'csv' && view === 'preview' ? parseCsv(content) : []), [artifact.type, content, view]);
  const prettyJson = useMemo(() => {
    if (artifact.type !== 'json') return '';
    try { return JSON.stringify(JSON.parse(content), null, 2); } catch { return content; }
  }, [artifact.type, content]);

  const copy = () => navigator.clipboard?.writeText(content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  const download = () => {
    const blob = new Blob([content], { type: `${mimeFor(artifact)};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileNameFor(artifact); a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const btn = 'h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-[12.5px] text-[#4a505c] hover:bg-[#f2f4f7] hover:text-[#15171c] disabled:opacity-40 disabled:pointer-events-none';
  const tab = (on: boolean) => `h-7 px-2.5 rounded-md flex items-center gap-1.5 text-[12.5px] ${on ? 'bg-white text-[#15171c] shadow-sm' : 'text-[#727a88] hover:text-[#15171c]'}`;

  return (
    <section aria-label={artifact.title} className="flex flex-col h-full min-h-0 bg-white">
      <header className="flex items-center gap-2 px-3 h-12 border-b border-[#eceef2] shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold text-[#15171c] truncate">{artifact.title}</h2>
          <p className="text-[11.5px] text-[#727a88] truncate">
            {artifact.type === 'code' ? artifact.language : artifact.type} · {t.version} {versionIndex + 1}/{artifact.versions.length} · {version?.by === 'user' ? t.editedByYou : t.byStudio}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label={t.close} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#4a505c] hover:bg-[#f2f4f7]">
          <X size={17} />
        </button>
      </header>

      <div className="flex items-center gap-1 px-2 h-11 border-b border-[#eceef2] shrink-0 overflow-x-auto">
        {PREVIEWABLE.has(artifact.type) && !editing && (
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#eff1f4] mr-1">
            <button type="button" className={tab(view === 'preview')} onClick={() => setView('preview')}><Eye size={13} /> {t.preview}</button>
            <button type="button" className={tab(view === 'code')} onClick={() => setView('code')}><Code2 size={13} /> {t.code}</button>
          </div>
        )}
        <button type="button" className={btn} onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t.copied : t.copy}</button>
        <button type="button" className={btn} onClick={download}><Download size={14} /> {t.download}</button>
        <button type="button" className={btn} disabled={streaming || editing} onClick={() => { setDraft(content); setEditing(true); }}><Pencil size={14} /> {t.edit}</button>
        <div className="relative">
          <button type="button" className={btn} onClick={() => setShowVersions(v => !v)} aria-expanded={showVersions}><History size={14} /> {t.versions}</button>
          {showVersions && (
            <div className="absolute right-0 top-9 z-20 w-56 max-h-72 overflow-y-auto bg-white border border-[#e4e7ec] rounded-xl shadow-[0_16px_40px_-12px_rgba(16,24,40,0.28)] p-1">
              {artifact.versions.map((v, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setVersionIndex(i); setShowVersions(false); setEditing(false); }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-[12.5px] hover:bg-[#f2f4f7] ${i === versionIndex ? 'bg-[#f2f4f7]' : ''}`}
                >
                  <span className="font-medium text-[#15171c]">{t.version} {i + 1}</span>
                  <span className="block text-[11.5px] text-[#727a88]">{v.by === 'user' ? t.editedByYou : t.byStudio} · {new Date(v.createdAt).toLocaleString()}</span>
                </button>
              )).reverse()}
            </div>
          )}
        </div>
        {!isLatest && !editing && (
          <button type="button" className={btn} disabled={streaming} onClick={() => onRestore(artifact, versionIndex)}><RotateCcw size={14} /> {t.restore}</button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {editing ? (
          <div className="flex flex-col h-full">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              spellCheck={false}
              aria-label={t.edit}
              className="flex-1 min-h-[240px] w-full resize-none p-3 font-mono text-[12.5px] leading-[1.55] text-[#15171c] outline-none bg-[#fbfcfd]"
            />
            <div className="flex justify-end gap-2 p-2 border-t border-[#eceef2]">
              <button type="button" onClick={() => setEditing(false)} className="h-9 px-3 rounded-lg text-[13px] text-[#4a505c] hover:bg-[#f2f4f7]">{t.cancel}</button>
              <button
                type="button"
                disabled={draft === content}
                onClick={async () => { await onSaveEdit(artifact, draft); setEditing(false); }}
                className="h-9 px-3 rounded-lg text-[13px] font-medium bg-[#15171c] text-white disabled:opacity-40"
              >
                {t.saveVersion}
              </button>
            </div>
          </div>
        ) : view === 'code' || !PREVIEWABLE.has(artifact.type) ? (
          <pre className="p-3 text-[12.5px] leading-[1.55] font-mono text-[#15171c] whitespace-pre overflow-x-auto"><code>{artifact.type === 'json' ? prettyJson : content}</code></pre>
        ) : artifact.type === 'html' || artifact.type === 'svg' ? (
          <div className="flex flex-col h-full">
            {(navBlocked || !runScripts) && (
              <div className={`flex items-start gap-2 px-3 py-2 text-[12px] border-b ${navBlocked ? 'bg-[#fdf2f2] border-[#f3c5c7] text-[#a3242a]' : 'bg-[#f8f9fb] border-[#eceef2] text-[#4a505c]'}`}>
                <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                <span className="flex-1">{navBlocked ? t.navBlocked : t.scriptsOff}</span>
                {!runScripts && (
                  <button type="button" onClick={() => { setNavBlocked(false); setRunScripts(true); setFrameKey(k => k + 1); }} className="shrink-0 h-7 px-2.5 rounded-md bg-[#15171c] text-white flex items-center gap-1"><Play size={12} /> {t.runScripts}</button>
                )}
              </div>
            )}
            <iframe
              key={`${frameId}:${srcDoc.length}`}
              title={artifact.title}
              // No allow-same-origin, allow-popups, allow-forms, allow-top-navigation or allow-downloads.
              sandbox={runScripts ? 'allow-scripts' : ''}
              referrerPolicy="no-referrer"
              srcDoc={srcDoc}
              onLoad={() => {
                loads.current += 1;
                // A second load means the page navigated away from our document.
                if (loads.current > 1) { setNavBlocked(true); setRunScripts(false); setFrameKey(k => k + 1); }
              }}
              className="w-full flex-1 min-h-[320px] border-0 bg-white"
            />
          </div>
        ) : artifact.type === 'markdown' ? (
          <div className="p-4"><StudioMarkdown text={content} copyLabel={t.copy} copiedLabel={t.copied} /></div>
        ) : artifact.type === 'mermaid' ? (
          <StudioMermaid chart={content} title={artifact.title} />
        ) : artifact.type === 'csv' ? (
          <div className="p-3 overflow-auto">
            <table className="border-collapse text-[12.5px]">
              <tbody>
                {csv.map((r, i) => (
                  <tr key={i} className={i === 0 ? 'bg-[#f8f9fb] font-semibold' : ''}>
                    {r.map((c, j) => <td key={j} className="border border-[#e4e7ec] px-2 py-1 whitespace-nowrap">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <pre className="p-3 text-[12.5px] leading-[1.55] font-mono text-[#15171c] whitespace-pre overflow-x-auto"><code>{prettyJson}</code></pre>
        )}
      </div>
    </section>
  );
}
