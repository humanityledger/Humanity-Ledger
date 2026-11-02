'use client';

/**
 * State and actions for Ledger Studio: conversations, projects, artifacts,
 * preferences, connectors, usage, the streaming turn, and Code mode
 * (workspace files on this device, permissions, plans, questions, todos,
 * subagents, the code sandbox and checkpoints to rewind).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createStudioStore, uid, DEFAULT_PREFS, workspaceIdFor,
  type Checkpoint, type Conversation, type DisplayMessage, type FileChangeMeta, type InteractionOutcome, type PendingInteraction,
  type Project, type ProjectFile, type StudioPrefs, type ToolActivity,
} from '@/lib/studio/store';
import type { Artifact, ArtifactSnapshot } from '@/lib/studio/artifacts';
import { toSnapshot } from '@/lib/studio/artifacts';
import {
  appendUserTurn, attachmentBlock, attachmentKind, compactHistory, dropBeforeCompaction, MAX_IMAGE_BYTES, requestBytes, trimHistory, unansweredToolUses,
} from '@/lib/studio/history';
import {
  createEventParser, MAX_HISTORY_MESSAGES, MAX_REQUEST_BYTES,
  type Effort, type PermissionMode, type ResumeResult, type StudioConnectorConfig, type StudioEvent, type StudioMode,
} from '@/lib/studio/protocol';
import { isStudioModel, STUDIO_PLANS, type StudioModelId, type StudioPlanId } from '@/lib/studio/models';
import { skillsById } from '@/lib/studio/skills';
import { resolveUiLang, STRINGS } from '@/lib/studio/i18n';
import { MAX_WS_FILES, MAX_WS_TEXT_CHARS, normalizePath, type WsFile } from '@/lib/studio/fs';
import { exportZip, importZip } from '@/lib/studio/zip';
import { changeStats, downloadBlob, fileAfterChange, mentionBlocks, mentionedPaths, projectMemoryFile, readPickedFiles, textSize } from '@/lib/studio/ws-client';
import { conversationMarkdown, markdownFileName } from '@/lib/studio/export-md';
import { CONTINUE_PROMPT } from '@/lib/studio/commands';

export interface PendingAttachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: 'image' | 'pdf' | 'text';
  /** base64 for image/pdf, text for text */
  data: string;
  previewUrl?: string;
}

export interface UsageInfo {
  configured: boolean;
  checkoutAvailable: boolean;
  usage: {
    plan: { id: StudioPlanId; label: string; dailyBudgetUsd: number; monthlyBudgetUsd: number; maxFileMb: number; maxConnectors: number };
    todayUsd: number; monthUsd: number; todayTokens: number; monthTokens: number; monthSearches: number; monthRequests: number;
    remainingTodayUsd: number; remainingMonthUsd: number; resetsDayAt: string; resetsMonthAt: string;
  };
}

/** What starts a turn. */
export type TurnInput =
  | { kind: 'message'; text: string; attachments?: PendingAttachment[]; label?: string; compact?: boolean; auto?: boolean; mode?: StudioMode }
  | { kind: 'resume'; results: ResumeResult[]; outcome: InteractionOutcome; permission?: PermissionMode };

const MAX_KNOWLEDGE_CHARS = 300_000;
const MAX_ARTIFACT_CONTEXT_CHARS = 300_000;
const MAX_AUTO_CONTINUE = 3;
const MAX_REASONING_CHARS = 40_000;
const MAX_MEMORY_CHARS = 40_000;
const MAX_CHECKPOINTS = 60;

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

const sortFiles = (m: Map<string, WsFile>) => [...m.values()].sort((a, b) => a.path.localeCompare(b.path));

export function useStudio(wallet: string) {
  const store = useMemo(() => createStudioStore(wallet), [wallet]);
  const [ready, setReady] = useState(false);
  const [prefs, setPrefsState] = useState<StudioPrefs>(DEFAULT_PREFS);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [connectors, setConnectorsState] = useState<StudioConnectorConfig[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [openArtifactId, setOpenArtifactId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [draftModel, setDraftModel] = useState<StudioModelId | null>(null);
  const [draftSkills, setDraftSkills] = useState<string[]>([]);
  const [draftMode, setDraftMode] = useState<StudioMode | null>(null);
  /** A new chat's id is known before its first message, so its workspace can be filled first. */
  const [draftId, setDraftIdState] = useState<string>(() => uid('c_'));
  const draftIdRef = useRef(draftId);
  const setDraftId = useCallback((id: string) => { draftIdRef.current = id; setDraftIdState(id); }, []);
  const [wsFiles, setWsFiles] = useState<WsFile[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  const deletedRef = useRef<Set<string>>(new Set());
  const streamingIdRef = useRef<string | null>(null);
  const streamingRef = useRef(false);
  const wsRef = useRef<{ id: string; files: Map<string, WsFile> }>({ id: '', files: new Map() });
  const autoContinueRef = useRef(0);
  const queuedRef = useRef<{ convId: string; text: string; files: PendingAttachment[] } | null>(null);
  const [queued, setQueued] = useState<{ convId: string; text: string; files: PendingAttachment[] } | null>(null);
  const runTurnRef = useRef<(input: TurnInput, convId?: string) => Promise<void>>(async () => {});

  const lang = resolveUiLang(prefs.uiLanguage);
  const t = STRINGS[lang];
  const active = conversations.find(c => c.id === activeId) ?? null;
  const plan: StudioPlanId = usage?.usage.plan.id ?? 'free';
  const mode: StudioMode = active?.mode ?? draftMode ?? prefs.defaultMode;
  const permission: PermissionMode = active?.permission ?? prefs.permission;
  const effort: Effort | 'auto' = active ? active.effort ?? 'auto' : prefs.effort;
  const wsId = active ? workspaceIdFor(active) : workspaceIdFor({ id: draftId, projectId: activeProjectId });

  // ── load ──
  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, cs, ps, cn, savedDraft] = await Promise.all([store.getPrefs(), store.listConversations(), store.listProjects(), store.getConnectors(), store.getKv<string>('draftId')]);
      if (!alive) return;
      // Keep the new chat's id across reloads, so files added before the first message are not lost.
      if (typeof savedDraft === 'string' && /^c_[\w-]{8,64}$/.test(savedDraft) && !cs.some(c => c.id === savedDraft)) setDraftId(savedDraft);
      else await store.putKv('draftId', draftIdRef.current);
      setPrefsState(p); setConversations(cs); setProjects(ps); setConnectorsState(cn); setReady(true);
    })().catch(() => setReady(true));
    return () => { alive = false; };
  }, [store]);

  const refreshUsage = useCallback(async () => {
    try {
      const r = await fetch('/api/studio/usage', { credentials: 'include', cache: 'no-store' });
      if (r.ok) setUsage(await r.json());
    } catch { /* offline */ }
  }, []);
  useEffect(() => { refreshUsage(); }, [refreshUsage]);

  useEffect(() => {
    if (!activeId) { setArtifacts([]); setCheckpoints([]); return; }
    store.listArtifacts(activeId).then(setArtifacts).catch(() => setArtifacts([]));
    store.listCheckpoints(activeId).then(setCheckpoints).catch(() => setCheckpoints([]));
  }, [activeId, store]);

  // The workspace of the open chat (or of the new chat being written).
  useEffect(() => {
    let alive = true;
    wsRef.current = { id: wsId, files: new Map() };
    setWsFiles([]);
    store.listWsFiles(wsId).then(list => {
      if (!alive || wsRef.current.id !== wsId) return;
      wsRef.current = { id: wsId, files: new Map(list.map(f => [f.path, f])) };
      setWsFiles(list);
    }).catch(() => {});
    return () => { alive = false; };
  }, [wsId, store]);

  const savePrefs = useCallback(async (p: StudioPrefs) => { setPrefsState(p); await store.putPrefs(p); }, [store]);
  const saveConnectors = useCallback(async (list: StudioConnectorConfig[]) => { setConnectorsState(list); await store.putConnectors(list); }, [store]);

  const upsertConversation = useCallback(async (c: Conversation) => {
    setConversations(prev => {
      const others = prev.filter(x => x.id !== c.id);
      return [c, ...others].sort((a, b) => (Number(!!b.pinned) - Number(!!a.pinned)) || b.updatedAt - a.updatedAt);
    });
    await store.putConversation(c);
  }, [store]);

  /** Write workspace files (null deletes) and show them if that workspace is open. */
  const commitWs = useCallback(async (id: string, writes: { path: string; file: WsFile | null }[]) => {
    if (!writes.length) return;
    await store.writeWsFiles(id, writes);
    if (wsRef.current.id === id) {
      const m = new Map(wsRef.current.files);
      for (const w of writes) { if (w.file) m.set(w.path, w.file); else m.delete(w.path); }
      wsRef.current = { id, files: m };
      setWsFiles(sortFiles(m));
    }
  }, [store]);

  /**
   * The new-chat id moves on only once a chat was created with it. An unsent
   * new chat (and any files added to it) is kept until it is used, across
   * reloads too.
   */
  const renewDraftIfUsed = useCallback(async () => {
    const old = draftIdRef.current;
    if (!(await store.getConversation(old).catch(() => undefined))) return;
    const next = uid('c_');
    setDraftId(next);
    await store.putKv('draftId', next).catch(() => {});
  }, [store, setDraftId]);

  // ── conversations ──
  const newChat = useCallback((projectId: string | null = activeProjectId) => {
    abortRef.current?.abort();
    renewDraftIfUsed();
    setActiveId(null);
    setActiveProjectId(projectId);
    setOpenArtifactId(null);
    setDraftModel(null);
    setDraftSkills([]);
  }, [activeProjectId, renewDraftIfUsed]);

  const openChat = useCallback((id: string) => {
    const c = conversations.find(x => x.id === id);
    setActiveId(id);
    setActiveProjectId(c?.projectId ?? null);
    setOpenArtifactId(null);
  }, [conversations]);
  const openChatRef = useRef(openChat);
  useEffect(() => { openChatRef.current = openChat; }, [openChat]);

  /** Save a chat as a Markdown file. */
  const exportChat = useCallback(async (id: string) => {
    const c = (await store.getConversation(id)) ?? conversations.find(x => x.id === id);
    if (!c) return;
    downloadBlob(conversationMarkdown(c, { you: t.mdYou, studio: 'Ledger Studio' }), markdownFileName(c.title), 'text/markdown;charset=utf-8');
  }, [store, conversations, t]);

  const renameChat = useCallback(async (id: string, title: string) => {
    const c = conversations.find(x => x.id === id);
    if (c) await upsertConversation({ ...c, title: title.trim().slice(0, 120) || c.title });
  }, [conversations, upsertConversation]);

  const togglePin = useCallback(async (id: string) => {
    const c = conversations.find(x => x.id === id);
    if (c) await upsertConversation({ ...c, pinned: !c.pinned });
  }, [conversations, upsertConversation]);

  const deleteChat = useCallback(async (id: string) => {
    // A turn still streaming into this chat must not write it back afterwards.
    deletedRef.current.add(id);
    if (streamingIdRef.current === id) abortRef.current?.abort();
    await store.deleteConversation(id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) { setActiveId(null); setOpenArtifactId(null); }
    // The deleted chat may have been created from the current new-chat id.
    if (draftIdRef.current === id) { const next = uid('c_'); setDraftId(next); store.putKv('draftId', next).catch(() => {}); }
  }, [activeId, store, setDraftId]);

  const setChatModel = useCallback(async (model: StudioModelId) => {
    if (active) await upsertConversation({ ...active, model });
    else setDraftModel(model);
  }, [active, upsertConversation]);

  const setChatSkills = useCallback(async (skillIds: string[]) => {
    if (active) await upsertConversation({ ...active, skillIds });
    else setDraftSkills(skillIds);
  }, [active, upsertConversation]);

  const setChatMode = useCallback(async (m: StudioMode) => {
    if (active) { await upsertConversation({ ...active, mode: m }); return; }
    setDraftMode(m);
    // New chats start in the mode chosen last (also "Start new chats in" in settings).
    if (prefs.defaultMode !== m) await savePrefs({ ...prefs, defaultMode: m });
  }, [active, upsertConversation, prefs, savePrefs]);

  const setChatPermission = useCallback(async (p: PermissionMode) => {
    if (active) await upsertConversation({ ...active, permission: p });
    else await savePrefs({ ...prefs, permission: p });
  }, [active, upsertConversation, prefs, savePrefs]);

  const setChatEffort = useCallback(async (e: Effort | 'auto') => {
    if (active) await upsertConversation({ ...active, effort: e === 'auto' ? undefined : e });
    else await savePrefs({ ...prefs, effort: e });
  }, [active, upsertConversation, prefs, savePrefs]);

  // ── projects ──
  const saveProject = useCallback(async (p: Project) => {
    await store.putProject(p);
    setProjects(prev => [p, ...prev.filter(x => x.id !== p.id)].sort((a, b) => b.updatedAt - a.updatedAt));
  }, [store]);
  const deleteProject = useCallback(async (id: string) => {
    await store.deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    setConversations(prev => prev.map(c => (c.projectId === id ? { ...c, projectId: null } : c)));
    if (activeProjectId === id) setActiveProjectId(null);
  }, [activeProjectId, store]);

  // ── artifacts ──
  const saveArtifactEdit = useCallback(async (a: Artifact, content: string) => {
    const next: Artifact = { ...a, versions: [...a.versions, { content, createdAt: Date.now(), by: 'user' }], updatedAt: Date.now() };
    await store.putArtifact(next);
    setArtifacts(prev => prev.map(x => (x.id === a.id ? next : x)));
  }, [store]);

  const restoreArtifactVersion = useCallback(async (a: Artifact, index: number) => {
    const v = a.versions[index];
    if (!v) return;
    const next: Artifact = { ...a, versions: [...a.versions, { content: v.content, createdAt: Date.now(), by: 'user', note: `restored v${index + 1}` }], updatedAt: Date.now() };
    await store.putArtifact(next);
    setArtifacts(prev => prev.map(x => (x.id === a.id ? next : x)));
  }, [store]);

  // ── workspace (the person's own edits) ──
  const wsBusy = () => streamingRef.current && streamingIdRef.current !== null;

  const wsSaveFile = useCallback(async (rawPath: string, content: string): Promise<string | null> => {
    const path = normalizePath(rawPath);
    if (!path) return t.wsBadPath;
    const cur = wsRef.current.files;
    if (!cur.has(path) && cur.size >= MAX_WS_FILES) return t.wsTooMany;
    if ([...cur.keys()].some(p => p.startsWith(`${path}/`))) return t.wsBadPath;
    const prev = cur.get(path);
    if (textSize(cur.values()) - (prev && prev.encoding !== 'base64' ? prev.content.length : 0) + content.length > MAX_WS_TEXT_CHARS) return t.wsTooLarge;
    await commitWs(wsRef.current.id, [{ path, file: { path, content, encoding: 'utf8', size: content.length, updatedAt: Date.now() } }]);
    return null;
  }, [commitWs, t]);

  const wsDeleteFile = useCallback(async (path: string) => {
    await commitWs(wsRef.current.id, [{ path, file: null }]);
  }, [commitWs]);

  const wsRenameFile = useCallback(async (from: string, rawTo: string): Promise<string | null> => {
    const to = normalizePath(rawTo);
    const f = wsRef.current.files.get(from);
    if (!to || !f) return t.wsBadPath;
    if (to === from) return null;
    if (wsRef.current.files.has(to)) return t.wsExists;
    await commitWs(wsRef.current.id, [{ path: to, file: { ...f, path: to, updatedAt: Date.now() } }, { path: from, file: null }]);
    return null;
  }, [commitWs, t]);

  /** Add files (same paths are replaced). Returns how many were added and skipped. */
  const wsAddFiles = useCallback(async (files: WsFile[], skippedBefore = 0): Promise<{ added: number; skipped: number }> => {
    const cur = new Map(wsRef.current.files);
    let skipped = skippedBefore;
    const writes: { path: string; file: WsFile }[] = [];
    for (const f of files) {
      if (!cur.has(f.path) && cur.size >= MAX_WS_FILES) { skipped++; continue; }
      cur.set(f.path, f);
      writes.push({ path: f.path, file: f });
    }
    if (textSize(cur.values()) > MAX_WS_TEXT_CHARS) return { added: 0, skipped: files.length + skippedBefore };
    await commitWs(wsRef.current.id, writes);
    return { added: writes.length, skipped };
  }, [commitWs]);

  const wsImportPicked = useCallback(async (list: FileList | File[]) => {
    const r = await readPickedFiles(list);
    return wsAddFiles(r.files, r.skipped.length);
  }, [wsAddFiles]);

  const wsImportZip = useCallback(async (file: File) => {
    const r = importZip(new Uint8Array(await file.arrayBuffer()));
    return wsAddFiles(r.files, r.skipped.length);
  }, [wsAddFiles]);

  const wsExportZip = useCallback((name: string) => {
    const data = exportZip(sortFiles(wsRef.current.files));
    downloadBlob(data as BlobPart, `${name.replace(/[^\w.-]+/g, '-').slice(0, 60) || 'workspace'}.zip`, 'application/zip');
  }, []);

  const wsClear = useCallback(async () => {
    const id = wsRef.current.id;
    await store.clearWs(id);
    if (wsRef.current.id === id) { wsRef.current = { id, files: new Map() }; setWsFiles([]); }
  }, [store]);

  // ── attachments ──
  const prepareFiles = useCallback(async (files: FileList | File[]): Promise<{ ok: PendingAttachment[]; rejected: { name: string; reason: string }[] }> => {
    const maxBytes = (usage?.usage.plan.maxFileMb ?? STUDIO_PLANS.free.maxFileMb) * 1024 * 1024;
    const ok: PendingAttachment[] = [];
    const rejected: { name: string; reason: string }[] = [];
    for (const f of Array.from(files).slice(0, 10)) {
      const kind = attachmentKind(f.name, f.type || '');
      if (kind === 'unsupported') { rejected.push({ name: f.name, reason: t.fileUnsupported }); continue; }
      const limit = kind === 'image' ? Math.min(maxBytes, MAX_IMAGE_BYTES) : maxBytes;
      if (f.size > limit) { rejected.push({ name: f.name, reason: `${t.fileTooLarge} (${Math.round(limit / 1024 / 1024)} MB)` }); continue; }
      const data = kind === 'text' ? await f.text() : await readAsBase64(f);
      ok.push({ id: uid('f_'), name: f.name, mime: f.type || (kind === 'pdf' ? 'application/pdf' : 'text/plain'), size: f.size, kind, data, previewUrl: kind === 'image' ? URL.createObjectURL(f) : undefined });
    }
    return { ok, rejected };
  }, [t, usage]);

  // ── the turn ──
  const stop = useCallback(() => { autoContinueRef.current = MAX_AUTO_CONTINUE; abortRef.current?.abort(); }, []);

  const runTurn = useCallback(async (input: TurnInput, convId?: string) => {
    if (streamingRef.current) {
      // The previous turn of this chat is still being saved: send this right after it.
      const busy = streamingIdRef.current;
      if (input.kind === 'message' && !input.auto && !input.label && busy && (convId ?? activeIdRef.current) === busy && !queuedRef.current) {
        const q = { convId: busy, text: input.text, files: input.attachments ?? [] };
        queuedRef.current = q;
        setQueued(q);
      }
      return;
    }
    const isMessage = input.kind === 'message';
    const prompt = isMessage ? input.text.trim() : '';
    const attachments = isMessage ? input.attachments ?? [] : [];
    if (isMessage && !prompt && !attachments.length) return;
    if (isMessage && !input.auto) autoContinueRef.current = 0;
    streamingRef.current = true;

    const now = Date.now();
    // The conversation as stored (a turn may start right after another one ended).
    const stored = convId ? await store.getConversation(convId) : active ? await store.getConversation(active.id) ?? active : undefined;
    if (convId && !stored) { streamingRef.current = false; return; }
    const project = projects.find(p => p.id === (stored?.projectId ?? activeProjectId)) ?? null;
    let conv: Conversation = stored ?? {
      id: draftId,
      projectId: project?.id ?? null,
      title: (prompt || attachments[0]?.name || t.newChat).slice(0, 60),
      model: draftModel ?? prefs.defaultModel,
      skillIds: draftSkills.length ? draftSkills : [...(project?.skillIds ?? [])],
      createdAt: now, updatedAt: now, messages: [], apiMessages: [], totalCostUsd: 0, totalTokens: 0,
      mode: draftMode ?? prefs.defaultMode,
      permission: prefs.permission,
      effort: prefs.effort === 'auto' ? undefined : prefs.effort,
    };
    if (isMessage && input.mode && conv.mode !== input.mode) conv = { ...conv, mode: input.mode };
    if (input.kind === 'resume' && !conv.pending) { streamingRef.current = false; return; }
    const code = conv.mode === 'code';
    const isFirst = conv.messages.length === 0;
    const priorApi = conv.apiMessages;
    const priorDisplayLength = conv.messages.length;
    const convWsId = workspaceIdFor(conv);

    // ── the user's side of the turn ──
    let apiWithUser = conv.apiMessages;
    let userMsg: DisplayMessage | null = null;
    let checkpoint: Checkpoint | null = null;
    const pending = conv.pending ?? null;
    const messagesBefore = conv.messages.map(m => {
      if (!pending || m.id !== pending.messageId) return m;
      if (input.kind === 'resume') return { ...m, waiting: undefined, outcome: input.outcome };
      return { ...m, waiting: undefined, outcome: { kind: pending.kind, summary: t.codeSkipped } };
    });
    if (isMessage) {
      const blocks: any[] = [];
      // A turn waiting for the user that gets a new message instead: every
      // waiting call still needs an answer, or the API rejects the history.
      for (const id of unansweredToolUses(conv.apiMessages)) {
        blocks.push({ type: 'tool_result', tool_use_id: id, is_error: true, content: 'The user did not answer this and sent a new message instead.' });
      }
      blocks.push(...attachments.map(a => attachmentBlock(a.kind, a.name, a.mime, a.data)));
      // "@path" mentions: the files' current contents go with the prompt.
      if (code && prompt.includes('@')) {
        const wsNow = new Map((await store.listWsFiles(convWsId)).map(f => [f.path, f] as const));
        blocks.push(...mentionBlocks(wsNow, mentionedPaths(prompt, wsNow.keys())));
      }
      if (prompt) blocks.push({ type: 'text', text: prompt });
      const last = conv.apiMessages[conv.apiMessages.length - 1];
      checkpoint = code ? {
        id: uid('cp_'), convId: conv.id, wsId: convWsId, messageId: '', createdAt: now,
        displayLength: priorDisplayLength,
        apiLength: conv.apiMessages.length,
        apiTail: last?.role === 'user' ? (typeof last.content === 'string' ? 1 : last.content.length) : null,
        before: {},
      } : null;
      userMsg = {
        id: uid('m_'), role: 'user', text: input.label ? '' : prompt, label: input.label, createdAt: now,
        attachments: attachments.map(a => ({ name: a.name, mime: a.mime, size: a.size })), checkpointId: checkpoint?.id,
      };
      if (checkpoint) checkpoint.messageId = userMsg.id;
      apiWithUser = appendUserTurn(conv.apiMessages, blocks);
    } else {
      // Changes made while resuming belong to the turn that started it.
      const cps = await store.listCheckpoints(conv.id);
      checkpoint = cps[cps.length - 1] ?? null;
    }

    const assistantId = uid('m_');
    const assistantMsg: DisplayMessage = { id: assistantId, role: 'assistant', text: '', createdAt: now, tools: [], citations: [], artifactIds: [], model: conv.model };
    const permissionForTurn: PermissionMode =
      input.kind === 'resume' ? (pending?.kind === 'approval' ? 'ask' : input.permission ?? conv.permission ?? 'ask') : conv.permission ?? 'ask';
    conv = {
      ...conv,
      messages: [...messagesBefore, ...(userMsg ? [userMsg] : []), assistantMsg],
      apiMessages: apiWithUser,
      pending: null,
      permission: input.kind === 'resume' && input.permission ? input.permission : conv.permission,
      updatedAt: now,
    };
    setActiveId(conv.id);
    activeIdRef.current = conv.id;
    await upsertConversation(conv);

    // ── context ──
    const files: ProjectFile[] = project ? await store.listFiles(project.id) : [];
    let budget = MAX_KNOWLEDGE_CHARS;
    const knowledge = files.slice(0, 30).flatMap(f => {
      if (budget <= 0) return [];
      const text = f.text.slice(0, budget);
      budget -= text.length;
      return [{ name: f.name, text }];
    });
    const skillMap = skillsById(prefs.customSkills);
    const skillIds = Array.from(new Set([...(conv.skillIds ?? []), ...(project?.skillIds ?? [])]));
    const skills = skillIds.map(id => skillMap.get(id)).filter(Boolean).slice(0, 12).map(s => ({ id: s!.id, name: s!.name, instructions: s!.instructions }));
    const currentArtifacts = code ? [] : conv.id === activeIdRef.current && conv.id === activeId ? artifacts : await store.listArtifacts(conv.id);
    let aBudget = MAX_ARTIFACT_CONTEXT_CHARS;
    const snapshots: ArtifactSnapshot[] = [...currentArtifacts].sort((a, b) => b.updatedAt - a.updatedAt).flatMap(a => {
      const s = toSnapshot(a);
      if (s.content.length > aBudget) return [];
      aBudget -= s.content.length;
      return [s];
    }).slice(0, 40);

    // The workspace as stored now (the authoritative copy is on this device).
    const turnFiles = new Map<string, WsFile>(code ? (await store.listWsFiles(convWsId)).map(f => [f.path, f]) : []);
    const memoryFile = projectMemoryFile(turnFiles.values());
    const memory = [prefs.memory.trim() && `# Personal memory\n${prefs.memory.trim()}`, memoryFile?.content.trim() && `# ${memoryFile.path}\n${memoryFile.content.trim()}`]
      .filter(Boolean).join('\n\n').slice(0, MAX_MEMORY_CHARS);
    const effortForTurn = conv.effort;

    const payload: Record<string, unknown> = {
      model: isStudioModel(conv.model) ? conv.model : prefs.defaultModel,
      messages: trimHistory(compactHistory(apiWithUser), MAX_HISTORY_MESSAGES),
      personalization: prefs.personalization,
      project: project ? { name: project.name, instructions: project.instructions, knowledge } : undefined,
      skills,
      artifacts: snapshots,
      tools: { webSearch: prefs.webSearch, webFetch: prefs.webFetch },
      connectors: connectors.filter(c => c.enabled),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...(effortForTurn ? { effort: effortForTurn } : {}),
      ...(code ? {
        mode: 'code',
        permission: permissionForTurn,
        workspace: {
          files: [...turnFiles.values()].filter(f => f.encoding !== 'base64').map(f => ({ path: f.path, content: f.content })),
          binaries: [...turnFiles.values()].filter(f => f.encoding === 'base64').map(f => ({ path: f.path, size: f.size })),
        },
        memory: memory || undefined,
        todos: conv.todos ?? [],
        sandbox: prefs.sandbox ? { enabled: true, containerId: conv.containerId } : undefined,
        agents: prefs.customAgents.slice(0, 20),
        rules: { allow: (prefs.rules?.allow ?? []).slice(0, 50), deny: (prefs.rules?.deny ?? []).slice(0, 50) },
        resume: input.kind === 'resume' ? { results: input.results } : undefined,
      } : {}),
    };

    let current: Conversation = conv;
    const gone = () => deletedRef.current.has(conv.id);
    const patchAssistant = (fn: (m: DisplayMessage) => DisplayMessage) => {
      current = { ...current, messages: current.messages.map(m => (m.id === assistantId ? fn(m) : m)) };
      if (!gone()) setConversations(prev => prev.map(c => (c.id === current.id ? current : c)));
    };
    const patchConv = (fn: (c: Conversation) => Conversation) => {
      current = fn(current);
      if (!gone()) setConversations(prev => prev.map(c => (c.id === current.id ? current : c)));
    };
    const persist = async () => { if (!gone()) await store.putConversation(current); };
    const fail = (code_: string, message: string) => patchAssistant(m => ({ ...m, error: { code: code_, message } }));

    if (code && textSize(turnFiles.values()) > MAX_WS_TEXT_CHARS) {
      fail('TOO_LARGE', t.wsTooLarge);
      current = { ...current, apiMessages: priorApi, pending };
      await persist();
      streamingRef.current = false;
      return;
    }
    if (requestBytes(payload) > MAX_REQUEST_BYTES) {
      fail('TOO_LARGE', t.errTooLarge);
      // This prompt never reached Studio: keep it out of the API history.
      current = { ...current, apiMessages: priorApi, pending };
      await persist();
      streamingRef.current = false;
      return;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    streamingIdRef.current = conv.id;
    setStreaming(true);
    let producedMessages: any[] | null = null;
    let localArtifacts = [...currentArtifacts];
    let compacted = false;
    let notice: DisplayMessage['notice'];
    let errored = false;

    const recordFile = async (change: Extract<StudioEvent, { type: 'file' }>['change'], parent?: string) => {
      const before = turnFiles.get(change.path) ?? null;
      const after = fileAfterChange(turnFiles, change);
      if (checkpoint && !(change.path in checkpoint.before)) {
        checkpoint.before[change.path] = before ? { content: before.content, encoding: before.encoding === 'base64' ? 'base64' : 'utf8' } : null;
      }
      if (after) turnFiles.set(change.path, after); else turnFiles.delete(change.path);
      if (gone()) return;
      await commitWs(convWsId, [{ path: change.path, file: after }]);
      // Lines changed this turn, against the file as it was before the turn.
      const orig = checkpoint?.before[change.path];
      const origFile: WsFile | null = orig ? { path: change.path, content: orig.content, encoding: orig.encoding, size: orig.content.length, updatedAt: 0 } : null;
      const st = changeStats(origFile, after);
      const op: FileChangeMeta['op'] = !after ? 'delete' : change.from ? 'move' : origFile ? 'update' : 'create';
      patchAssistant(m => {
        const list = (m.fileChanges ?? []).filter(x => x.path !== change.path);
        if (!origFile && !after) return { ...m, fileChanges: list };
        return { ...m, fileChanges: [...list, { path: change.path, op, added: st.added, removed: st.removed, parent }] };
      });
    };

    const onEvent = async (e: StudioEvent) => {
      switch (e.type) {
        case 'text':
          patchAssistant(m => ({ ...m, text: m.text + e.delta }));
          break;
        case 'reasoning':
          patchAssistant(m => ((m.reasoning?.length ?? 0) >= MAX_REASONING_CHARS ? m : { ...m, reasoning: ((m.reasoning ?? '') + e.delta).slice(0, MAX_REASONING_CHARS) }));
          break;
        case 'tool':
          patchAssistant(m => {
            const tools = [...(m.tools ?? [])];
            const i = tools.findIndex(x => x.id === e.id);
            const prev = i >= 0 ? tools[i] : undefined;
            const next: ToolActivity = {
              id: e.id,
              name: e.name === 'mcp' && prev ? prev.name : e.name,
              server: e.server ?? prev?.server,
              status: e.status,
              // Keep the query or URL once known; result counts do not replace it.
              detail: prev?.detail || e.detail,
              parent: e.parent ?? prev?.parent,
            };
            if (i >= 0) tools[i] = next; else tools.push(next);
            return { ...m, tools: tools.slice(-300) };
          });
          break;
        case 'thinking':
          if (e.label === 'artifact') {
            patchAssistant(m => ({ ...m, tools: [...(m.tools ?? []), { id: uid('art_'), name: 'artifact', status: 'running' }] }));
          }
          break;
        case 'citation':
          if (!/^https:\/\//i.test(e.url)) break; // links are rendered as <a href>
          patchAssistant(m => (m.citations?.some(c => c.url === e.url) ? m : { ...m, citations: [...(m.citations ?? []), { url: e.url, title: e.title, citedText: e.citedText }] }));
          break;
        case 'artifact': {
          const snap = e.artifact;
          const existing = localArtifacts.find(a => a.id === snap.id);
          const ts = Date.now();
          const next: Artifact = existing
            ? { ...existing, title: snap.title, type: snap.type as any, language: snap.language, versions: [...existing.versions, { content: snap.content, createdAt: ts, by: 'studio' }], updatedAt: ts }
            : { id: snap.id, title: snap.title, type: snap.type as any, language: snap.language, conversationId: current.id, projectId: current.projectId, versions: [{ content: snap.content, createdAt: ts, by: 'studio' }], createdAt: ts, updatedAt: ts };
          localArtifacts = existing ? localArtifacts.map(a => (a.id === next.id ? next : a)) : [...localArtifacts, next];
          if (gone()) break;
          if (activeIdRef.current === current.id) setArtifacts(localArtifacts);
          await store.putArtifact(next);
          patchAssistant(m => {
            const tools = [...(m.tools ?? [])];
            const k = tools.findIndex(x => x.name === 'artifact' && x.status === 'running');
            if (k >= 0) tools[k] = { ...tools[k], status: 'done', detail: next.title };
            return { ...m, tools, artifactIds: m.artifactIds?.includes(next.id) ? m.artifactIds : [...(m.artifactIds ?? []), next.id] };
          });
          if (activeIdRef.current === current.id) setOpenArtifactId(next.id);
          break;
        }
        case 'file':
          if (code) await recordFile(e.change, e.parent);
          break;
        case 'todos':
          patchConv(c => ({ ...c, todos: e.todos }));
          break;
        case 'approval':
        case 'plan':
        case 'question': {
          const p: PendingInteraction = e.type === 'approval'
            ? { kind: 'approval', messageId: assistantId, calls: e.calls }
            : e.type === 'plan'
              ? { kind: 'plan', messageId: assistantId, id: e.id, plan: e.plan }
              : { kind: 'question', messageId: assistantId, id: e.id, question: e.question, options: e.options };
          patchConv(c => ({ ...c, pending: p }));
          patchAssistant(m => ({ ...m, waiting: p.kind }));
          break;
        }
        case 'subagent':
          patchAssistant(m => {
            const list = [...(m.subagents ?? [])];
            const i = list.findIndex(s => s.id === e.id);
            const next = { id: e.id, name: e.name, description: e.description, status: e.phase === 'end' ? 'done' as const : 'running' as const, summary: e.summary };
            if (i >= 0) list[i] = next; else list.push(next);
            return { ...m, subagents: list };
          });
          break;
        case 'container':
          patchConv(c => ({ ...c, containerId: e.id }));
          break;
        case 'compacted':
          compacted = true;
          patchAssistant(m => ({ ...m, compacted: true }));
          break;
        case 'messages':
          producedMessages = e.messages;
          break;
        case 'usage':
          patchAssistant(m => ({ ...m, costUsd: (m.costUsd ?? 0) + e.costUsd }));
          current = {
            ...current,
            totalCostUsd: current.totalCostUsd + e.costUsd,
            totalTokens: current.totalTokens + e.inputTokens + e.outputTokens,
            ...(e.contextTokens ? { contextTokens: e.contextTokens } : {}),
          };
          break;
        case 'error':
          errored = true;
          fail(e.code, e.message);
          break;
        case 'notice':
          notice = e.code;
          patchAssistant(m => ({ ...m, notice: e.code }));
          break;
        default:
          break;
      }
    };

    try {
      const res = await fetch('/api/studio/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        errored = true;
        const j = await res.json().catch(() => ({}));
        if (res.status === 401) fail('NO_SESSION', t.sessionExpired);
        else fail(typeof j.error === 'string' && /^[A-Z_]+$/.test(j.error) ? j.error : `HTTP_${res.status}`, j.message || t.error);
      } else {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        const queue: StudioEvent[] = [];
        const parser = createEventParser(ev => queue.push(ev));
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          parser.push(dec.decode(value, { stream: true }));
          while (queue.length) await onEvent(queue.shift()!);
        }
        parser.flush();
        while (queue.length) await onEvent(queue.shift()!);
      }
    } catch (err: any) {
      errored = true;
      if (err?.name !== 'AbortError') fail('NETWORK', t.error);
    } finally {
      setStreaming(false);
      abortRef.current = null;
      // Keep the API history consistent: append exactly what the server produced.
      if (producedMessages && (producedMessages as any[]).length) {
        let api = [...apiWithUser, ...(producedMessages as any[])];
        if (compacted) api = dropBeforeCompaction(api);
        current = { ...current, apiMessages: api, ...(compacted ? { compactedAt: Date.now() } : {}) };
      } else {
        // Nothing usable came back: drop this user turn from the API history so
        // the next turn is not merged with a prompt that failed. Whatever the
        // turn was waiting for is still waiting.
        current = { ...current, apiMessages: priorApi };
        if (pending && !current.pending) {
          current = {
            ...current,
            pending,
            messages: current.messages.map(m => (m.id === pending.messageId ? { ...m, waiting: pending.kind, outcome: undefined } : m)),
          };
        }
      }
      // /compact: the summary replaces the history.
      if (isMessage && input.compact && producedMessages && !errored) {
        const summary = current.messages.find(m => m.id === assistantId)?.text.trim();
        if (summary) current = { ...current, apiMessages: [{ role: 'user', content: [{ type: 'text', text: `[Summary of the conversation so far]\n${summary}` }] }], compactedAt: Date.now(), contextTokens: undefined };
      }
      // Tell the person when a turn they are not watching ends or needs them.
      if (prefs.notify && !gone() && !ctrl.signal.aborted && typeof document !== 'undefined' && document.hidden) {
        try {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const body = current.pending ? t.notifyWaiting : errored ? t.notifyFailed : t.notifyDone;
            const n = new Notification(current.title || 'Ledger Studio', { body, tag: `studio-${current.id}`, icon: '/favicon.ico' });
            const id = current.id;
            n.onclick = () => { window.focus(); openChatRef.current(id); n.close(); };
          }
        } catch { /* notifications are optional */ }
      }
      // Nothing is still running once the stream has ended.
      patchAssistant(m => (m.tools?.some(x => x.status === 'running') || m.subagents?.some(s => s.status === 'running')
        ? {
            ...m,
            tools: m.tools?.map(x => (x.status === 'running' ? { ...x, status: ctrl.signal.aborted ? 'error' : 'done' } : x)),
            subagents: m.subagents?.map(s => (s.status === 'running' ? { ...s, status: 'done' } : s)),
          }
        : m));
      current = { ...current, updatedAt: Date.now() };
      if (!gone()) setConversations(prev => prev.map(c => (c.id === current.id ? current : c)));
      try {
        await persist();
        // Save the checkpoint (a resumed turn adds to the one that started it).
        if (checkpoint && !gone() && (isMessage || Object.keys(checkpoint.before).length)) {
          await store.putCheckpoint(checkpoint).catch(() => {});
          const all = await store.listCheckpoints(current.id).catch(() => [] as Checkpoint[]);
          if (all.length > MAX_CHECKPOINTS) await store.deleteCheckpoints(all.slice(0, all.length - MAX_CHECKPOINTS).map(c => c.id)).catch(() => {});
          if (activeIdRef.current === current.id) setCheckpoints(all.slice(-MAX_CHECKPOINTS));
        }
      } finally {
        // Only now can the next turn start: it reads this chat back from storage.
        streamingRef.current = false;
        streamingIdRef.current = null;
      }
      refreshUsage();
      if (isFirst && producedMessages && !gone()) {
        const id = current.id;
        const fallbackTitle = current.title;
        void (async () => {
          try {
            const r = await fetch('/api/studio/title', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: prompt.slice(0, 2000) || attachments.map(a => a.name).join(', ') }) });
            const j = await r.json().catch(() => ({}));
            if (!j?.title || deletedRef.current.has(id)) return;
            const title = String(j.title).slice(0, 120);
            // Change only the title: a later turn may already have saved this chat.
            const latest = await store.getConversation(id);
            if (!latest || latest.title !== fallbackTitle) return;
            const next = { ...latest, title };
            await store.putConversation(next);
            setConversations(prev => prev.map(c => (c.id === id ? { ...c, title } : c)));
          } catch { /* keep the provisional title */ }
        })();
      }
      // What runs next on its own: a message queued while this one streamed,
      // or (for long tasks) the continuation after the time or step limit.
      const q = queuedRef.current;
      const canContinue = code && prefs.autoContinue && !errored && !ctrl.signal.aborted && !current.pending && (notice === 'TIME_LIMIT' || notice === 'STEP_LIMIT');
      if (q && q.convId === current.id && !current.pending && !gone()) {
        queuedRef.current = null;
        setQueued(null);
        const id = current.id;
        setTimeout(() => { runTurnRef.current({ kind: 'message', text: q.text, attachments: q.files }, id); }, 250);
      } else if (canContinue && autoContinueRef.current < MAX_AUTO_CONTINUE && !gone()) {
        autoContinueRef.current++;
        const id = current.id;
        setTimeout(() => { runTurnRef.current({ kind: 'message', text: CONTINUE_PROMPT, label: 'continue', auto: true }, id); }, 400);
      }
    }
  }, [projects, active, activeProjectId, t, draftModel, draftSkills, draftMode, draftId, prefs, upsertConversation, store, activeId, artifacts, connectors, refreshUsage, commitWs]);
  useEffect(() => { runTurnRef.current = runTurn; }, [runTurn]);

  const send = useCallback((text: string, attachments: PendingAttachment[] = [], opts: { label?: string; compact?: boolean; mode?: StudioMode } = {}) =>
    runTurn({ kind: 'message', text, attachments, ...opts }), [runTurn]);

  /** Keep one message to send as soon as the running turn of this chat ends. */
  const queueMessage = useCallback((text: string, attachments: PendingAttachment[] = []): boolean => {
    const convId = streamingIdRef.current;
    if (!convId || queuedRef.current || (!text.trim() && !attachments.length)) return false;
    const q = { convId, text, files: attachments };
    queuedRef.current = q;
    setQueued(q);
    return true;
  }, []);
  /** Take the queued message back (returned so it can go back in the composer). */
  const cancelQueued = useCallback(() => {
    const q = queuedRef.current;
    queuedRef.current = null;
    setQueued(null);
    return q;
  }, []);

  /** Answer what a Code mode turn is waiting for, and continue it. */
  const answeredRef = useRef<Set<string>>(new Set());
  const respond = useCallback((results: ResumeResult[], outcome: InteractionOutcome, permissionAfter?: PermissionMode) => {
    const p = active?.pending;
    if (!p || streamingRef.current) return Promise.resolve();
    // One answer per waiting turn: a double click (or a repeated key press) must not resume it twice.
    const key = `${active!.id}:${p.messageId}`;
    if (answeredRef.current.has(key)) return Promise.resolve();
    answeredRef.current.add(key);
    return runTurn({ kind: 'resume', results, outcome, permission: permissionAfter }, active!.id)
      .finally(() => {
        // If the resume did not go through (offline, error), the turn is still waiting: allow answering again.
        store.getConversation(active!.id).then(c => { if (c?.pending?.messageId === p.messageId) answeredRef.current.delete(key); }).catch(() => {});
      });
  }, [active, runTurn, store]);

  // ── checkpoints ──
  /**
   * Go back to before a turn: its file changes and every later one are
   * undone ("code"), the conversation is cut there ("conversation"), or both.
   * Returns the prompt of that turn so it can be edited and sent again.
   */
  const rewind = useCallback(async (checkpointId: string, what: 'code' | 'conversation' | 'both'): Promise<string | null> => {
    if (!active || streamingRef.current) return null;
    const list = await store.listCheckpoints(active.id);
    const idx = list.findIndex(c => c.id === checkpointId);
    if (idx < 0) return null;
    const later = list.slice(idx);
    if (what !== 'conversation') {
      // Apply the oldest "before" last, so each file ends as it was before that turn.
      const writes = new Map<string, { path: string; file: WsFile | null }>();
      for (const cp of [...later].reverse()) {
        for (const [path, b] of Object.entries(cp.before)) {
          writes.set(`${cp.wsId}\u0000${path}`, { path, file: b ? { path, content: b.content, encoding: b.encoding, size: b.encoding === 'base64' ? Math.floor(b.content.length * 0.75) : b.content.length, updatedAt: Date.now() } : null });
        }
      }
      const byWs = new Map<string, { path: string; file: WsFile | null }[]>();
      for (const [key, w] of writes) {
        const ws = key.split('\u0000')[0];
        byWs.set(ws, [...(byWs.get(ws) ?? []), w]);
      }
      for (const [ws, ws_writes] of byWs) await commitWs(ws, ws_writes);
    }
    const cp = list[idx];
    const userText = active.messages.find(m => m.id === cp.messageId)?.text ?? null;
    if (what !== 'code') {
      const compactedAt = active.compactedAt;
      let api = active.apiMessages;
      if (!compactedAt || compactedAt < cp.createdAt) {
        api = api.slice(0, cp.apiLength);
        const tail = cp.apiTail;
        const last = api[api.length - 1];
        if (typeof tail === 'number' && last?.role === 'user') {
          const content = typeof last.content === 'string' ? [{ type: 'text', text: last.content }] : last.content;
          api = [...api.slice(0, -1), { ...last, content: content.slice(0, tail) }];
        }
      } else {
        // The history was summarized after this point: start the API side over.
        api = [];
      }
      const next: Conversation = { ...active, messages: active.messages.slice(0, cp.displayLength), apiMessages: api, pending: null, todos: [], updatedAt: Date.now() };
      await upsertConversation(next);
      await store.deleteCheckpoints(later.map(c => c.id));
      setCheckpoints(list.slice(0, idx));
    }
    return userText;
  }, [active, store, commitWs, upsertConversation]);

  /**
   * Put one file back as it was before this chat first changed it (the
   * oldest checkpoint that recorded it). The conversation is not touched.
   */
  const revertFile = useCallback(async (path: string): Promise<boolean> => {
    if (!active || streamingRef.current) return false;
    const list = await store.listCheckpoints(active.id);
    const first = list.find(cp => path in cp.before);
    if (!first) return false;
    const b = first.before[path];
    await commitWs(first.wsId, [{
      path,
      file: b ? { path, content: b.content, encoding: b.encoding, size: b.encoding === 'base64' ? Math.floor(b.content.length * 0.75) : b.content.length, updatedAt: Date.now() } : null,
    }]);
    return true;
  }, [active, store, commitWs]);

  const startCheckout = useCallback(async (action?: 'portal') => {
    const r = await fetch('/api/studio/checkout', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(action ? { action } : {}) });
    const j = await r.json().catch(() => ({}));
    // Only ever leave for Stripe's own checkout or billing pages.
    let ok = false;
    try {
      const u = new URL(String(j?.url));
      ok = u.protocol === 'https:' && (u.hostname === 'checkout.stripe.com' || u.hostname === 'billing.stripe.com');
    } catch { ok = false; }
    if (ok) window.location.assign(j.url);
    return (ok ? j : { ...j, url: undefined }) as { url?: string; message?: string; error?: string };
  }, []);

  return {
    ready, t, lang, store, prefs, savePrefs, conversations, projects, connectors, saveConnectors,
    active, activeId, activeProjectId, setActiveProjectId, artifacts, openArtifactId, setOpenArtifactId,
    streaming, usage, plan, refreshUsage, draftModel, draftSkills,
    newChat, openChat, renameChat, togglePin, deleteChat, setChatModel, setChatSkills,
    saveProject, deleteProject, saveArtifactEdit, restoreArtifactVersion, prepareFiles, send, stop, startCheckout,
    // Code mode
    mode, setChatMode, permission, setChatPermission, effort, setChatEffort,
    wsId, wsFiles, wsSaveFile, wsDeleteFile, wsRenameFile, wsAddFiles, wsImportPicked, wsImportZip, wsExportZip, wsClear,
    checkpoints, rewind, respond, isWsBusy: wsBusy, revertFile, exportChat,
    queued, queueMessage, cancelQueued,
  };
}

export type StudioApi = ReturnType<typeof useStudio>;
