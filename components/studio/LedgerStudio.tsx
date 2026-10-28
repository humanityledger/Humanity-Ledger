'use client';

/**
 * Ledger Studio: an AI workspace inside Ledger Chat.
 *
 * Chats, projects (instructions + knowledge files + skills), artifacts with
 * preview/edit/versions, web search and page reading with sources, remote
 * MCP connectors, personalization, language, usage and plan.
 *
 * Studio is deliberately separate from encrypted chats: nothing from a
 * Ledger Chat conversation reaches Studio unless the person sends it here.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowUp, Check, ChevronDown, Code2, FileText, FolderOpen, Globe, Image as ImageIcon, Loader2,
  Menu, MoreHorizontal, Paperclip, Pencil, Pin, PinOff, Plug, Plus, Search, Settings, Sparkles, Square, Trash2, X, BookOpen, FolderPlus, Shapes,
  SquareTerminal, MessageSquare, Files, ShieldCheck, Gauge, Box, History, Undo2, ListTodo, Github, Download, Clock3, AtSign,
} from 'lucide-react';
import { mentionAtCaret, mentionedPaths, rankPaths } from '@/lib/studio/ws-client';
import { toast } from 'sonner';
import { useStudio, type PendingAttachment } from './useStudio';
import { StudioMarkdown } from './StudioMarkdown';
import { ArtifactPanel } from './ArtifactPanel';
import { StudioSettings, type SettingsTab } from './StudioSettings';
import { ProjectEditor } from './ProjectEditor';
import { WorkspacePanel } from './code/WorkspacePanel';
import { ApprovalCard, FileChangeList, PlanCard, QuestionCard, ReasoningBlock, SubagentList, TodoList } from './code/CodeCards';
import type { Conversation, DisplayMessage, PendingInteraction, Project, ToolActivity } from '@/lib/studio/store';
import type { Artifact } from '@/lib/studio/artifacts';
import type { WsFile } from '@/lib/studio/fs';
import type { Effort, PermissionMode, ResumeResult } from '@/lib/studio/protocol';
import { searchStudio } from '@/lib/studio/search';
import { PLAN_EFFORTS, STUDIO_MODELS, STUDIO_PLANS, planAllowsModel, type StudioModelId } from '@/lib/studio/models';
import { skillsById } from '@/lib/studio/skills';
import type { StudioStrings } from '@/lib/studio/i18n';
import { COMPACT_PROMPT, INIT_PROMPT, matchCommands, modelFromArg, parseCommand, REVIEW_PROMPT, type BuiltinCommandId } from '@/lib/studio/commands';

export interface LedgerStudioProps {
  wallet: string;
  /** Leave Studio (back to Ledger Chat). */
  onExit?: () => void;
  /** Text to place in the composer when Studio opens (never sent automatically). */
  initialPrompt?: string;
}

function relTime(ts: number, lang: 'es' | 'en'): string {
  const d = Date.now() - ts;
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  if (d < 60_000) return rtf.format(0, 'second');
  if (d < 3_600_000) return rtf.format(-Math.round(d / 60_000), 'minute');
  if (d < 86_400_000) return rtf.format(-Math.round(d / 3_600_000), 'hour');
  if (d < 30 * 86_400_000) return rtf.format(-Math.round(d / 86_400_000), 'day');
  return new Date(ts).toLocaleDateString(lang);
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

const NO_RETRY = new Set(['NOT_CONFIGURED', 'ABORTED', 'NO_SESSION', 'TOO_LARGE', 'CONTEXT_TOO_LARGE', 'PROVIDER_AUTH', 'OVER_BUDGET', 'RATE_LIMITED']);

/** Known errors are shown in the interface language; others use the server's text. */
function errorText(e: { code: string; message: string }, t: StudioStrings): string {
  switch (e.code) {
    case 'LIMIT_REACHED': return t.limitReached;
    case 'NOT_CONFIGURED': return t.notConfigured;
    case 'NO_SESSION': return t.sessionExpired;
    case 'FREE_CAPACITY': return t.errFreeCapacity;
    case 'METERING_UNAVAILABLE': return t.errMetering;
    case 'CONTEXT_TOO_LARGE': return t.errContext;
    case 'BUSY': return t.errBusy;
    case 'PLAN_REQUIRED': return t.errPlan;
    case 'TOO_LARGE': return t.errTooLarge;
    case 'OVER_BUDGET': return t.errOverBudget;
    case 'RATE_LIMITED': return t.errRateLimited;
    case 'PROVIDER_BUSY': case 'PROVIDER_OVERLOADED': case 'PROVIDER_ERROR': case 'PROVIDER_SETUP': case 'NETWORK': return t.errProvider;
    default: return e.message || t.error;
  }
}

function noticeText(code: NonNullable<DisplayMessage['notice']>, t: StudioStrings): string {
  switch (code) {
    case 'MAX_TOKENS': return t.noticeMaxTokens;
    case 'REFUSAL': return t.noticeRefusal;
    case 'BUDGET': return t.noticeBudget;
    case 'TIME_LIMIT': return t.noticeTime;
    case 'STEP_LIMIT': return t.noticeSteps;
    case 'SYNC_FAILED': return t.noticeSyncFailed;
  }
}

const EFFORT_LABEL = (t: StudioStrings): Record<Effort | 'auto', string> => ({
  auto: t.effortAuto, low: t.effortLow, medium: t.effortMedium, high: t.effortHigh, xhigh: t.effortXhigh, max: t.effortMax,
});
const PERMISSION_LABEL = (t: StudioStrings): Record<PermissionMode, string> => ({ plan: t.permPlan, ask: t.permAsk, auto: t.permAuto });
const LABEL_TEXT = (t: StudioStrings, label: string) =>
  label === 'continue' ? t.labelContinue : label === 'compact' ? t.labelCompact : label === 'init' ? t.labelInit : label === 'review' ? t.labelReview : `${t.labelCommand} /${label}`;

function ToolRow({ tool, t }: { tool: ToolActivity; t: StudioStrings }) {
  const icon = tool.status === 'running' ? <Loader2 size={13} className="animate-spin" />
    : tool.status === 'error' ? <AlertTriangle size={13} className="text-[#d93036]" /> : <Check size={13} className="text-[#12805c]" />;
  let label: string;
  switch (tool.name) {
    case 'web_search': label = `${t.searching}${tool.detail ? `: “${tool.detail}”` : ''}`; break;
    case 'web_fetch': label = `${t.reading}${tool.detail ? `: ${hostOf(tool.detail)}` : ''}`; break;
    case 'artifact': label = tool.status === 'running' ? t.thinkingArtifact : `${t.artifacts}: ${tool.detail ?? ''}`; break;
    case 'read_file': label = `${t.toolRead} ${tool.detail ?? ''}`; break;
    case 'write_file': label = `${t.toolWrite} ${tool.detail ?? ''}`; break;
    case 'edit_file': label = `${t.toolEdit} ${tool.detail ?? ''}`; break;
    case 'delete_file': label = `${t.toolDelete} ${tool.detail ?? ''}`; break;
    case 'move_file': label = `${t.toolMove} ${tool.detail ?? ''}`; break;
    case 'list_files': label = `${t.toolList}${tool.detail ? `: ${tool.detail}` : ''}`; break;
    case 'grep': label = `${t.toolGrep}${tool.detail ? `: “${tool.detail}”` : ''}`; break;
    case 'task': label = `${t.toolTask}${tool.detail ? `: ${tool.detail}` : ''}`; break;
    case 'sync_sandbox': label = t.toolSync; break;
    case 'bash_code_execution': case 'code_execution': label = `${t.toolRun}${tool.detail ? `: ${tool.detail}` : ''}`; break;
    case 'text_editor_code_execution': label = `${t.toolEditor}${tool.detail ? `: ${tool.detail}` : ''}`; break;
    default: label = `${t.usingTool} ${tool.server ? `${tool.server} · ` : ''}${tool.name}`;
  }
  const mono = /_file$|^grep$|^list_files$|code_execution$/.test(tool.name);
  return (
    <div className="flex items-center gap-2 text-[12.5px] text-[#4a505c] min-w-0">
      <span className="shrink-0">{icon}</span>
      <span className={`truncate ${mono ? 'font-mono text-[12px]' : ''}`}>{label}</span>
    </div>
  );
}

/** Tool activity of one answer; long Code mode runs show the latest steps first. */
function ToolList({ tools, t }: { tools: ToolActivity[]; t: StudioStrings }) {
  const [all, setAll] = useState(false);
  const LIMIT = 6;
  const hidden = all ? 0 : Math.max(0, tools.length - LIMIT);
  return (
    <div className="mb-2 flex flex-col gap-1 p-2.5 rounded-xl bg-[#f8f9fb] border border-[#eceef2]">
      {hidden > 0 && (
        <button type="button" onClick={() => setAll(true)} className="icon-btn self-start h-6 -mt-0.5 mb-0.5 px-1.5 rounded-md text-[12px] text-[#727a88] hover:text-[#15171c] hover:bg-[#eef0f3] flex items-center gap-1">
          <ChevronDown size={12} /> {hidden} {t.moreSteps}
        </button>
      )}
      {tools.slice(hidden).map(x => <ToolRow key={x.id} tool={x} t={t} />)}
    </div>
  );
}

function ArtifactCard({ a, onOpen, t }: { a: Artifact; onOpen: () => void; t: StudioStrings }) {
  const Icon = a.type === 'html' || a.type === 'svg' ? Shapes : a.type === 'markdown' ? FileText : Code2;
  return (
    <button type="button" onClick={onOpen} className="mt-2 w-full max-w-md flex items-center gap-3 p-3 rounded-2xl border border-[#e4e7ec] bg-white hover:bg-[#f8f9fb] text-left">
      <span className="w-9 h-9 rounded-xl bg-[#eff1f4] flex items-center justify-center shrink-0"><Icon size={17} className="text-[#15171c]" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-[#15171c] truncate">{a.title}</span>
        <span className="block text-[12px] text-[#727a88]">{a.type === 'code' ? a.language : a.type} · {t.version} {a.versions.length}</span>
      </span>
    </button>
  );
}

interface CodeViewProps {
  pending: PendingInteraction | null;
  files: WsFile[];
  onRespond: (results: ResumeResult[], summary: string, permissionAfter?: PermissionMode) => void;
  onOpenFile: (path: string) => void;
  onRewind: (checkpointId: string, what: 'code' | 'conversation' | 'both') => void;
  canRewind: (checkpointId: string) => boolean;
}

function RewindButton({ id, t, onRewind, disabled }: { id: string; t: StudioStrings; onRewind: CodeViewProps['onRewind']; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen(o => !o)} aria-label={t.rewindTitle} title={t.rewindTitle}
        className="h-7 px-2 rounded-md flex items-center gap-1 text-[11.5px] text-[#727a88] hover:bg-[#f2f4f7] hover:text-[#15171c] disabled:opacity-40 opacity-100 sm:opacity-0 group-hover:opacity-100 focus:opacity-100">
        <Undo2 size={12} /> {t.rewind}
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-30 w-64 bg-white border border-[#e4e7ec] rounded-xl shadow-[0_16px_40px_-12px_rgba(16,24,40,0.28)] p-1" role="menu" onMouseLeave={() => setOpen(false)}>
          <p className="px-2.5 py-1.5 text-[11.5px] text-[#727a88]">{t.rewindTitle}</p>
          {(['both', 'code', 'conversation'] as const).map(w => (
            <button key={w} role="menuitem" type="button" onClick={() => { setOpen(false); onRewind(id, w); }} className="w-full text-left px-2.5 h-9 rounded-lg text-[13px] hover:bg-[#f2f4f7]">
              {w === 'both' ? t.rewindBoth : w === 'code' ? t.rewindCode : t.rewindConversation}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageView({
  m, t, lang, artifacts, onOpenArtifact, onRetry, streaming, isLast, onUpgrade, code,
}: {
  m: DisplayMessage; t: StudioStrings; lang: 'es' | 'en'; artifacts: Artifact[]; onOpenArtifact: (id: string) => void;
  onRetry: () => void; streaming: boolean; isLast: boolean; onUpgrade: () => void; code?: CodeViewProps;
}) {
  if (m.role === 'user') {
    if (m.label && !m.text) {
      return (
        <div className="flex justify-center group">
          <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-[#f2f4f7] text-[12px] text-[#4a505c]">
            {m.label === 'continue' ? <History size={12} /> : <SquareTerminal size={12} />}{LABEL_TEXT(t, m.label)}
          </span>
        </div>
      );
    }
    return (
      <div className="flex justify-end group">
        <div className="max-w-[85%] flex flex-col items-end gap-1.5">
          {code && m.checkpointId && code.canRewind(m.checkpointId) && <RewindButton id={m.checkpointId} t={t} onRewind={code.onRewind} disabled={streaming} />}
          {!!m.attachments?.length && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {m.attachments.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-[#eff1f4] text-[12px] text-[#4a505c] max-w-[220px]">
                  {a.mime.startsWith('image/') ? <ImageIcon size={12} /> : <FileText size={12} />}<span className="truncate">{a.name}</span>
                </span>
              ))}
            </div>
          )}
          {m.text && <div className="px-4 py-2.5 rounded-[20px] rounded-br-md bg-[#15171c] text-white text-[14.5px] leading-[1.55] whitespace-pre-wrap break-words">{m.text}</div>}
        </div>
      </div>
    );
  }

  const own = (m.artifactIds ?? []).map(id => artifacts.find(a => a.id === id)).filter(Boolean) as Artifact[];
  const topTools = (m.tools ?? []).filter(x => !x.parent && x.name !== 'task');
  const pending = streaming && isLast && !m.text && !m.error && !topTools.length && !m.reasoning && !(m.subagents ?? []).length;
  const limit = m.error?.code === 'LIMIT_REACHED' || m.error?.code === 'PLAN_REQUIRED' || m.error?.code === 'FREE_CAPACITY' || m.error?.code === 'CONTEXT_TOO_LARGE' || m.error?.code === 'OVER_BUDGET';
  const waitingHere = code?.pending && code.pending.messageId === m.id ? code.pending : null;

  return (
    <div className="flex gap-3">
      <span className="w-7 h-7 rounded-full bg-[#15171c] text-white flex items-center justify-center shrink-0 mt-0.5" aria-hidden><Sparkles size={14} /></span>
      <div className="min-w-0 flex-1">
        {m.compacted && <p className="mb-2 text-[12px] text-[#727a88] flex items-center gap-1.5"><Box size={12} />{t.compactedNote}</p>}
        {!!m.reasoning && <ReasoningBlock text={m.reasoning} t={t} live={streaming && isLast && !m.text} />}
        {!!m.subagents?.length && (
          <SubagentList list={m.subagents} renderTools={id => (m.tools ?? []).filter(x => x.parent === id).slice(-40).map(x => <ToolRow key={x.id} tool={x} t={t} />)} />
        )}
        {topTools.length > 0 && <ToolList tools={topTools} t={t} />}
        {pending && <div className="flex items-center gap-2 h-7 text-[13px] text-[#727a88]"><Loader2 size={14} className="animate-spin" /></div>}
        {m.text && <StudioMarkdown text={m.text} copyLabel={t.copy} copiedLabel={t.copied} />}
        {own.map(a => <ArtifactCard key={a.id} a={a} t={t} onOpen={() => onOpenArtifact(a.id)} />)}
        {code && !!m.fileChanges?.length && <FileChangeList changes={m.fileChanges} t={t} onOpen={code.onOpenFile} />}
        {code && waitingHere && !streaming && (
          waitingHere.kind === 'approval' ? (
            <ApprovalCard calls={waitingHere.calls} files={code.files} t={t} busy={streaming}
              onDecide={(results, summary, autoAfter) => code.onRespond(results, summary, autoAfter ? 'auto' : undefined)} />
          ) : waitingHere.kind === 'plan' ? (
            <PlanCard id={waitingHere.id} plan={waitingHere.plan} t={t} busy={streaming} onDecide={(results, summary, after) => code.onRespond(results, summary, after)} />
          ) : (
            <QuestionCard id={waitingHere.id} question={waitingHere.question} options={waitingHere.options} t={t} busy={streaming} onAnswer={(results, summary) => code.onRespond(results, summary)} />
          )
        )}
        {m.outcome && <p className="mt-2 inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-[#f2f4f7] text-[11.5px] text-[#4a505c]"><Check size={11} />{m.outcome.summary}</p>}
        {!!m.citations?.length && (
          <div className="mt-3">
            <p className="text-[12px] font-medium text-[#727a88] mb-1.5">{t.sources}</p>
            <ol className="flex flex-col gap-1">
              {m.citations.slice(0, 12).map((c, i) => (
                <li key={c.url} className="text-[12.5px] min-w-0">
                  <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="text-[#2456d6] hover:underline inline-flex gap-1.5 max-w-full">
                    <span className="text-[#727a88] tabular-nums">{i + 1}.</span>
                    <span className="truncate">{c.title || hostOf(c.url)}</span>
                    <span className="text-[#a3a9b4] shrink-0">{hostOf(c.url)}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        )}
        {m.notice && !m.error && (
          <p className="mt-2 text-[12.5px] text-[#7a5200] bg-[#fffaf0] border border-[#f0d9a8] rounded-lg px-3 py-2">{noticeText(m.notice, t)}</p>
        )}
        {m.error && (m.error.code === 'ABORTED' ? (
          <p className="mt-2 text-[12.5px] text-[#727a88]">{t.stopped}</p>
        ) : (
          <div role="alert" className={`mt-2 p-3 rounded-xl border text-[13px] ${limit ? 'border-[#f0d9a8] bg-[#fffaf0] text-[#7a5200]' : 'border-[#f3c5c7] bg-[#fdf2f2] text-[#a3242a]'}`}>
            <p>{errorText(m.error, t)}</p>
            <div className="flex gap-2 mt-2">
              {limit ? (
                <button type="button" onClick={onUpgrade} className="h-8 px-3 rounded-lg bg-[#15171c] text-white text-[12.5px]">{t.upgrade}</button>
              ) : !NO_RETRY.has(m.error.code) && isLast && !streaming && (
                <button type="button" onClick={onRetry} className="h-8 px-3 rounded-lg border border-current text-[12.5px]">{t.retry}</button>
              )}
            </div>
          </div>
        ))}
        {typeof m.costUsd === 'number' && !streaming && (
          <p className="mt-1.5 text-[11px] text-[#a3a9b4]">{m.model ? STUDIO_MODELS[m.model as StudioModelId]?.label ?? m.model : ''} · ${m.costUsd.toFixed(4)} · {relTime(m.createdAt, lang)}</p>
        )}
      </div>
    </div>
  );
}

export function LedgerStudio({ wallet, onExit, initialPrompt }: LedgerStudioProps) {
  const api = useStudio(wallet);
  const {
    ready, t, lang, prefs, savePrefs, conversations, projects, active, activeProjectId, setActiveProjectId,
    artifacts, openArtifactId, setOpenArtifactId, streaming, usage, plan, store,
    newChat, openChat, renameChat, togglePin, deleteChat, setChatModel, setChatSkills, draftModel, draftSkills,
    saveArtifactEdit, restoreArtifactVersion, prepareFiles, send, stop, startCheckout,
    mode, setChatMode, permission, setChatPermission, effort, setChatEffort, wsFiles, checkpoints, rewind, respond, exportChat,
    queueMessage, cancelQueued,
  } = api;
  const code = mode === 'code';
  /** A message typed while an answer is streaming: sent as soon as the turn ends. */
  const queued = api.queued && api.queued.convId === active?.id ? api.queued : null;
  const [caret, setCaret] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionOff, setMentionOff] = useState<number | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [focusPath, setFocusPath] = useState<string | null>(null);
  const [sandboxNotice, setSandboxNotice] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [showTodos, setShowTodos] = useState(false);
  const [wsIntent, setWsIntent] = useState<'github' | null>(null);

  const [text, setText] = useState(initialPrompt ?? '');
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [allArtifacts, setAllArtifacts] = useState<Artifact[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [projectEditor, setProjectEditor] = useState<{ project: Project | null } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [picker, setPicker] = useState<'model' | 'skills' | 'effort' | 'permission' | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const currentModel: StudioModelId = active?.model ?? draftModel ?? prefs.defaultModel;
  const currentSkills: string[] = active?.skillIds ?? draftSkills;
  const skillMap = useMemo(() => skillsById(prefs.customSkills), [prefs.customSkills]);
  const activeProject = projects.find(p => p.id === (active?.projectId ?? activeProjectId)) ?? null;
  const openArtifact = artifacts.find(a => a.id === openArtifactId) ?? null;

  // The upgrade return from Stripe.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const u = new URL(window.location.href);
    const up = u.searchParams.get('upgrade');
    if (up) {
      if (up === 'success') { setSettingsTab('usage'); toast.success(t.upgradeSuccess); }
      u.searchParams.delete('upgrade');
      window.history.replaceState(null, '', u.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { store.listAllArtifacts().then(setAllArtifacts).catch(() => {}); }, [store, artifacts]);

  // Auto-scroll while streaming unless the person scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [active?.messages]);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [text]);

  // Esc closes an open menu first; with nothing open (and no dialog) it stops the answer.
  const escRef = useRef({ open: false, streaming: false, stop: stop });
  escRef.current = { open: !!menu || !!picker, streaming, stop };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSidebarOpen(true); setTimeout(() => document.getElementById('studio-search')?.focus(), 50); }
      if (e.key === 'Escape') {
        const s = escRef.current;
        if (s.open) { setMenu(null); setPicker(null); return; }
        if (s.streaming && !e.defaultPrevented && !document.querySelector('[role="dialog"],[role="alertdialog"]')) s.stop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const { ok, rejected } = await prepareFiles(files);
    setPendingFiles(prev => [...prev, ...ok].slice(0, 10));
    setFileErrors(rejected.map(r => `${r.name}: ${r.reason}`));
  }, [prepareFiles]);

  const toggleSandbox = useCallback(() => {
    if (!prefs.sandbox && !prefs.acceptedSandboxNotice) { setSandboxNotice(true); return; }
    savePrefs({ ...prefs, sandbox: !prefs.sandbox });
  }, [prefs, savePrefs]);

  /** Built-in slash commands. Returns true when handled locally. */
  const runBuiltin = useCallback(async (id: BuiltinCommandId, args: string): Promise<boolean> => {
    const needsCode = ['plan', 'ask', 'auto', 'init', 'review', 'files', 'todos', 'rewind', 'sandbox'].includes(id);
    if (needsCode && !code) await setChatMode('code');
    switch (id) {
      case 'help': setText('/'); return true;
      case 'clear': newChat(); return true;
      case 'code': await setChatMode('code'); return true;
      case 'chat': await setChatMode('chat'); return true;
      case 'plan': case 'ask': case 'auto': await setChatPermission(id); toast.success(PERMISSION_LABEL(t)[id]); return true;
      case 'model': {
        const m = modelFromArg(args) as StudioModelId | null;
        if (!m) { setPicker('model'); return true; }
        if (!planAllowsModel(plan, m)) { setSettingsTab('usage'); return true; }
        await setChatModel(m); toast.success(STUDIO_MODELS[m].label); return true;
      }
      case 'effort': {
        const e = args.trim().toLowerCase() as Effort | 'auto';
        if (e === 'auto' || (PLAN_EFFORTS[plan] as readonly string[]).includes(e)) { await setChatEffort(e); toast.success(`${t.effort}: ${EFFORT_LABEL(t)[e]}`); }
        else setPicker('effort');
        return true;
      }
      case 'sandbox': {
        const on = args.trim().toLowerCase();
        if ((on === 'on' && !prefs.sandbox) || (on === 'off' && prefs.sandbox) || !on) toggleSandbox();
        return true;
      }
      case 'cost': toast(`${t.costLine}: $${(active?.totalCostUsd ?? 0).toFixed(4)} · ${(active?.totalTokens ?? 0).toLocaleString(lang)} tokens`); return true;
      case 'memory': setSettingsTab('code'); return true;
      case 'agents': case 'commands': setSettingsTab('code'); return true;
      case 'files': setWorkspaceOpen(true); setOpenArtifactId(null); return true;
      case 'todos': setShowTodos(true); return true;
      case 'rewind': {
        const last = checkpoints[checkpoints.length - 1];
        if (!last) { toast(t.rewindNone); return true; }
        const prompt = await rewind(last.id, 'both');
        if (prompt) setText(prompt);
        toast.success(t.rewindDone);
        return true;
      }
      case 'compact': await send(COMPACT_PROMPT.replace('{focus}', args ? `, focusing on: ${args}` : ''), [], { label: 'compact', compact: true }); return true;
      case 'init': await send(INIT_PROMPT, [], { label: 'init', mode: 'code' }); return true;
      case 'review': await send(REVIEW_PROMPT.replace('{what}', args ? ` (${args})` : ''), [], { label: 'review', mode: 'code' }); return true;
    }
    return false;
  }, [code, setChatMode, newChat, setChatPermission, t, plan, setChatModel, setChatEffort, prefs.sandbox, toggleSandbox, active, lang, setOpenArtifactId, checkpoints, rewind, send]);

  const submit = useCallback(async () => {
    if (!text.trim() && !pendingFiles.length) return;
    if (streaming) {
      // Commands act on the chat right away, so they wait for the answer to end.
      if (text.trim().startsWith('/') || queued) return;
      if (queueMessage(text, pendingFiles)) { setText(''); setPendingFiles([]); setFileErrors([]); stickRef.current = true; }
      return;
    }
    const cmd = !pendingFiles.length ? parseCommand(text, prefs.customCommands) : null;
    if (cmd) {
      if (cmd.kind === 'unknown') { toast.error(`${t.unknownCommand}: /${cmd.name}`); return; }
      setText(''); setSlashIndex(0);
      stickRef.current = true;
      if (cmd.kind === 'builtin') { await runBuiltin(cmd.id, cmd.args); return; }
      await send(cmd.prompt, [], { label: cmd.command.name });
      return;
    }
    const files = pendingFiles;
    const body = text;
    setText(''); setPendingFiles([]); setFileErrors([]);
    stickRef.current = true;
    files.forEach(f => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    await send(body, files);
  }, [streaming, text, pendingFiles, send, prefs.customCommands, t, runBuiltin, queued, queueMessage]);

  const slashMatches = useMemo(() => matchCommands(text, prefs.customCommands), [text, prefs.customCommands]);

  // "@path" suggestions from the workspace while typing in Code mode.
  const wsPaths = useMemo(() => wsFiles.map(f => f.path), [wsFiles]);
  const mention = code && wsPaths.length && !slashMatches.length ? mentionAtCaret(text, caret) : null;
  const mentionOpen = !!mention && mention.start !== mentionOff;
  const mentionMatches = useMemo(() => (mentionOpen && mention ? rankPaths(wsPaths, mention.query) : []), [mentionOpen, mention?.query, wsPaths]); // eslint-disable-line react-hooks/exhaustive-deps
  const mentioned = useMemo(() => (code && text.includes('@') ? mentionedPaths(text, wsPaths) : []), [code, text, wsPaths]);
  const insertMention = useCallback((path: string) => {
    if (!mention) return;
    const next = `${text.slice(0, mention.start)}@${path} ${text.slice(caret)}`;
    const pos = mention.start + path.length + 2;
    setText(next);
    setMentionIndex(0);
    requestAnimationFrame(() => { const el = taRef.current; if (el) { el.focus(); el.setSelectionRange(pos, pos); setCaret(pos); } });
  }, [mention, text, caret]);
  const cyclePermission = useCallback(() => {
    const order: PermissionMode[] = ['plan', 'ask', 'auto'];
    const next = order[(order.indexOf(permission) + 1) % order.length];
    setChatPermission(next);
    toast(PERMISSION_LABEL(t)[next], { id: 'studio-perm', duration: 1400 });
  }, [permission, setChatPermission, t]);

  // How full the context is (from the last turn), against what Studio accepts.
  const ctxMax = STUDIO_PLANS[plan]?.maxInputTokens ?? 150_000;
  const ctxPct = active?.contextTokens ? Math.min(100, Math.round((active.contextTokens / ctxMax) * 100)) : 0;

  const onRespond = useCallback((results: ResumeResult[], summary: string, permissionAfter?: PermissionMode) => {
    stickRef.current = true;
    respond(results, { kind: active?.pending?.kind ?? 'approval', summary }, permissionAfter);
  }, [respond, active]);

  const codeView = useMemo(() => (code ? {
    pending: active?.pending ?? null,
    files: wsFiles,
    onRespond,
    onOpenFile: (p: string) => { setOpenArtifactId(null); setWorkspaceOpen(true); setFocusPath(p); },
    onRewind: async (id: string, what: 'code' | 'conversation' | 'both') => {
      const prompt = await rewind(id, what);
      if (what !== 'code' && prompt) setText(prompt);
      toast.success(t.rewindDone);
    },
    canRewind: (id: string) => checkpoints.some(c => c.id === id),
  } : undefined), [code, active?.pending, wsFiles, onRespond, setOpenArtifactId, rewind, t, checkpoints]);

  const retry = useCallback(() => {
    const lastUser = [...(active?.messages ?? [])].reverse().find(m => m.role === 'user');
    if (lastUser?.text) send(lastUser.text);
  }, [active, send]);

  const results = useMemo(() => (query.trim().length >= 2 ? searchStudio(query, { conversations, projects, artifacts: allArtifacts }) : []), [query, conversations, projects, allArtifacts]);
  const visibleChats = conversations.filter(c => (activeProjectId ? c.projectId === activeProjectId : true));
  const pinned = visibleChats.filter(c => c.pinned);
  const recent = visibleChats.filter(c => !c.pinned);

  const goUpgrade = () => setSettingsTab('usage');

  if (!ready) {
    return <div className="h-full w-full flex items-center justify-center bg-white"><Loader2 className="animate-spin text-[#727a88]" /></div>;
  }

  const chatItem = (c: Conversation) => (
    <li key={c.id} className="relative group">
      {renaming?.id === c.id ? (
        <form onSubmit={e => { e.preventDefault(); renameChat(c.id, renaming.title); setRenaming(null); }} className="px-1">
          <input autoFocus value={renaming.title} onChange={e => setRenaming({ id: c.id, title: e.target.value })} onBlur={() => { renameChat(c.id, renaming.title); setRenaming(null); }}
            className="w-full h-9 px-2 rounded-lg border border-[#98a2b3] text-[13.5px] outline-none" maxLength={120} />
        </form>
      ) : (
        <button type="button" onClick={() => { openChat(c.id); setSidebarOpen(false); }}
          className={`w-full h-9 pl-3 pr-8 rounded-lg text-left text-[13.5px] truncate ${active?.id === c.id ? 'bg-[#e9ecf1] text-[#15171c] font-medium' : 'text-[#2b2f36] hover:bg-[#eef0f3]'}`}>
          {c.title}
        </button>
      )}
      <button type="button" aria-label={t.settings} onClick={() => setMenu(menu === c.id ? null : c.id)}
        className="absolute right-1 top-1 w-7 h-7 rounded-md flex items-center justify-center text-[#727a88] opacity-100 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-[#e4e7ec]">
        <MoreHorizontal size={15} />
      </button>
      {menu === c.id && (
        <div className="absolute right-1 top-9 z-30 w-52 bg-white border border-[#e4e7ec] rounded-xl shadow-[0_16px_40px_-12px_rgba(16,24,40,0.28)] p-1" role="menu">
          <button role="menuitem" type="button" className="w-full flex items-center gap-2 px-2.5 h-9 rounded-lg text-[13px] hover:bg-[#f2f4f7]" onClick={() => { togglePin(c.id); setMenu(null); }}>
            {c.pinned ? <PinOff size={14} /> : <Pin size={14} />} {c.pinned ? t.unpin : t.pin}
          </button>
          <button role="menuitem" type="button" className="w-full flex items-center gap-2 px-2.5 h-9 rounded-lg text-[13px] hover:bg-[#f2f4f7]" onClick={() => { setRenaming({ id: c.id, title: c.title }); setMenu(null); }}>
            <Pencil size={14} /> {t.rename}
          </button>
          <button role="menuitem" type="button" className="w-full flex items-center gap-2 px-2.5 h-9 rounded-lg text-[13px] hover:bg-[#f2f4f7]" onClick={() => { setMenu(null); exportChat(c.id); }}>
            <Download size={14} /> {t.exportMd}
          </button>
          <button role="menuitem" type="button" className="w-full flex items-center gap-2 px-2.5 h-9 rounded-lg text-[13px] text-[#d93036] hover:bg-[#fdf2f2]" onClick={() => { setMenu(null); if (window.confirm(t.deleteConfirm)) deleteChat(c.id); }}>
            <Trash2 size={14} /> {t.delete}
          </button>
        </div>
      )}
    </li>
  );

  const sidebar = (
    <aside className="flex flex-col h-full w-full bg-[#f7f8fa]">
      <div className="flex items-center gap-2 px-3 h-14 shrink-0">
        {onExit && (
          <button type="button" onClick={onExit} aria-label={t.back} title={t.back} className="w-9 h-9 rounded-lg flex items-center justify-center text-[#15171c] hover:bg-[#eceef2]"><ArrowLeft size={18} /></button>
        )}
        <span className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-[#15171c]">
          <span className="w-6 h-6 rounded-lg bg-[#15171c] text-white flex items-center justify-center"><Sparkles size={13} /></span>{t.studio}
        </span>
        <button type="button" className="ml-auto sm:hidden w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#eceef2]" onClick={() => setSidebarOpen(false)} aria-label={t.close}><X size={18} /></button>
      </div>
      <div className="px-3 space-y-2 shrink-0">
        <button type="button" onClick={() => { newChat(); setSidebarOpen(false); setTimeout(() => taRef.current?.focus(), 50); }}
          className="w-full h-10 px-3 rounded-xl bg-white border border-[#e4e7ec] flex items-center gap-2 text-[13.5px] font-medium text-[#15171c] hover:bg-[#fbfbfc]">
          <Plus size={16} /> {activeProjectId ? t.newChatInProject : t.newChat}
        </button>
        <label className="relative block">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#727a88]" />
          <input id="studio-search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t.searchPlaceholder} aria-label={t.search}
            className="w-full h-10 pl-9 pr-8 rounded-xl bg-white border border-[#e4e7ec] text-[13.5px] outline-none focus:border-[#98a2b3]" />
          {query && <button type="button" aria-label={t.close} onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#727a88]"><X size={14} /></button>}
        </label>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pt-3 pb-2" onClick={() => menu && setMenu(null)}>
        {query.trim().length >= 2 ? (
          results.length === 0 ? <p className="px-3 text-[13px] text-[#727a88]">{t.noResults}</p> : (
            <ul className="space-y-0.5">
              {results.map(h => (
                <li key={`${h.kind}:${h.conversationId ?? ''}:${h.id}`}>
                  <button type="button" className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#eef0f3]" onClick={() => {
                    if (h.kind === 'conversation') openChat(h.id);
                    else if (h.kind === 'project') { setActiveProjectId(h.id); newChat(h.id); }
                    else if (h.conversationId) { openChat(h.conversationId); setTimeout(() => setOpenArtifactId(h.id), 80); }
                    setQuery(''); setSidebarOpen(false);
                  }}>
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-[#15171c] truncate">
                      {h.kind === 'project' ? <FolderOpen size={13} /> : h.kind === 'artifact' ? <Code2 size={13} /> : null}{h.title}
                    </span>
                    <span className="block text-[12px] text-[#727a88] line-clamp-2">{h.snippet}</span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <>
            <div className="mb-3">
              <div className="flex items-center justify-between px-3 h-7">
                <span className="text-[12px] font-medium text-[#727a88]">{t.projects}</span>
                <button type="button" aria-label={t.newProject} title={t.newProject} onClick={() => setProjectEditor({ project: null })} className="w-6 h-6 rounded-md flex items-center justify-center text-[#4a505c] hover:bg-[#e4e7ec]"><FolderPlus size={14} /></button>
              </div>
              {activeProjectId && (
                <button type="button" onClick={() => { setActiveProjectId(null); newChat(null); }} className="w-full h-8 px-3 rounded-lg text-left text-[12.5px] text-[#4a505c] hover:bg-[#eef0f3] flex items-center gap-1.5">
                  <ArrowLeft size={13} /> {t.allChats}
                </button>
              )}
              <ul className="space-y-0.5">
                {projects.map(p => (
                  <li key={p.id} className="relative group">
                    <button type="button" onClick={() => { setActiveProjectId(p.id); newChat(p.id); }}
                      className={`w-full h-9 pl-3 pr-8 rounded-lg text-left text-[13.5px] truncate flex items-center gap-2 ${activeProjectId === p.id ? 'bg-[#e9ecf1] font-medium text-[#15171c]' : 'text-[#2b2f36] hover:bg-[#eef0f3]'}`}>
                      <FolderOpen size={14} className="shrink-0 text-[#4a505c]" /><span className="truncate">{p.name}</span>
                    </button>
                    <button type="button" aria-label={t.edit} onClick={() => setProjectEditor({ project: p })}
                      className="absolute right-1 top-1 w-7 h-7 rounded-md flex items-center justify-center text-[#727a88] opacity-100 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-[#e4e7ec]"><Pencil size={13} /></button>
                  </li>
                ))}
                {projects.length === 0 && <li className="px-3 text-[12.5px] text-[#a3a9b4]">{t.projectsEmpty}</li>}
              </ul>
            </div>

            {pinned.length > 0 && (
              <div className="mb-3">
                <p className="px-3 h-7 flex items-center text-[12px] font-medium text-[#727a88]">{t.pinned}</p>
                <ul className="space-y-0.5">{pinned.map(chatItem)}</ul>
              </div>
            )}
            <div className="mb-3">
              <p className="px-3 h-7 flex items-center text-[12px] font-medium text-[#727a88]">{activeProject ? activeProject.name : t.chats}</p>
              {recent.length === 0 && pinned.length === 0 ? <p className="px-3 text-[12.5px] text-[#a3a9b4]">{t.noChats}</p> : <ul className="space-y-0.5">{recent.map(chatItem)}</ul>}
            </div>
            {allArtifacts.length > 0 && (
              <div>
                <p className="px-3 h-7 flex items-center text-[12px] font-medium text-[#727a88]">{t.artifacts}</p>
                <ul className="space-y-0.5">
                  {allArtifacts.slice(0, 12).map(a => (
                    <li key={`${a.conversationId}:${a.id}`}>
                      <button type="button" onClick={() => { openChat(a.conversationId); setTimeout(() => setOpenArtifactId(a.id), 80); setSidebarOpen(false); }}
                        className="w-full h-9 px-3 rounded-lg text-left text-[13px] text-[#2b2f36] hover:bg-[#eef0f3] flex items-center gap-2">
                        <Code2 size={13} className="shrink-0 text-[#4a505c]" /><span className="truncate">{a.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      <div className="p-3 border-t border-[#eceef2] shrink-0">
        {usage?.configured && usage.usage && (
          <button type="button" onClick={() => setSettingsTab('usage')} className="w-full mb-2 text-left">
            <div className="flex justify-between text-[11.5px] text-[#727a88] mb-1">
              <span>{t.today} · {plan === 'pro' ? t.pro : t.free}</span>
              <span className="tabular-nums">{Math.min(100, Math.round((usage.usage.todayUsd / Math.max(usage.usage.plan.dailyBudgetUsd, 0.0001)) * 100))}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#e4e7ec] overflow-hidden">
              <div className="h-full bg-[#15171c]" style={{ width: `${Math.min(100, (usage.usage.todayUsd / Math.max(usage.usage.plan.dailyBudgetUsd, 0.0001)) * 100)}%` }} />
            </div>
          </button>
        )}
        <div className="flex gap-1">
          <button type="button" onClick={() => setSettingsTab('general')} className="flex-1 h-9 px-2.5 rounded-lg flex items-center gap-2 text-[13px] text-[#2b2f36] hover:bg-[#eceef2]"><Settings size={15} /> {t.settings}</button>
          <button type="button" onClick={() => setSettingsTab('connectors')} aria-label={t.connectors} title={t.connectors} className="w-9 h-9 rounded-lg flex items-center justify-center text-[#2b2f36] hover:bg-[#eceef2]"><Plug size={15} /></button>
          {plan === 'free' && <button type="button" onClick={goUpgrade} className="h-9 px-2.5 rounded-lg text-[12.5px] font-medium text-[#15171c] bg-white border border-[#e4e7ec] hover:bg-[#fbfbfc]">{t.pro}</button>}
        </div>
      </div>
    </aside>
  );

  const starters = code ? [t.codeStarter1, t.codeStarter2, t.codeStarter3, t.codeStarter4] : [t.starter1, t.starter2, t.starter3, t.starter4];
  const messages = active?.messages ?? [];
  const todos = active?.todos ?? [];
  const sidePanel = code && workspaceOpen ? 'workspace' : openArtifact ? 'artifact' : null;

  return (
    <div className="h-full w-full flex bg-white text-[#15171c] overflow-hidden"
      onDragOver={e => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={e => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); }}>

      {/* Sidebar */}
      <div className="hidden sm:flex w-[272px] shrink-0 border-r border-[#eceef2]">{sidebar}</div>
      {sidebarOpen && (
        <div className="sm:hidden fixed inset-0 z-[300] flex">
          <div className="w-[86%] max-w-[320px] h-full shadow-xl">{sidebar}</div>
          <button type="button" aria-label={t.close} className="flex-1 bg-[#15171c]/30" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Chat */}
      <main className={`flex-1 min-w-0 flex flex-col ${sidePanel ? 'hidden lg:flex' : 'flex'}`}>
        <header className="flex items-center gap-2 px-3 h-14 border-b border-[#eceef2] shrink-0">
          <button type="button" className="sm:hidden w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#f2f4f7]" onClick={() => setSidebarOpen(true)} aria-label={t.chats}><Menu size={18} /></button>
          {onExit && <button type="button" className="sm:hidden w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#f2f4f7]" onClick={onExit} aria-label={t.back}><ArrowLeft size={18} /></button>}
          <div className="min-w-0 flex-1">
            <h1 className="text-[14.5px] font-semibold truncate">{active?.title ?? t.newChat}</h1>
            {(activeProject || active) && (
              <p className="text-[11.5px] text-[#727a88] truncate">
                {activeProject ? <><FolderOpen size={11} className="inline -mt-0.5 mr-1" />{activeProject.name}</> : null}
                {active && active.totalCostUsd > 0 ? `${activeProject ? ' · ' : ''}${t.costThisChat}: $${active.totalCostUsd.toFixed(3)}` : ''}
              </p>
            )}
          </div>
          {/* Chat / Code: one segmented control, labelled on every screen size. */}
          <div className="flex items-center p-[3px] rounded-[10px] bg-[#eff1f4] shrink-0" role="tablist" aria-label={t.modeCodeHint}>
            {([['chat', MessageSquare, t.modeChat], ['code', SquareTerminal, t.modeCode]] as const).map(([m, Icon, label]) => {
              const on = (m === 'code') === code;
              return (
                <button key={m} type="button" role="tab" aria-selected={on} disabled={streaming} onClick={() => setChatMode(m)} title={m === 'code' ? t.modeCodeHint : undefined}
                  className={`icon-btn h-[30px] px-2.5 rounded-[7px] flex items-center gap-1.5 text-[12.5px] transition-colors disabled:opacity-50 ${on ? 'bg-white text-[#15171c] font-medium shadow-[0_1px_2px_rgba(16,24,40,0.12)]' : 'text-[#5d6472] hover:text-[#15171c]'}`}>
                  <Icon size={13} />{label}
                </button>
              );
            })}
          </div>
          {ctxPct > 0 && (
            <button type="button" onClick={() => { if (ctxPct >= 80 && !streaming) { setText('/compact '); taRef.current?.focus(); } }}
              title={`${t.ctxLabel}: ${ctxPct}% ${t.ctxUsed} (${(active?.contextTokens ?? 0).toLocaleString(lang)} / ${ctxMax.toLocaleString(lang)})${ctxPct >= 80 ? ` · ${t.ctxCompact}` : ''}`}
              aria-label={`${t.ctxLabel} ${ctxPct}%`}
              className={`icon-btn hidden sm:flex h-9 px-2 rounded-[10px] items-center gap-1.5 text-[11.5px] tabular-nums shrink-0 ${ctxPct >= 80 ? 'text-[#b42318] hover:bg-[#fef3f2]' : 'text-[#727a88] hover:bg-[#f7f8fa]'}`}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="-rotate-90">
                <circle cx="8" cy="8" r="6" fill="none" stroke="#e4e7ec" strokeWidth="2.25" />
                <circle cx="8" cy="8" r="6" fill="none" stroke={ctxPct >= 80 ? '#d92d20' : ctxPct >= 60 ? '#dc6803' : '#15171c'} strokeWidth="2.25" strokeLinecap="round"
                  strokeDasharray={`${(ctxPct / 100) * 37.7} 37.7`} />
              </svg>
              {ctxPct}%
            </button>
          )}
          {code && !workspaceOpen && (
            <button type="button" onClick={() => { setOpenArtifactId(null); setWorkspaceOpen(true); }} title={t.wsTitle}
              className="icon-btn h-9 pl-2.5 pr-3 rounded-[10px] border border-[#e4e7ec] text-[12.5px] flex items-center gap-1.5 hover:bg-[#f7f8fa] shrink-0">
              <Files size={14} /><span className="hidden md:inline">{t.files}</span><span className="tabular-nums text-[#727a88]">{wsFiles.length}</span>
            </button>
          )}
          {!code && artifacts.length > 0 && !openArtifact && (
            <button type="button" onClick={() => setOpenArtifactId(artifacts[artifacts.length - 1].id)} className="h-9 px-3 rounded-lg border border-[#e4e7ec] text-[12.5px] flex items-center gap-1.5 hover:bg-[#f2f4f7] shrink-0">
              <Code2 size={14} /><span className="hidden sm:inline">{t.artifacts}</span> <span className="tabular-nums text-[#727a88]">{artifacts.length}</span>
            </button>
          )}
        </header>

        {usage && !usage.configured && (
          <div className="mx-3 mt-3 p-3 rounded-xl border border-[#f0d9a8] bg-[#fffaf0] text-[13px] text-[#7a5200] flex gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" />{t.notConfigured}</div>
        )}

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto"
          onScroll={e => { const el = e.currentTarget; stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
          {messages.length === 0 ? (
            // min-h-full (not h-full): on short screens the welcome grows and scrolls instead of being cut off at the top.
            <div className="min-h-full flex flex-col items-center justify-center px-4 py-10 text-center">
              <span className="w-12 h-12 rounded-2xl bg-[#15171c] text-white flex items-center justify-center mb-4">{code ? <SquareTerminal size={22} /> : <Sparkles size={22} />}</span>
              <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{activeProject ? activeProject.name : code ? t.codeEmptyTitle : t.emptyTitle}</h2>
              <p className="mt-2 max-w-md text-[14px] text-[#4a505c]">{activeProject?.description || (code ? t.codeEmptyBody : t.emptyBody)}</p>
              {code && (
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={() => { setOpenArtifactId(null); setWsIntent(null); setWorkspaceOpen(true); }}
                    className="h-10 px-4 rounded-xl border border-[#e4e7ec] bg-white text-[13.5px] flex items-center gap-2 hover:bg-[#f8f9fb]">
                    <Files size={15} /> {wsFiles.length ? t.files : t.wsUploadFolder} {wsFiles.length > 0 && <span className="tabular-nums text-[#727a88]">{wsFiles.length}</span>}
                  </button>
                  <button type="button" onClick={() => { setOpenArtifactId(null); setWsIntent('github'); setWorkspaceOpen(true); }}
                    className="h-10 px-4 rounded-xl border border-[#e4e7ec] bg-white text-[13.5px] flex items-center gap-2 hover:bg-[#f8f9fb]">
                    <Github size={15} /> {t.ghImport}
                  </button>
                  {wsFiles.length > 0 && (
                    <button type="button" disabled={streaming} onClick={() => runBuiltin('init', '')} title={t.cmd_init}
                      className="h-10 px-4 rounded-xl bg-[#15171c] text-white text-[13.5px] font-medium flex items-center gap-2 disabled:opacity-40">
                      <Sparkles size={15} /> {t.initHint}
                    </button>
                  )}
                </div>
              )}
              <div className="mt-6 grid sm:grid-cols-2 gap-2 w-full max-w-xl">
                {starters.map(s => (
                  <button key={s} type="button" onClick={() => { setText(s); taRef.current?.focus(); }} className="p-3 rounded-2xl border border-[#e4e7ec] text-left text-[13.5px] text-[#2b2f36] hover:bg-[#f8f9fb]">{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.map((m, i) => (
                <MessageView key={m.id} m={m} t={t} lang={lang} artifacts={artifacts} onOpenArtifact={id => { setWorkspaceOpen(false); setOpenArtifactId(id); }}
                  onRetry={retry} streaming={streaming} isLast={i === messages.length - 1} onUpgrade={goUpgrade} code={codeView} />
              ))}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="px-3 pb-3 pt-1 shrink-0" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <div className="max-w-3xl mx-auto">
            {fileErrors.length > 0 && <div className="mb-2 text-[12.5px] text-[#d93036]">{fileErrors.join(' · ')}</div>}
            {ctxPct >= 80 && !streaming && (
              <button type="button" onClick={() => runBuiltin('compact', '')}
                className="icon-btn mb-2 max-w-full h-7 px-2.5 rounded-full bg-[#fef3f2] text-[12px] text-[#b42318] flex items-center gap-1.5 min-w-0">
                <AlertTriangle size={12} className="shrink-0" /><span className="truncate">{ctxPct}% · {t.ctxCompact}</span>
              </button>
            )}
            {code && todos.some(x => x.status !== 'completed') && (
              showTodos ? (
                <div className="mb-2 max-h-40 overflow-y-auto cursor-pointer" onClick={() => setShowTodos(false)} title={t.close}>
                  <TodoList todos={todos} t={t} compact />
                </div>
              ) : (
                <button type="button" onClick={() => setShowTodos(true)} aria-expanded={false} className="mb-2 max-w-full h-7 px-2.5 rounded-full bg-[#f2f4f7] text-[12px] text-[#4a505c] flex items-center gap-1.5 min-w-0">
                  <ListTodo size={12} className="shrink-0" />
                  <span className="tabular-nums shrink-0">{t.todos} {todos.filter(x => x.status === 'completed').length}/{todos.length}</span>
                  {(() => { const cur = todos.find(x => x.status === 'in_progress'); return cur ? <span className="truncate text-[#15171c]">· {cur.activeForm || cur.content}</span> : null; })()}
                  <ChevronDown size={12} className="shrink-0" />
                </button>
              )
            )}
            <div className={`relative rounded-[22px] border bg-white shadow-[0_8px_24px_-16px_rgba(16,24,40,0.25)] ${dragging ? 'border-[#15171c] border-dashed' : 'border-[#e4e7ec] focus-within:border-[#b9bfc9]'}`}>
              {slashMatches.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-2 z-30 max-h-72 overflow-y-auto bg-white border border-[#e4e7ec] rounded-2xl shadow-[0_24px_48px_-12px_rgba(16,24,40,0.25)] p-1.5" role="listbox" aria-label={t.slashHint}>
                  <p className="px-2.5 pt-1 pb-1.5 text-[11.5px] font-medium text-[#727a88]">{t.slashHint}</p>
                  {slashMatches.map((c, i) => (
                    <button key={c.name} type="button" role="option" aria-selected={i === slashIndex % slashMatches.length}
                      onMouseEnter={() => setSlashIndex(i)}
                      onClick={() => { setText(`/${c.name}${c.args || c.custom ? ' ' : ''}`); setSlashIndex(0); taRef.current?.focus(); }}
                      className={`w-full flex items-baseline gap-2 px-2.5 py-1.5 rounded-xl text-left ${i === slashIndex % slashMatches.length ? 'bg-[#f2f4f7]' : ''}`}>
                      <span className="font-mono text-[13px] text-[#15171c] shrink-0">/{c.name}</span>
                      {c.args && <span className="font-mono text-[11.5px] text-[#a3a9b4] shrink-0">{c.args}</span>}
                      <span className="text-[12.5px] text-[#727a88] truncate">{c.custom ? c.custom.description : (t as any)[`cmd_${c.name}`] ?? ''}</span>
                    </button>
                  ))}
                </div>
              )}
              {mentionOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 z-30 max-h-72 overflow-y-auto bg-white border border-[#e4e7ec] rounded-2xl shadow-[0_24px_48px_-12px_rgba(16,24,40,0.25)] p-1.5" role="listbox" aria-label={t.mentionTitle}>
                  <p className="px-2.5 pt-1 pb-1.5 text-[11.5px] font-medium text-[#727a88] flex items-center gap-1.5"><AtSign size={12} />{t.mentionTitle}</p>
                  {mentionMatches.length === 0 ? (
                    <p className="px-2.5 py-2 text-[12.5px] text-[#a3a9b4]">{t.mentionNone}</p>
                  ) : mentionMatches.map((p, i) => {
                    const slash = p.lastIndexOf('/');
                    return (
                      <button key={p} type="button" role="option" aria-selected={i === mentionIndex % mentionMatches.length}
                        onMouseEnter={() => setMentionIndex(i)} onMouseDown={e => e.preventDefault()} onClick={() => insertMention(p)}
                        className={`w-full flex items-center gap-2 px-2.5 h-9 rounded-xl text-left min-w-0 ${i === mentionIndex % mentionMatches.length ? 'bg-[#f2f4f7]' : ''}`}>
                        <FileText size={13} className="shrink-0 text-[#727a88]" />
                        <span className="font-mono text-[12.5px] text-[#15171c] shrink-0">{p.slice(slash + 1)}</span>
                        {slash > 0 && <span className="font-mono text-[11.5px] text-[#a3a9b4] truncate">{p.slice(0, slash)}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {queued && (
                <div className="flex items-center gap-2 mx-3 mt-3 pl-3 pr-1 h-9 rounded-xl bg-[#f7f8fa] border border-dashed border-[#d0d5dd] text-[12.5px] text-[#4a505c] min-w-0">
                  <Clock3 size={13} className="shrink-0" />
                  <span className="truncate flex-1 min-w-0"><span className="text-[#727a88]">{t.queued} · </span><span className="text-[#15171c]">{queued.text || queued.files.map(f => f.name).join(', ')}</span></span>
                  <button type="button" aria-label={t.queueCancel} title={t.queueCancel}
                    onClick={() => { const q = cancelQueued(); if (q) { setText(prev => prev || q.text); setPendingFiles(prev => (prev.length ? prev : q.files)); } }}
                    className="icon-btn w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#eceef2] shrink-0"><X size={13} /></button>
                </div>
              )}
              {mentioned.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 pt-3">
                  {mentioned.map(p => (
                    <span key={p} className="inline-flex items-center gap-1 h-7 px-2 rounded-lg bg-[#eef2ff] text-[#1a3a8f] text-[12px] font-mono max-w-[240px]" title={p}>
                      <AtSign size={11} className="shrink-0" /><span className="truncate">{p}</span>
                    </span>
                  ))}
                </div>
              )}
              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 pt-3">
                  {pendingFiles.map(f => (
                    <span key={f.id} className="inline-flex items-center gap-1.5 h-8 pl-1.5 pr-1 rounded-lg bg-[#f2f4f7] text-[12px] text-[#2b2f36] max-w-[220px]">
                      {f.previewUrl ? <img src={f.previewUrl} alt="" className="w-6 h-6 rounded object-cover" /> : <FileText size={14} className="ml-1" />}
                      <span className="truncate">{f.name}</span>
                      <button type="button" aria-label={t.delete} onClick={() => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); setPendingFiles(prev => prev.filter(x => x.id !== f.id)); }} className="w-5 h-5 rounded flex items-center justify-center hover:bg-[#e4e7ec]"><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
              <textarea
                ref={taRef}
                value={text}
                onChange={e => { setText(e.target.value); setCaret(e.target.selectionStart ?? e.target.value.length); }}
                onSelect={e => setCaret(e.currentTarget.selectionStart ?? 0)}
                onKeyDown={e => {
                  if (mentionMatches.length) {
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      setMentionIndex(i => (i + (e.key === 'ArrowDown' ? 1 : mentionMatches.length - 1)) % mentionMatches.length);
                      return;
                    }
                    if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing)) {
                      e.preventDefault();
                      insertMention(mentionMatches[mentionIndex % mentionMatches.length]);
                      return;
                    }
                    if (e.key === 'Escape') { e.preventDefault(); setMentionOff(mention?.start ?? null); return; }
                  }
                  if (code && e.key === 'Tab' && e.shiftKey && !slashMatches.length) { e.preventDefault(); cyclePermission(); return; }
                  if (slashMatches.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                    e.preventDefault();
                    setSlashIndex(i => (i + (e.key === 'ArrowDown' ? 1 : slashMatches.length - 1)) % slashMatches.length);
                    return;
                  }
                  if (slashMatches.length && (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey && !slashMatches.some(c => `/${c.name}` === text.trim())))) {
                    e.preventDefault();
                    const c = slashMatches[slashIndex % slashMatches.length];
                    setText(`/${c.name}${c.args || c.custom ? ' ' : ''}`);
                    setSlashIndex(0);
                    return;
                  }
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
                }}
                onPaste={e => { const files = Array.from(e.clipboardData?.files ?? []); if (files.length) { e.preventDefault(); addFiles(files); } }}
                placeholder={code ? t.codePlaceholder : t.composerPlaceholder}
                aria-label={t.composerPlaceholder}
                rows={1}
                className="w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] leading-[1.5] outline-none focus-visible:outline-none placeholder:text-[#a3a9b4] max-h-[240px]"
              />
              <div className="flex items-center gap-1 px-2 pb-2">
                <input ref={fileRef} type="file" multiple className="hidden" onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
                <button type="button" onClick={() => fileRef.current?.click()} aria-label={t.attach} title={t.attach} className="w-9 h-9 rounded-full flex items-center justify-center text-[#4a505c] hover:bg-[#f2f4f7]"><Paperclip size={17} /></button>
                <button type="button" aria-pressed={prefs.webSearch} onClick={() => savePrefs({ ...prefs, webSearch: !prefs.webSearch, webFetch: !prefs.webSearch })} title={t.webSearch}
                  className={`h-9 px-2.5 rounded-full flex items-center gap-1.5 text-[12.5px] ${prefs.webSearch ? 'bg-[#e8f0fe] text-[#1a4fb8]' : 'text-[#4a505c] hover:bg-[#f2f4f7]'}`}>
                  <Globe size={15} /><span className={code ? 'hidden' : 'hidden sm:inline'}>{t.webSearch}</span>
                </button>
                {code && (
                  <div className="relative">
                    <button type="button" onClick={() => setPicker(picker === 'permission' ? null : 'permission')} aria-expanded={picker === 'permission'} title={t.permission}
                      className={`h-9 px-2.5 rounded-full flex items-center gap-1.5 text-[12.5px] ${permission === 'auto' ? 'bg-[#fff4e5] text-[#9a5b00]' : permission === 'plan' ? 'bg-[#eef2ff] text-[#1a3a8f]' : 'text-[#4a505c] hover:bg-[#f2f4f7]'}`}>
                      <ShieldCheck size={15} />
                      <span className="md:hidden">{permission === 'plan' ? t.permShortPlan : permission === 'auto' ? t.permShortAuto : t.permShortAsk}</span>
                      <span className="hidden md:inline">{PERMISSION_LABEL(t)[permission]}</span><ChevronDown size={13} />
                    </button>
                    {picker === 'permission' && (
                      <div className="absolute bottom-11 left-0 z-30 w-72 bg-white border border-[#e4e7ec] rounded-2xl shadow-[0_24px_48px_-12px_rgba(16,24,40,0.25)] p-1.5">
                        {(['plan', 'ask', 'auto'] as const).map(p => (
                          <button key={p} type="button" onClick={() => { setChatPermission(p); setPicker(null); }} className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-[#f2f4f7]">
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-medium text-[#15171c]">{PERMISSION_LABEL(t)[p]}</span>
                              <span className="block text-[12px] text-[#727a88]">{p === 'plan' ? t.permPlanHint : p === 'ask' ? t.permAskHint : t.permAutoHint}</span>
                            </span>
                            {permission === p && <Check size={15} className="mt-0.5" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="relative">
                  <button type="button" onClick={() => setPicker(picker === 'effort' ? null : 'effort')} aria-expanded={picker === 'effort'} title={`${t.effort} · ${t.effortHint}`}
                    className={`h-9 px-2.5 rounded-full flex items-center gap-1.5 text-[12.5px] ${effort !== 'auto' ? 'bg-[#f1ecfe] text-[#5b34c7]' : 'text-[#4a505c] hover:bg-[#f2f4f7]'}`}>
                    <Gauge size={15} />{effort !== 'auto' ? <span>{EFFORT_LABEL(t)[effort]}</span> : <span className="hidden lg:inline">{t.effort}</span>}
                  </button>
                  {picker === 'effort' && (
                    <div className="absolute bottom-11 left-0 z-30 w-60 bg-white border border-[#e4e7ec] rounded-2xl shadow-[0_24px_48px_-12px_rgba(16,24,40,0.25)] p-1.5">
                      <p className="px-2.5 pt-1 pb-1.5 text-[11.5px] text-[#727a88]">{t.effortHint}</p>
                      {(['auto', 'low', 'medium', 'high', 'xhigh', 'max'] as const).map(e => {
                        const allowed = e === 'auto' || (PLAN_EFFORTS[plan] as readonly string[]).includes(e);
                        return (
                          <button key={e} type="button" onClick={() => { if (!allowed) { setPicker(null); goUpgrade(); return; } setChatEffort(e); setPicker(null); }}
                            className="w-full flex items-center gap-2 px-2.5 h-9 rounded-xl text-left hover:bg-[#f2f4f7] text-[13px]">
                            <span className="flex-1">{EFFORT_LABEL(t)[e]}</span>
                            {!allowed && <span className="px-1.5 h-4 rounded bg-[#15171c] text-white text-[10px] leading-4">{t.proOnly}</span>}
                            {effort === e && <Check size={14} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {code && (
                  <button type="button" aria-pressed={prefs.sandbox} onClick={toggleSandbox} title={`${t.sandbox} · ${t.sandboxHint}`}
                    className={`h-9 px-2.5 rounded-full flex items-center gap-1.5 text-[12.5px] ${prefs.sandbox ? 'bg-[#e9f7ef] text-[#0f6b45]' : 'text-[#4a505c] hover:bg-[#f2f4f7]'}`}>
                    <span className="relative"><Box size={15} />{prefs.sandbox && <span className="absolute -right-0.5 -top-0.5 w-1.5 h-1.5 rounded-full bg-[#12805c]" />}</span><span className="hidden lg:inline">{t.sandbox}</span>
                  </button>
                )}
                {/* On phones in Code mode the bar is full: skills stay reachable from the chat's settings. */}
                <div className={`relative ${code && !currentSkills.length ? 'hidden sm:block' : ''}`}>
                  <button type="button" onClick={() => setPicker(picker === 'skills' ? null : 'skills')} aria-expanded={picker === 'skills'}
                    className={`h-9 px-2.5 rounded-full flex items-center gap-1.5 text-[12.5px] ${currentSkills.length ? 'bg-[#f1ecfe] text-[#5b34c7]' : 'text-[#4a505c] hover:bg-[#f2f4f7]'}`}>
                    <BookOpen size={15} /><span className={code ? 'hidden lg:inline' : 'hidden sm:inline'}>{t.skills}</span>{currentSkills.length > 0 && <span className="tabular-nums">{currentSkills.length}</span>}
                  </button>
                  {picker === 'skills' && (
                    <div className="absolute bottom-11 left-0 z-30 w-72 max-h-80 overflow-y-auto bg-white border border-[#e4e7ec] rounded-2xl shadow-[0_24px_48px_-12px_rgba(16,24,40,0.25)] p-1.5">
                      {Array.from(skillMap.values()).map(s => {
                        const on = currentSkills.includes(s.id);
                        return (
                          <button key={s.id} type="button" onClick={() => setChatSkills(on ? currentSkills.filter(x => x !== s.id) : [...currentSkills, s.id].slice(0, 12))}
                            className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-[#f2f4f7]">
                            <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-[#15171c] border-[#15171c] text-white' : 'border-[#c4c9d2]'}`}>{on && <Check size={11} />}</span>
                            <span className="min-w-0">
                              <span className="block text-[13px] font-medium text-[#15171c]">{s.name}</span>
                              <span className="block text-[12px] text-[#727a88] line-clamp-2">{s.description}</span>
                            </span>
                          </button>
                        );
                      })}
                      <button type="button" onClick={() => { setPicker(null); setSettingsTab('skills'); }} className="w-full h-9 mt-1 rounded-xl text-[12.5px] text-[#4a505c] hover:bg-[#f2f4f7] flex items-center justify-center gap-1.5"><Plus size={13} /> {t.newSkill}</button>
                    </div>
                  )}
                </div>
                <div className="ml-auto relative">
                  <button type="button" onClick={() => setPicker(picker === 'model' ? null : 'model')} aria-expanded={picker === 'model'} aria-label={t.model}
                    className="h-9 px-2.5 rounded-full flex items-center gap-1 text-[12.5px] text-[#4a505c] hover:bg-[#f2f4f7] whitespace-nowrap">
                    {(() => {
                      const short = STUDIO_MODELS[currentModel]?.label.replace('Claude ', '') ?? currentModel;
                      return <><span className="sm:hidden">{short.split(' ')[0]}</span><span className="hidden sm:inline">{short}</span></>;
                    })()}<ChevronDown size={14} />
                  </button>
                  {picker === 'model' && (
                    <div className="absolute bottom-11 right-0 z-30 w-72 bg-white border border-[#e4e7ec] rounded-2xl shadow-[0_24px_48px_-12px_rgba(16,24,40,0.25)] p-1.5">
                      {Object.values(STUDIO_MODELS).map(m => {
                        const allowed = planAllowsModel(plan, m.id);
                        return (
                          <button key={m.id} type="button" onClick={() => { if (!allowed) { setPicker(null); goUpgrade(); return; } setChatModel(m.id); setPicker(null); }}
                            className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-[#f2f4f7]">
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5 text-[13px] font-medium text-[#15171c]">{m.label}{m.plan === 'pro' && <span className="px-1.5 h-4 rounded bg-[#15171c] text-white text-[10px] leading-4">{t.proOnly}</span>}</span>
                              <span className="block text-[12px] text-[#727a88]">{m.blurb[lang]}</span>
                            </span>
                            {currentModel === m.id && <Check size={15} className="mt-0.5 text-[#15171c]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {streaming ? (
                  <>
                    {(text.trim() || pendingFiles.length > 0) && !queued && !text.trim().startsWith('/') && (
                      <button type="button" onClick={submit} aria-label={t.queued} title={t.queued} className="icon-btn shrink-0 w-9 h-9 min-w-[36px] rounded-full border border-[#d0d5dd] text-[#15171c] flex items-center justify-center hover:bg-[#f2f4f7]"><Clock3 size={15} /></button>
                    )}
                    <button type="button" onClick={stop} aria-label={t.stop} title={`${t.stop} (Esc)`} className="icon-btn shrink-0 w-9 h-9 min-w-[36px] rounded-full bg-[#15171c] text-white flex items-center justify-center"><Square size={13} fill="currentColor" /></button>
                  </>
                ) : (
                  <button type="button" onClick={submit} aria-label={t.send} disabled={!text.trim() && !pendingFiles.length} className="icon-btn shrink-0 w-9 h-9 min-w-[36px] rounded-full bg-[#15171c] text-white flex items-center justify-center disabled:opacity-30"><ArrowUp size={17} /></button>
                )}
              </div>
            </div>
            <p className="mt-1.5 text-center text-[11px] text-[#a3a9b4]">{t.footerNote}{code && <span className="hidden md:inline"> · {t.mentionHint} · {t.shiftTabHint}</span>}</p>
          </div>
        </div>
      </main>

      {/* Workspace (Code mode) or artifact panel */}
      {sidePanel === 'workspace' && (
        <div className="fixed inset-0 z-[250] lg:static lg:z-auto lg:w-[50%] lg:max-w-[880px] lg:min-w-[420px] lg:border-l border-[#eceef2]">
          <WorkspacePanel api={api} onClose={() => { setWorkspaceOpen(false); setWsIntent(null); }} focusPath={focusPath} onFocused={() => setFocusPath(null)} openGithub={wsIntent === 'github'} />
        </div>
      )}
      {sidePanel === 'artifact' && openArtifact && (
        <div className="fixed inset-0 z-[250] lg:static lg:z-auto lg:w-[46%] lg:max-w-[760px] lg:min-w-[380px] lg:border-l border-[#eceef2]">
          <ArtifactPanel artifact={openArtifact} t={t} streaming={streaming} onClose={() => setOpenArtifactId(null)}
            onSaveEdit={saveArtifactEdit} onRestore={restoreArtifactVersion} />
        </div>
      )}

      {/* Sandbox notice, before running code the first time */}
      {sandboxNotice && (
        <div className="fixed inset-0 z-[400] bg-[#15171c]/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={() => setSandboxNotice(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="studio-sandbox-title" onClick={e => e.stopPropagation()} className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-[0_24px_60px_-20px_rgba(16,24,40,0.35)]">
            <span className="w-10 h-10 rounded-xl bg-[#e9f7ef] text-[#0f6b45] flex items-center justify-center mb-3"><Box size={19} /></span>
            <h2 id="studio-sandbox-title" className="text-[17px] font-semibold tracking-[-0.01em]">{t.sandboxNoticeTitle}</h2>
            <p className="mt-2 text-[14px] leading-[1.55] text-[#4a505c]">{t.sandboxNoticeBody}</p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setSandboxNotice(false)} className="flex-1 h-11 rounded-xl border border-[#e4e7ec] text-[14px] hover:bg-[#f2f4f7]">{t.cancel}</button>
              <button type="button" autoFocus onClick={() => { savePrefs({ ...prefs, sandbox: true, acceptedSandboxNotice: true }); setSandboxNotice(false); }} className="flex-1 h-11 rounded-xl bg-[#15171c] text-white text-[14px] font-medium">{t.sandboxAccept}</button>
            </div>
          </div>
        </div>
      )}

      {settingsTab && <StudioSettings api={api} initialTab={settingsTab} onClose={() => setSettingsTab(null)} />}
      {projectEditor && (
        <ProjectEditor api={api} project={projectEditor.project} onClose={() => setProjectEditor(null)}
          onSaved={p => { setProjectEditor(null); setActiveProjectId(p.id); if (!projectEditor.project) newChat(p.id); }} />
      )}

      {/* Privacy notice, once per device */}
      {!prefs.acceptedPrivacy && (
        <div className="fixed inset-0 z-[400] bg-[#15171c]/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="studio-privacy-title" className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-[0_24px_60px_-20px_rgba(16,24,40,0.35)]">
            <span className="w-10 h-10 rounded-xl bg-[#fff4e5] text-[#b25e00] flex items-center justify-center mb-3"><AlertTriangle size={19} /></span>
            <h2 id="studio-privacy-title" className="text-[17px] font-semibold tracking-[-0.01em]">{t.privacyTitle}</h2>
            <p className="mt-2 text-[14px] leading-[1.55] text-[#4a505c]">{t.privacyBody}</p>
            <div className="mt-5 flex gap-2">
              {onExit && <button type="button" onClick={onExit} className="flex-1 h-11 rounded-xl border border-[#e4e7ec] text-[14px] hover:bg-[#f2f4f7]">{t.back}</button>}
              <button type="button" autoFocus onClick={() => savePrefs({ ...prefs, acceptedPrivacy: true })} className="flex-1 h-11 rounded-xl bg-[#15171c] text-white text-[14px] font-medium">{t.privacyAccept}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LedgerStudio;
