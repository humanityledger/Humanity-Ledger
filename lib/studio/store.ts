'use client';

/**
 * Ledger Studio storage on the device (IndexedDB, one database per wallet).
 *
 * Conversations, projects, artifacts and project files never live on
 * Humanity Ledger's servers. Connector tokens go to the encrypted vault.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { Artifact } from './artifacts';
import type { CustomAgent, Effort, PermissionMode, StudioConnectorConfig, StudioMode, StudioPersonalization, TodoItem } from './protocol';
import type { StudioSkill } from './skills';
import type { StudioModelId } from './models';
import type { WsFile } from './fs';
import type { GitLink } from './github';

export interface ToolActivity {
  id: string;
  name: string;
  server?: string;
  status: 'running' | 'done' | 'error';
  detail?: string;
  /** Set when a subagent ran this tool. */
  parent?: string;
}

/** A file this answer changed (the content itself lives in the workspace and the checkpoint). */
export interface FileChangeMeta {
  path: string;
  op: 'create' | 'update' | 'delete' | 'move';
  added: number;
  removed: number;
  parent?: string;
}

export interface SubagentActivity {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'done';
  summary?: string;
}

/** What a Code mode turn is waiting for. */
export type PendingInteraction =
  | { kind: 'approval'; messageId: string; calls: { id: string; name: string; input: any }[] }
  | { kind: 'plan'; messageId: string; id: string; plan: string }
  | { kind: 'question'; messageId: string; id: string; question: string; options?: string[] };

/** How the user answered a pending interaction (shown on the message). */
export interface InteractionOutcome {
  kind: PendingInteraction['kind'];
  summary: string;
}

/** Workspace contents before a turn changed them, to rewind. */
export interface Checkpoint {
  id: string;
  convId: string;
  wsId: string;
  /** The user message that started the turn. */
  messageId: string;
  createdAt: number;
  /** Lengths of the histories before the turn (to rewind the conversation). */
  displayLength: number;
  apiLength: number;
  /** When the turn's prompt was merged into a trailing user message: that message's block count before. */
  apiTail: number | null;
  /** path → content before the turn (null: the file did not exist). */
  before: Record<string, { content: string; encoding: 'utf8' | 'base64' } | null>;
}

export interface CustomCommand {
  id: string;
  /** Typed as /name. */
  name: string;
  description: string;
  /** The prompt; $ARGUMENTS is replaced by what follows the command. */
  template: string;
}

export interface Citation {
  url: string;
  title?: string;
  citedText?: string;
}

export interface AttachmentMeta {
  name: string;
  mime: string;
  size: number;
}

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
  tools?: ToolActivity[];
  citations?: Citation[];
  artifactIds?: string[];
  attachments?: AttachmentMeta[];
  error?: { code: string; message: string };
  model?: string;
  costUsd?: number;
  /** Why the answer ended early (see StudioEvent "notice"). */
  notice?: 'MAX_TOKENS' | 'REFUSAL' | 'BUDGET' | 'TIME_LIMIT' | 'STEP_LIMIT' | 'SYNC_FAILED';
  // ── Code mode ──
  reasoning?: string;
  fileChanges?: FileChangeMeta[];
  subagents?: SubagentActivity[];
  /** The turn stopped here for the user (approval, plan or question). */
  waiting?: PendingInteraction['kind'];
  outcome?: InteractionOutcome;
  compacted?: boolean;
  /** Set on user messages that have a checkpoint to rewind to. */
  checkpointId?: string;
  /** Hidden prompt (auto-continue, slash commands): shown as a short label. */
  label?: string;
}

export interface Conversation {
  id: string;
  projectId: string | null;
  title: string;
  model: StudioModelId;
  skillIds: string[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  messages: DisplayMessage[];
  /** Exact history for the API (assistant blocks returned verbatim). */
  apiMessages: { role: 'user' | 'assistant'; content: any }[];
  totalCostUsd: number;
  totalTokens: number;
  // ── Code mode ──
  mode?: StudioMode;
  permission?: PermissionMode;
  effort?: Effort;
  todos?: TodoItem[];
  /** The code sandbox container this chat reuses. */
  containerId?: string;
  pending?: PendingInteraction | null;
  /** When the API history was last summarized (earlier checkpoints cannot rewind the conversation). */
  compactedAt?: number;
}

/** Where a chat's files live: shared by every chat of a project, or the chat's own. */
export const workspaceIdFor = (c: { id: string; projectId: string | null }) => (c.projectId ? `p:${c.projectId}` : `c:${c.id}`);

export interface Project {
  id: string;
  name: string;
  description: string;
  instructions: string;
  skillIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  name: string;
  mime: string;
  size: number;
  /** Extracted text the model reads (text files only in this version). */
  text: string;
  createdAt: number;
}

export interface StudioPrefs {
  personalization: StudioPersonalization;
  uiLanguage: 'auto' | 'es' | 'en';
  defaultModel: StudioModelId;
  webSearch: boolean;
  webFetch: boolean;
  customSkills: StudioSkill[];
  acceptedPrivacy: boolean;
  // ── Code mode ──
  defaultMode: StudioMode;
  permission: PermissionMode;
  /** 'auto': let the model decide. */
  effort: Effort | 'auto';
  sandbox: boolean;
  /** Keep going on its own when a long task hits the time or step limit (up to 3 times). */
  autoContinue: boolean;
  /** Personal memory for every Code chat (like ~/.claude/CLAUDE.md). Projects add STUDIO.md. */
  memory: string;
  customCommands: CustomCommand[];
  customAgents: CustomAgent[];
  acceptedSandboxNotice: boolean;
}

export const DEFAULT_PREFS: StudioPrefs = {
  personalization: { style: 'balanced', responseLanguage: 'auto' },
  uiLanguage: 'auto',
  defaultModel: 'claude-sonnet-5-5',
  webSearch: true,
  webFetch: true,
  customSkills: [],
  acceptedPrivacy: false,
  defaultMode: 'chat',
  permission: 'ask',
  effort: 'auto',
  sandbox: false,
  autoContinue: true,
  memory: '',
  customCommands: [],
  customAgents: [],
  acceptedSandboxNotice: false,
};

const DB_VERSION = 2;
const dbs = new Map<string, Promise<IDBPDatabase>>();

function db(wallet: string): Promise<IDBPDatabase> {
  const name = `ledger-studio-v1-${wallet.toLowerCase()}`;
  let p = dbs.get(name);
  if (!p) {
    p = openDB(name, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('conversations')) {
          const s = d.createObjectStore('conversations', { keyPath: 'id' });
          s.createIndex('updatedAt', 'updatedAt');
          s.createIndex('projectId', 'projectId');
        }
        if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('artifacts')) {
          const s = d.createObjectStore('artifacts', { keyPath: 'key' });
          s.createIndex('conversationId', 'conversationId');
        }
        if (!d.objectStoreNames.contains('files')) {
          const s = d.createObjectStore('files', { keyPath: 'id' });
          s.createIndex('projectId', 'projectId');
        }
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
        // v2: Code mode workspaces and checkpoints.
        if (!d.objectStoreNames.contains('wsfiles')) {
          const s = d.createObjectStore('wsfiles', { keyPath: 'key' });
          s.createIndex('wsId', 'wsId');
        }
        if (!d.objectStoreNames.contains('checkpoints')) {
          const s = d.createObjectStore('checkpoints', { keyPath: 'id' });
          s.createIndex('convId', 'convId');
        }
      },
      // Another tab opened a newer version: let it upgrade, reopen on next use.
      blocking() {
        dbs.delete(name);
        p?.then(conn => conn.close()).catch(() => {});
      },
    });
    dbs.set(name, p);
  }
  return p;
}

/**
 * Delete everything Studio keeps on this device for a wallet (used by
 * "Delete all data" in Ledger Chat settings). Closes the open connection
 * first, or the browser would block the deletion.
 */
export async function deleteStudioData(wallet: string): Promise<void> {
  const name = `ledger-studio-v1-${wallet.toLowerCase()}`;
  const open = dbs.get(name);
  dbs.delete(name);
  if (open) { try { (await open).close(); } catch { /* ignore */ } }
  if (typeof indexedDB !== 'undefined') {
    await new Promise<void>(resolve => {
      try {
        const r = indexedDB.deleteDatabase(name);
        r.onsuccess = r.onerror = r.onblocked = () => resolve();
      } catch { resolve(); }
    });
  }
  try {
    const { vault } = await import('@/lib/core/SecureVault');
    vault.removeItem(`studio_connectors_${wallet.toLowerCase()}`);
    vault.removeItem(`studio_github_${wallet.toLowerCase()}`);
  } catch { /* ignore */ }
}

export const uid = (prefix = '') =>
  prefix + (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);

export function createStudioStore(wallet: string) {
  const d = () => db(wallet);
  const artifactKey = (conversationId: string, id: string) => `${conversationId}:${id}`;

  return {
    // ── conversations ──
    async listConversations(): Promise<Conversation[]> {
      const all = (await (await d()).getAll('conversations')) as Conversation[];
      return all.sort((a, b) => (Number(!!b.pinned) - Number(!!a.pinned)) || b.updatedAt - a.updatedAt);
    },
    async getConversation(id: string): Promise<Conversation | undefined> {
      return (await (await d()).get('conversations', id)) as Conversation | undefined;
    },
    async putConversation(c: Conversation): Promise<void> {
      await (await d()).put('conversations', c);
    },
    async deleteConversation(id: string): Promise<void> {
      const x = await d();
      const tx = x.transaction(['conversations', 'artifacts', 'checkpoints', 'wsfiles'], 'readwrite');
      await tx.objectStore('conversations').delete(id);
      const idx = tx.objectStore('artifacts').index('conversationId');
      for (let cur = await idx.openCursor(IDBKeyRange.only(id)); cur; cur = await cur.continue()) await cur.delete();
      const cps = tx.objectStore('checkpoints').index('convId');
      for (let cur = await cps.openCursor(IDBKeyRange.only(id)); cur; cur = await cur.continue()) await cur.delete();
      // The chat's own files (a project's files belong to the project).
      const ws = tx.objectStore('wsfiles').index('wsId');
      for (let cur = await ws.openCursor(IDBKeyRange.only(`c:${id}`)); cur; cur = await cur.continue()) await cur.delete();
      await tx.done;
    },

    // ── Code mode workspace (files on this device) ──
    async listWsFiles(wsId: string): Promise<WsFile[]> {
      const rows = (await (await d()).getAllFromIndex('wsfiles', 'wsId', wsId)) as (WsFile & { key: string; wsId: string })[];
      return rows.map(({ key: _k, wsId: _w, ...f }) => f).sort((a, b) => a.path.localeCompare(b.path));
    },
    /** Write and delete files in one transaction (null content deletes). */
    async writeWsFiles(wsId: string, writes: { path: string; file: WsFile | null }[]): Promise<void> {
      if (!writes.length) return;
      const tx = (await d()).transaction('wsfiles', 'readwrite');
      for (const w of writes) {
        const key = `${wsId}\u0000${w.path}`;
        if (w.file) await tx.store.put({ ...w.file, key, wsId });
        else await tx.store.delete(key);
      }
      await tx.done;
    },
    async clearWs(wsId: string): Promise<void> {
      const tx = (await d()).transaction('wsfiles', 'readwrite');
      for (let cur = await tx.store.index('wsId').openCursor(IDBKeyRange.only(wsId)); cur; cur = await cur.continue()) await cur.delete();
      await tx.done;
    },
    /** Move a chat's own files into its project when it joins one. */
    async moveWs(fromWsId: string, toWsId: string): Promise<void> {
      const files = await this.listWsFiles(fromWsId);
      const existing = new Set((await this.listWsFiles(toWsId)).map(f => f.path));
      await this.writeWsFiles(toWsId, files.filter(f => !existing.has(f.path)).map(f => ({ path: f.path, file: f })));
      await this.clearWs(fromWsId);
    },

    // ── checkpoints ──
    async listCheckpoints(convId: string): Promise<Checkpoint[]> {
      return ((await (await d()).getAllFromIndex('checkpoints', 'convId', convId)) as Checkpoint[]).sort((a, b) => a.createdAt - b.createdAt);
    },
    async putCheckpoint(c: Checkpoint): Promise<void> {
      await (await d()).put('checkpoints', c);
    },
    async deleteCheckpoints(ids: string[]): Promise<void> {
      const tx = (await d()).transaction('checkpoints', 'readwrite');
      for (const id of ids) await tx.store.delete(id);
      await tx.done;
    },

    // ── projects ──
    async listProjects(): Promise<Project[]> {
      return ((await (await d()).getAll('projects')) as Project[]).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async putProject(p: Project): Promise<void> {
      await (await d()).put('projects', p);
    },
    async deleteProject(id: string): Promise<void> {
      const x = await d();
      await x.delete('projects', id);
      for (const f of (await x.getAllFromIndex('files', 'projectId', id)) as ProjectFile[]) await x.delete('files', f.id);
      for (const c of (await x.getAllFromIndex('conversations', 'projectId', id)) as Conversation[]) await x.put('conversations', { ...c, projectId: null });
      await this.clearWs(`p:${id}`);
    },

    // ── project files ──
    async listFiles(projectId: string): Promise<ProjectFile[]> {
      return (await (await d()).getAllFromIndex('files', 'projectId', projectId)) as ProjectFile[];
    },
    async putFile(f: ProjectFile): Promise<void> {
      await (await d()).put('files', f);
    },
    async deleteFile(id: string): Promise<void> {
      await (await d()).delete('files', id);
    },

    // ── artifacts ──
    async listArtifacts(conversationId: string): Promise<Artifact[]> {
      const rows = (await (await d()).getAllFromIndex('artifacts', 'conversationId', conversationId)) as (Artifact & { key: string })[];
      return rows.sort((a, b) => a.createdAt - b.createdAt);
    },
    async listAllArtifacts(): Promise<Artifact[]> {
      return ((await (await d()).getAll('artifacts')) as Artifact[]).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async putArtifact(a: Artifact): Promise<void> {
      await (await d()).put('artifacts', { ...a, key: artifactKey(a.conversationId, a.id) });
    },

    // ── preferences ──
    async getPrefs(): Promise<StudioPrefs> {
      const v = (await (await d()).get('kv', 'prefs')) as Partial<StudioPrefs> | undefined;
      return { ...DEFAULT_PREFS, ...(v ?? {}), personalization: { ...DEFAULT_PREFS.personalization, ...(v?.personalization ?? {}) } };
    },
    async putPrefs(p: StudioPrefs): Promise<void> {
      await (await d()).put('kv', p, 'prefs');
    },

    // ── connectors (tokens in the encrypted vault) ──
    async getConnectors(): Promise<StudioConnectorConfig[]> {
      try {
        const { vault } = await import('@/lib/core/SecureVault');
        const raw = await vault.getItem(`studio_connectors_${wallet.toLowerCase()}`);
        const v = raw ? JSON.parse(raw) : [];
        return Array.isArray(v) ? v : [];
      } catch {
        return [];
      }
    },
    async putConnectors(list: StudioConnectorConfig[]): Promise<void> {
      const { vault } = await import('@/lib/core/SecureVault');
      await vault.setItem(`studio_connectors_${wallet.toLowerCase()}`, JSON.stringify(list));
    },

    // ── GitHub (token in the encrypted vault, repository link per workspace) ──
    async getGitHubToken(): Promise<string | null> {
      try {
        const { vault } = await import('@/lib/core/SecureVault');
        return (await vault.getItem(`studio_github_${wallet.toLowerCase()}`)) || null;
      } catch {
        return null;
      }
    },
    async putGitHubToken(token: string | null): Promise<void> {
      const { vault } = await import('@/lib/core/SecureVault');
      if (token) await vault.setItem(`studio_github_${wallet.toLowerCase()}`, token);
      else vault.removeItem(`studio_github_${wallet.toLowerCase()}`);
    },
    async getGitLink(wsId: string): Promise<GitLink | null> {
      return ((await (await d()).get('kv', `gh:${wsId}`)) as GitLink | undefined) ?? null;
    },
    async putGitLink(wsId: string, link: GitLink | null): Promise<void> {
      const x = await d();
      if (link) await x.put('kv', link, `gh:${wsId}`); else await x.delete('kv', `gh:${wsId}`);
    },

    // ── export everything (JSON, no connector tokens) ──
    async exportAll(): Promise<string> {
      const x = await d();
      const [conversations, projects, artifacts, files, prefs, workspaceFiles] = await Promise.all([
        x.getAll('conversations'), x.getAll('projects'), x.getAll('artifacts'), x.getAll('files'), x.get('kv', 'prefs'), x.getAll('wsfiles'),
      ]);
      return JSON.stringify({ format: 'ledger-studio-export', version: 2, exportedAt: new Date().toISOString(), conversations, projects, artifacts, files, prefs, workspaceFiles }, null, 2);
    },
    async wipe(): Promise<void> {
      const x = await d();
      for (const s of ['conversations', 'projects', 'artifacts', 'files', 'kv', 'wsfiles', 'checkpoints']) await x.clear(s);
      try {
        const { vault } = await import('@/lib/core/SecureVault');
        vault.removeItem(`studio_connectors_${wallet.toLowerCase()}`);
        vault.removeItem(`studio_github_${wallet.toLowerCase()}`);
      } catch { /* ignore */ }
    },
  };
}

export type StudioStore = ReturnType<typeof createStudioStore>;
