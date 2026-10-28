'use client';

/**
 * The Code mode workspace: the project's files on this device. A file tree,
 * an editor, a diff against the version before Studio's latest change, a
 * safe preview for web pages, and import/export (files, folders, ZIP, GitHub).
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, ChevronRight, Code2, Download, Eye, File as FileIcon, FileDiff, FilePlus2, Folder, FolderUp, Github, Pencil, Play,
  Search, ShieldAlert, Trash2, Upload, X, FileArchive, MoreHorizontal, FileSearch, Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { StudioApi } from '../useStudio';
import type { WsFile } from '@/lib/studio/fs';
import { sandboxDocument } from '@/lib/studio/artifacts';
import { chatChanges, downloadBlob, inlineWorkspaceAssets, mimeForPath, searchWorkspace } from '@/lib/studio/ws-client';
import { StudioMarkdown } from '../StudioMarkdown';
import { DiffView } from './CodeCards';
import { GitHubPanel } from './GitHubPanel';

const LINE_PX = 12.5 * 1.55;

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

export function WorkspacePanel({ api, onClose, focusPath, onFocused, openGithub }: {
  api: StudioApi;
  onClose: () => void;
  focusPath?: string | null;
  onFocused?: () => void;
  /** Open with the GitHub import showing. */
  openGithub?: boolean;
}) {
  const { t, wsFiles, streaming, checkpoints, active } = api;
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<'code' | 'preview' | 'diff'>('code');
  const [draft, setDraft] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [github, setGithub] = useState(!!openGithub);
  useEffect(() => { if (openGithub) setGithub(true); }, [openGithub]);
  /** Left column: the file tree, or what this chat changed. */
  const [side, setSide] = useState<'files' | 'changes'>('files');
  /** Search inside files instead of by name. */
  const [inContent, setInContent] = useState(false);
  const [jump, setJump] = useState<{ path: string; line: number } | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);
  const gutterRef = useRef<HTMLPreElement>(null);
  // A new file starts at the top: reset the line-number offset with it.
  useEffect(() => { if (gutterRef.current) gutterRef.current.style.transform = ''; }, [selected]);

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

  // The file as it was before Studio's most recent change to it (or, from
  // the Changes list, before this chat first changed it).
  const baseline = useMemo(() => {
    if (!selected) return undefined;
    const order = side === 'changes' ? checkpoints : [...checkpoints].reverse();
    for (const cp of order) {
      const b = cp.before;
      if (selected in b) return b[selected] ? (b[selected]!.encoding === 'base64' ? '[binary]' : b[selected]!.content) : null;
    }
    return undefined;
  }, [selected, checkpoints, side]);

  const changes = useMemo(() => chatChanges(checkpoints, byPath), [checkpoints, byPath]);
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q && !inContent ? wsFiles.filter(f => f.path.toLowerCase().includes(q)) : wsFiles;
  }, [wsFiles, filter, inContent]);
  const found = useMemo(() => (inContent && filter.trim().length >= 2 ? searchWorkspace(wsFiles, filter.trim()) : null), [inContent, filter, wsFiles]);

  // Opening a search result: put the caret on that line and scroll to it.
  useEffect(() => {
    if (!jump || jump.path !== selected || view !== 'code') return;
    const el = editorRef.current;
    const f = byPath.get(jump.path);
    if (!el || !f || f.encoding === 'base64') return;
    const lines = (draft ?? f.content).split('\n');
    let pos = 0;
    for (let i = 0; i < Math.min(jump.line - 1, lines.length); i++) pos += lines[i].length + 1;
    el.focus({ preventScroll: true });
    el.setSelectionRange(pos, pos + (lines[jump.line - 1]?.length ?? 0));
    el.scrollTop = Math.max(0, (jump.line - 1) * LINE_PX - el.clientHeight / 3);
    setJump(null);
  }, [jump, selected, view, byPath, draft]);
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

      {/* No overflow clipping here: the "more" menu opens below the bar. Labels hide on phones. */}
      <div className="flex items-center gap-1 px-2 h-11 border-b border-[#eceef2] shrink-0">
        <button type="button" className={btn} disabled={readOnly} onClick={newFile} title={t.wsNewFile} aria-label={t.wsNewFile}><FilePlus2 size={14} /><span className="hidden sm:inline">{t.wsNewFile}</span></button>
        <button type="button" className={btn} disabled={readOnly} onClick={() => fileInput.current?.click()} title={t.wsUploadFiles} aria-label={t.wsUploadFiles}><Upload size={14} /><span className="hidden sm:inline">{t.wsUploadFiles}</span></button>
        <button type="button" className={btn} disabled={readOnly} onClick={() => folderInput.current?.click()} title={t.wsUploadFolder} aria-label={t.wsUploadFolder}><FolderUp size={14} /><span className="hidden sm:inline">{t.wsUploadFolder}</span></button>
        <button type="button" className={`${btn} ${github ? 'bg-[#f2f4f7] text-[#15171c]' : ''}`} disabled={readOnly} onClick={() => setGithub(g => !g)} aria-expanded={github} title={t.github}><Github size={14} /><span className="hidden sm:inline">{t.github}</span></button>
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
          <div className="px-2 pt-2 shrink-0">
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#eff1f4]" role="tablist">
              <button type="button" role="tab" aria-selected={side === 'files'} className={`${tab(side === 'files')} flex-1 justify-center icon-btn`} onClick={() => setSide('files')}><FileIcon size={13} /> {t.files}</button>
              <button type="button" role="tab" aria-selected={side === 'changes'} className={`${tab(side === 'changes')} flex-1 justify-center icon-btn`} onClick={() => setSide('changes')}>
                <FileDiff size={13} /> {t.changesTab}{changes.length > 0 && <span className="tabular-nums text-[11px] px-1.5 rounded-full bg-[#2456d6] text-white leading-4">{changes.length}</span>}
              </button>
            </div>
          </div>
          {side === 'files' ? (
            <>
              <div className="relative p-2 shrink-0">
                <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a3a9b4]" />
                <input value={filter} onChange={e => setFilter(e.target.value)} placeholder={inContent ? t.searchContent : t.wsFilter} aria-label={inContent ? t.searchContent : t.wsFilter}
                  className="w-full h-8 pl-7 pr-9 rounded-lg border border-[#e4e7ec] text-[12.5px] outline-none focus:border-[#98a2b3]" />
                <button type="button" aria-pressed={inContent} onClick={() => setInContent(v => !v)} title={inContent ? t.searchNames : t.searchContent} aria-label={inContent ? t.searchNames : t.searchContent}
                  className={`icon-btn absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center ${inContent ? 'bg-[#15171c] text-white' : 'text-[#727a88] hover:bg-[#f2f4f7]'}`}>
                  <FileSearch size={13} />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-1 pb-2"
                onDragOver={e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); }}
                onDrop={async e => { e.preventDefault(); e.stopPropagation(); if (!readOnly && e.dataTransfer?.files?.length) report(await api.wsImportPicked(e.dataTransfer.files)); }}>
                {wsFiles.length === 0 ? <p className="px-3 py-4 text-[12.5px] leading-[1.5] text-[#727a88]">{t.wsEmpty}</p>
                  : found ? (
                    <div>
                      <p className="px-2 py-1 text-[11.5px] text-[#727a88] tabular-nums">{found.hits.length} {t.searchMatches} · {found.files} {t.searchInFiles}{found.truncated ? ` · ${t.searchTruncated}` : ''}</p>
                      <ul>
                        {found.hits.map((h, i) => {
                          const first = i === 0 || found.hits[i - 1].path !== h.path;
                          return (
                            <li key={`${h.path}:${h.line}`}>
                              {first && <p className="px-2 pt-2 pb-0.5 font-mono text-[11.5px] text-[#15171c] truncate" title={h.path}>{h.path}</p>}
                              <button type="button" onClick={() => { setSelected(h.path); setDraft(null); setView('code'); setJump({ path: h.path, line: h.line }); }}
                                className="w-full flex items-baseline gap-2 px-2 py-1 rounded-md text-left hover:bg-[#eef0f3]">
                                <span className="font-mono text-[11px] text-[#a3a9b4] tabular-nums shrink-0 w-8 text-right">{h.line}</span>
                                <span className="font-mono text-[11.5px] text-[#4a505c] truncate">{h.text}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : <ul>{renderNodes(tree, 0)}</ul>}
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto px-1 py-2">
              {changes.length === 0 ? <p className="px-3 py-4 text-[12.5px] leading-[1.5] text-[#727a88]">{t.changesNone}</p> : (
                <ul className="space-y-0.5">
                  {changes.map(c => (
                    <li key={c.path} className="group flex items-center gap-1 rounded-md hover:bg-[#eef0f3] pr-1">
                      <button type="button" disabled={c.op === 'delete'} onClick={() => { setSelected(c.path); setDraft(null); setView('diff'); }}
                        className={`flex-1 min-w-0 flex items-center gap-1.5 h-8 pl-2 text-left text-[12.5px] ${selected === c.path ? 'font-medium text-[#15171c]' : 'text-[#2b2f36]'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.op === 'create' ? 'bg-[#12805c]' : c.op === 'delete' ? 'bg-[#d93036]' : 'bg-[#2456d6]'}`} />
                        <span className={`truncate font-mono text-[12px] ${c.op === 'delete' ? 'line-through text-[#727a88]' : ''}`} title={c.path}>{c.path}</span>
                        {c.op !== 'update' && <span className="text-[10.5px] text-[#727a88] shrink-0">{c.op === 'create' ? t.changeNew : t.changeDeleted}</span>}
                        <span className="ml-auto pl-1 shrink-0 font-mono text-[11px] tabular-nums"><span className="text-[#12805c]">+{c.added}</span> <span className="text-[#d93036]">−{c.removed}</span></span>
                      </button>
                      <button type="button" disabled={readOnly} title={t.revertFile} aria-label={`${t.revertFile} ${c.path}`}
                        onClick={async () => { if (!window.confirm(`${t.revertConfirm}\n\n${c.path}`)) return; if (await api.revertFile(c.path)) toast.success(t.reverted); }}
                        className="icon-btn w-7 h-7 rounded-md flex items-center justify-center text-[#4a505c] hover:bg-white hover:text-[#15171c] disabled:opacity-40 shrink-0">
                        <Undo2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* File */}
        {file && (
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {/* Row 1: which file and its actions. Row 2: how to look at it. */}
            <div className="flex items-center gap-1 pl-2 pr-1 h-10 border-b border-[#f0f1f4] shrink-0 min-w-0">
              <button type="button" className="md:hidden icon-btn w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#f2f4f7] shrink-0" onClick={() => setSelected(null)} aria-label={t.back}><ChevronRight size={15} className="rotate-180" /></button>
              <span className="font-mono text-[12px] text-[#15171c] truncate min-w-0 flex-1" title={file.path} dir="rtl"><bdi>{file.path}</bdi></span>
              {isText && <span className="hidden sm:inline text-[11.5px] text-[#a3a9b4] tabular-nums shrink-0 mr-1">{file.content.split('\n').length} {t.wsLines}</span>}
              <button type="button" className={`${btn} shrink-0`} disabled={readOnly} onClick={rename} aria-label={t.wsRename} title={t.wsRename}><Pencil size={14} /></button>
              <button type="button" className={`${btn} shrink-0`} onClick={downloadOne} aria-label={t.wsDownload} title={t.wsDownload}><Download size={14} /></button>
              <button type="button" className={`${btn} shrink-0 hover:text-[#d93036]`} disabled={readOnly} onClick={() => { if (window.confirm(t.wsDeleteConfirm)) api.wsDeleteFile(file.path); }} aria-label={t.delete} title={t.delete}><Trash2 size={14} /></button>
            </div>
            {isText && (
              <div className="flex items-center px-2 h-10 border-b border-[#eceef2] shrink-0">
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#eff1f4]" role="tablist">
                  <button type="button" role="tab" aria-selected={view === 'code'} className={tab(view === 'code')} onClick={() => setView('code')}><Code2 size={13} /> {t.wsCode}</button>
                  {kind && <button type="button" role="tab" aria-selected={view === 'preview'} className={tab(view === 'preview')} onClick={() => setView('preview')}><Eye size={13} /> {t.wsPreview}</button>}
                  <button type="button" role="tab" aria-selected={view === 'diff'} className={tab(view === 'diff')} onClick={() => setView('diff')}>
                    <FileDiff size={13} /> {t.wsDiff}{baseline !== undefined && <span className="w-1.5 h-1.5 rounded-full bg-[#2456d6]" />}
                  </button>
                </div>
              </div>
            )}
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
                  <div className="flex-1 min-h-[280px] flex bg-[#fbfcfd] overflow-hidden">
                  {/* Line numbers, scrolled together with the editor. */}
                  <div aria-hidden className="shrink-0 select-none overflow-hidden border-r border-[#eef0f3] bg-[#f7f8fa]">
                    <pre ref={gutterRef} className="py-3 pl-3 pr-2 font-mono text-[12.5px] leading-[1.55] text-right text-[#b4b9c2] tabular-nums">
                      {Array.from({ length: Math.max(1, (draft ?? file.content).split('\n').length) }, (_, i) => i + 1).join('\n')}
                    </pre>
                  </div>
                  <textarea
                    ref={editorRef}
                    value={draft ?? file.content}
                    onScroll={e => { if (gutterRef.current) gutterRef.current.style.transform = `translateY(${-e.currentTarget.scrollTop}px)`; }}
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
                    className="flex-1 min-w-0 h-full resize-none py-3 px-3 font-mono text-[12.5px] leading-[1.55] text-[#15171c] outline-none focus-visible:outline-none bg-transparent whitespace-pre"
                  />
                  </div>
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
