'use client';

/**
 * The Code mode workspace: the project's files on this device. A file tree,
 * an editor, a diff against the version before Studio's latest change, a
 * safe preview for web pages, and import/export (files, folders, ZIP, GitHub).
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, ChevronRight, Code2, Download, Eye, File as FileIcon, FileDiff, FilePlus2, Folder, FolderUp, Github, Pencil, Play,
  Search, ShieldAlert, Trash2, Upload, X, FileArchive, MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import type { StudioApi } from '../useStudio';
import type { WsFile } from '@/lib/studio/fs';
import { sandboxDocument } from '@/lib/studio/artifacts';
import { downloadBlob, inlineWorkspaceAssets, mimeForPath } from '@/lib/studio/ws-client';
import { StudioMarkdown } from '../StudioMarkdown';
import { DiffView } from './CodeCards';
import { GitHubPanel } from './GitHubPanel';

interface TreeNode { name: string; path: string; children?: TreeNode[]; file?: WsFile }

function buildTree(files: WsFile[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', children: [] };
  for (const f of files) {
    const parts = f.path.split('/');
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const path = parts.slice(0, i + 1).join('/');
      if (i === parts.length - 1) { node.children!.push({ name, path, file: f }); break; }
      let next = node.children!.find(c => c.children && c.name === name);
      if (!next) { next = { name, path, children: [] }; node.children!.push(next); }
      node = next;
    }
  }
  const sort = (n: TreeNode) => {
    n.children?.sort((a, b) => (Number(!!b.children) - Number(!!a.children)) || a.name.localeCompare(b.name));
    n.children?.forEach(sort);
  };
  sort(root);
  return root.children!;
}

const IMAGE_RE = /\.(png|jpe?g|gif|webp|ico)$/i;
const previewKind = (p: string) => (/\.html?$/i.test(p) ? 'html' : /\.svg$/i.test(p) ? 'svg' : /\.(md|markdown)$/i.test(p) ? 'markdown' : null);

function SafePreview({ html, title, t }: { html: string; title: string; t: StudioApi['t'] }) {
  const [runScripts, setRunScripts] = useState(false);
  const [navBlocked, setNavBlocked] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const loads = useRef(0);
  useLayoutEffect(() => { loads.current = 0; }, [frameKey, runScripts, html]);
  return (
    <div className="flex flex-col h-full min-h-[320px]">
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
        key={`${frameKey}:${runScripts ? 1 : 0}:${html.length}`}
        title={title}
        sandbox={runScripts ? 'allow-scripts' : ''}
        referrerPolicy="no-referrer"
        srcDoc={html}
        onLoad={() => {
          loads.current += 1;
          if (loads.current > 1) { setNavBlocked(true); setRunScripts(false); setFrameKey(k => k + 1); }
        }}
        className="w-full flex-1 border-0 bg-white"
      />
    </div>
  );
}

export function WorkspacePanel({ api, onClose, focusPath, onFocused }: {
  api: StudioApi;
  onClose: () => void;
  focusPath?: string | null;
  onFocused?: () => void;
}) {
  const { t, wsFiles, streaming, checkpoints, active } = api;
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<'code' | 'preview' | 'diff'>('code');
  const [draft, setDraft] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [github, setGithub] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);

  const byPath = useMemo(() => new Map(wsFiles.map(f => [f.path, f])), [wsFiles]);
  const file = selected ? byPath.get(selected) ?? null : null;
  const isText = !!file && file.encoding !== 'base64';
  const kind = file ? previewKind(file.path) : null;

  useEffect(() => {
    if (focusPath && byPath.has(focusPath)) { setSelected(focusPath); setDraft(null); setView('diff'); onFocused?.(); }
  }, [focusPath, byPath, onFocused]);
  useEffect(() => { if (selected && !byPath.has(selected)) { setSelected(null); setDraft(null); } }, [selected, byPath]);
  // folderInput needs the non-standard attribute set on the element.
  useEffect(() => { folderInput.current?.setAttribute('webkitdirectory', ''); folderInput.current?.setAttribute('directory', ''); }, []);

  // The file as it was before Studio's most recent change to it.
  const baseline = useMemo(() => {
    if (!selected) return undefined;
    for (let i = checkpoints.length - 1; i >= 0; i--) {
      const b = checkpoints[i].before;
      if (selected in b) return b[selected] ? (b[selected]!.encoding === 'base64' ? '[binary]' : b[selected]!.content) : null;
    }
    return undefined;
  }, [selected, checkpoints]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? wsFiles.filter(f => f.path.toLowerCase().includes(q)) : wsFiles;
  }, [wsFiles, filter]);
  const tree = useMemo(() => buildTree(filtered), [filtered]);
  const previewHtml = useMemo(() => {
    if (!file || !isText || view !== 'preview' || (kind !== 'html' && kind !== 'svg')) return '';
    const content = kind === 'html' ? inlineWorkspaceAssets(file.content, file.path, byPath) : file.content;
    return sandboxDocument({ type: kind, content });
  }, [file, isText, view, kind, byPath]);

  const report = (r: { added: number; skipped: number }) => {
    if (r.added || r.skipped) toast.success(`${t.wsAdded}: ${r.added}${r.skipped ? ` · ${r.skipped} ${t.wsSkipped}` : ''}`);
    if (!r.added && r.skipped) toast.error(t.wsTooLarge);
  };
  const open = (p: string) => { setSelected(p); setDraft(null); setView(previewKind(p) === 'markdown' ? 'preview' : 'code'); };
  const newFile = async () => {
    const p = window.prompt(t.wsNewFilePrompt)?.trim();
    if (!p) return;
    const err = await api.wsSaveFile(p, '');
    if (err) toast.error(err); else { open(p.replace(/^\.?\/+/, '')); setDraft(''); }
  };
  const save = async () => {
    if (!file || draft === null) return;
    const err = await api.wsSaveFile(file.path, draft);
    if (err) toast.error(err); else { setDraft(null); toast.success(t.wsSaved); }
  };
  const rename = async () => {
    if (!file) return;
    const to = window.prompt(t.wsRenamePrompt, file.path)?.trim();
    if (!to || to === file.path) return;
    const err = await api.wsRenameFile(file.path, to);
    if (err) toast.error(err); else setSelected(to);
  };
  const downloadOne = () => {
    if (!file) return;
    if (file.encoding === 'base64') {
      const bin = atob(file.content);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      downloadBlob(u8, file.path.split('/').pop() || 'file', mimeForPath(file.path));
    } else downloadBlob(file.content, file.path.split('/').pop() || 'file.txt', 'text/plain;charset=utf-8');
  };

  const renderNodes = (nodes: TreeNode[], depth: number): React.ReactNode => nodes.map(n => n.children ? (
    <li key={`d:${n.path}`}>
      <button type="button" onClick={() => setCollapsed(c => ({ ...c, [n.path]: !c[n.path] }))} className="w-full h-7 flex items-center gap-1 rounded-md text-left text-[12.5px] text-[#2b2f36] hover:bg-[#eef0f3]" style={{ paddingLeft: 6 + depth * 12 }}>
        {collapsed[n.path] ? <ChevronRight size={13} /> : <ChevronDown size={13} />}<Folder size={13} className="text-[#727a88]" /><span className="truncate">{n.name}</span>
      </button>
      {!collapsed[n.path] && <ul>{renderNodes(n.children, depth + 1)}</ul>}
    </li>
  ) : (
    <li key={n.path}>
      <button type="button" onClick={() => open(n.path)} className={`w-full h-7 flex items-center gap-1.5 rounded-md text-left text-[12.5px] ${selected === n.path ? 'bg-[#e4e8ef] text-[#15171c] font-medium' : 'text-[#2b2f36] hover:bg-[#eef0f3]'}`} style={{ paddingLeft: 22 + depth * 12 }}>
        <FileIcon size={13} className="text-[#a3a9b4] shrink-0" /><span className="truncate">{n.name}</span>
      </button>
    </li>
  ));

  const btn = 'h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-[12.5px] text-[#4a505c] hover:bg-[#f2f4f7] hover:text-[#15171c] disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap';
  const tab = (on: boolean) => `h-7 px-2.5 rounded-md flex items-center gap-1.5 text-[12.5px] ${on ? 'bg-white text-[#15171c] shadow-sm' : 'text-[#727a88] hover:text-[#15171c]'}`;
  const readOnly = streaming;

  return (
    <section aria-label={t.wsTitle} className="flex flex-col h-full min-h-0 bg-white">
      <header className="flex items-center gap-2 px-3 h-12 border-b border-[#eceef2] shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold text-[#15171c] truncate">{t.wsTitle}</h2>
          <p className="text-[11.5px] text-[#727a88] truncate">{wsFiles.length} {t.files.toLowerCase()}{active?.projectId ? ` · ${t.wsShared}` : ''}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t.close} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#4a505c] hover:bg-[#f2f4f7]"><X size={17} /></button>
      </header>

      <div className="flex items-center gap-1 px-2 h-11 border-b border-[#eceef2] shrink-0 overflow-x-auto">
        <button type="button" className={btn} disabled={readOnly} onClick={newFile}><FilePlus2 size={14} /> {t.wsNewFile}</button>
        <button type="button" className={btn} disabled={readOnly} onClick={() => fileInput.current?.click()}><Upload size={14} /> {t.wsUploadFiles}</button>
        <button type="button" className={btn} disabled={readOnly} onClick={() => folderInput.current?.click()}><FolderUp size={14} /> {t.wsUploadFolder}</button>
        <button type="button" className={btn} disabled={readOnly} onClick={() => setGithub(g => !g)} aria-expanded={github}><Github size={14} /> {t.github}</button>
        <div className="relative ml-auto">
          <button type="button" className={btn} onClick={() => setMenu(m => !m)} aria-expanded={menu} aria-label={t.settings}><MoreHorizontal size={15} /></button>
          {menu && (
            <div className="absolute right-0 top-9 z-30 w-52 bg-white border border-[#e4e7ec] rounded-xl shadow-[0_16px_40px_-12px_rgba(16,24,40,0.28)] p-1" role="menu" onClick={() => setMenu(false)}>
              <button role="menuitem" type="button" disabled={readOnly} className="w-full flex items-center gap-2 px-2.5 h-9 rounded-lg text-[13px] hover:bg-[#f2f4f7] disabled:opacity-40" onClick={() => zipInput.current?.click()}><FileArchive size={14} /> {t.wsImportZip}</button>
              <button role="menuitem" type="button" disabled={!wsFiles.length} className="w-full flex items-center gap-2 px-2.5 h-9 rounded-lg text-[13px] hover:bg-[#f2f4f7] disabled:opacity-40" onClick={() => api.wsExportZip(active?.title ?? 'workspace')}><Download size={14} /> {t.wsExportZip}</button>
              <button role="menuitem" type="button" disabled={readOnly || !wsFiles.length} className="w-full flex items-center gap-2 px-2.5 h-9 rounded-lg text-[13px] text-[#d93036] hover:bg-[#fdf2f2] disabled:opacity-40" onClick={() => { if (window.confirm(t.wsClearConfirm)) api.wsClear(); }}><Trash2 size={14} /> {t.wsClear}</button>
            </div>
          )}
        </div>
        <input ref={fileInput} type="file" multiple className="hidden" onChange={async e => { if (e.target.files?.length) report(await api.wsImportPicked(e.target.files)); e.target.value = ''; }} />
        <input ref={folderInput} type="file" multiple className="hidden" onChange={async e => { if (e.target.files?.length) report(await api.wsImportPicked(e.target.files)); e.target.value = ''; }} />
        <input ref={zipInput} type="file" accept=".zip,application/zip" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) { try { report(await api.wsImportZip(f)); } catch { toast.error(t.error); } } e.target.value = ''; }} />
      </div>

      {github && <GitHubPanel api={api} onDone={() => setGithub(false)} />}

      <div className="flex-1 min-h-0 flex">
        {/* Tree */}
        <div className={`${file ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[230px] md:shrink-0 md:border-r border-[#eceef2] min-h-0`}>
          <label className="relative block p-2 shrink-0">
            <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a3a9b4]" />
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder={t.wsFilter} aria-label={t.wsFilter} className="w-full h-8 pl-7 pr-2 rounded-lg border border-[#e4e7ec] text-[12.5px] outline-none focus:border-[#98a2b3]" />
          </label>
          <div className="flex-1 min-h-0 overflow-y-auto px-1 pb-2"
            onDragOver={e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); }}
            onDrop={async e => { e.preventDefault(); e.stopPropagation(); if (!readOnly && e.dataTransfer?.files?.length) report(await api.wsImportPicked(e.dataTransfer.files)); }}>
            {wsFiles.length === 0 ? <p className="px-3 py-4 text-[12.5px] leading-[1.5] text-[#727a88]">{t.wsEmpty}</p> : <ul>{renderNodes(tree, 0)}</ul>}
          </div>
        </div>

        {/* File */}
        {file && (
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            <div className="flex items-center gap-1 px-2 h-10 border-b border-[#eceef2] shrink-0 overflow-x-auto">
              <button type="button" className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#f2f4f7]" onClick={() => setSelected(null)} aria-label={t.back}><ChevronRight size={15} className="rotate-180" /></button>
              <span className="font-mono text-[12px] text-[#15171c] truncate min-w-0 flex-1" title={file.path}>{file.path}</span>
              {isText && (
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#eff1f4] shrink-0">
                  <button type="button" className={tab(view === 'code')} onClick={() => setView('code')}><Code2 size={13} /> {t.wsCode}</button>
                  {kind && <button type="button" className={tab(view === 'preview')} onClick={() => setView('preview')}><Eye size={13} /> {t.wsPreview}</button>}
                  <button type="button" className={tab(view === 'diff')} onClick={() => setView('diff')}><FileDiff size={13} /> {t.wsDiff}</button>
                </div>
              )}
              <button type="button" className={btn} disabled={readOnly} onClick={rename} aria-label={t.wsRename} title={t.wsRename}><Pencil size={14} /></button>
              <button type="button" className={btn} onClick={downloadOne} aria-label={t.wsDownload} title={t.wsDownload}><Download size={14} /></button>
              <button type="button" className={btn} disabled={readOnly} onClick={() => { if (window.confirm(t.wsDeleteConfirm)) api.wsDeleteFile(file.path); }} aria-label={t.delete} title={t.delete}><Trash2 size={14} /></button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              {!isText ? (
                IMAGE_RE.test(file.path)
                  ? <div className="p-4 flex justify-center"><img src={`data:${mimeForPath(file.path)};base64,${file.content}`} alt={file.path} className="max-w-full max-h-[60vh] object-contain" /></div>
                  : <p className="p-4 text-[13px] text-[#727a88]">{t.wsBinary} · {Math.round(file.size / 1024)} KB</p>
              ) : view === 'preview' && kind === 'markdown' ? (
                <div className="p-4"><StudioMarkdown text={file.content} copyLabel={t.copy} copiedLabel={t.copied} /></div>
              ) : view === 'preview' && kind ? (
                <SafePreview html={previewHtml} title={file.path} t={t} />
              ) : view === 'diff' ? (
                baseline === undefined ? <p className="p-4 text-[13px] text-[#727a88]">{t.wsNoChanges}</p> : <DiffView before={baseline} after={file.content} maxLines={4000} />
              ) : (
                <div className="flex flex-col h-full">
                  {readOnly && <p className="px-3 py-1.5 text-[11.5px] text-[#727a88] bg-[#f8f9fb] border-b border-[#eceef2]">{t.wsReadOnly}</p>}
                  <textarea
                    value={draft ?? file.content}
                    onChange={e => setDraft(e.target.value)}
                    readOnly={readOnly}
                    spellCheck={false}
                    wrap="off"
                    aria-label={file.path}
                    onKeyDown={e => {
                      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
                      if (e.key === 'Tab' && !e.shiftKey && !readOnly) {
                        e.preventDefault();
                        const el = e.currentTarget;
                        const s = el.selectionStart, en = el.selectionEnd, v = draft ?? file.content;
                        const next = `${v.slice(0, s)}  ${v.slice(en)}`;
                        setDraft(next);
                        requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; });
                      }
                    }}
                    className="flex-1 min-h-[280px] w-full resize-none p-3 font-mono text-[12.5px] leading-[1.55] text-[#15171c] outline-none bg-[#fbfcfd] whitespace-pre"
                  />
                  {draft !== null && draft !== file.content && (
                    <div className="flex items-center justify-end gap-2 p-2 border-t border-[#eceef2]">
                      <span className="mr-auto text-[12px] text-[#7a5200]">{t.wsUnsaved}</span>
                      <button type="button" onClick={() => setDraft(null)} className="h-8 px-3 rounded-lg text-[12.5px] text-[#4a505c] hover:bg-[#f2f4f7]">{t.wsDiscard}</button>
                      <button type="button" onClick={save} disabled={readOnly} className="h-8 px-3 rounded-lg text-[12.5px] font-medium bg-[#15171c] text-white disabled:opacity-40">{t.wsSave}</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
