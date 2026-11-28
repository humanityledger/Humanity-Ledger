/**
 * lib/chat/private-notes.ts — "Private Notes": a chat with yourself that never leaves this device.
 *
 * Reserved id PRIVATE_NOTES_PEER_ID ('__private_notes__'). It is not a peer: nothing about it is
 * ever sent to XMTP or to /api (no inbox lookup, no profile fetch, no typing or read receipts).
 * Callers use isPrivateNotesPeer() as a guard before any network path.
 *
 * Storage: IndexedDB database hl_private_notes_v1_<wallet>, one per account, so notes never mix
 * between wallets on a shared browser. Each note (text and attachment bytes) is encrypted with
 * AES-GCM under a non-extractable key created on this device and kept in the same database.
 */

export const PRIVATE_NOTES_PEER_ID = '__private_notes__';
export const PRIVATE_NOTES_NAME = 'Private Notes';

export function isPrivateNotesPeer(peer: unknown): boolean {
  return typeof peer === 'string' && peer.trim().toLowerCase() === PRIVATE_NOTES_PEER_ID;
}

export type NoteKind = 'text' | 'check' | 'image' | 'audio' | 'file';

export interface Note {
  id: string;
  kind: NoteKind;
  text: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  starred?: boolean;
  /** Checklist items only. */
  done?: boolean;
  /** Attachments: decrypted bytes, kept as a Blob in memory only. */
  blob?: Blob;
  mime?: string;
  name?: string;
  size?: number;
}

/** What is stored: id and time in the clear (for ordering), everything else encrypted. */
export interface StoredNote {
  id: string;
  createdAt: number;
  iv: Uint8Array;
  data: ArrayBuffer;
  blobIv?: Uint8Array;
  blobData?: ArrayBuffer;
}

export interface NotesBackend {
  getAll(): Promise<StoredNote[]>;
  put(rec: StoredNote): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  getKey(): Promise<CryptoKey | undefined>;
  setKey(k: CryptoKey): Promise<void>;
}

export function notesDbName(wallet: string): string {
  return `hl_private_notes_v1_${String(wallet || 'anon').toLowerCase()}`;
}

export function memoryNotesBackend(): NotesBackend {
  const recs = new Map<string, StoredNote>();
  let key: CryptoKey | undefined;
  return {
    async getAll() { return [...recs.values()]; },
    async put(r) { recs.set(r.id, r); },
    async delete(id) { recs.delete(id); },
    async clear() { recs.clear(); },
    async getKey() { return key; },
    async setKey(k) { key = k; },
  };
}

export function indexedDbNotesBackend(wallet: string): NotesBackend {
  let dbp: Promise<IDBDatabase> | null = null;
  const db = () =>
    (dbp ??= new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(notesDbName(wallet), 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('notes')) d.createObjectStore('notes', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('keys')) d.createObjectStore('keys');
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  const run = async <T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> => {
    const d = await db();
    return new Promise<T>((resolve, reject) => {
      const req = fn(d.transaction(store, mode).objectStore(store));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  };
  return {
    getAll: () => run<StoredNote[]>('notes', 'readonly', (s) => s.getAll()),
    put: async (r) => { await run('notes', 'readwrite', (s) => s.put(r)); },
    delete: async (id) => { await run('notes', 'readwrite', (s) => s.delete(id)); },
    clear: async () => { await run('notes', 'readwrite', (s) => s.clear()); },
    getKey: () => run<CryptoKey | undefined>('keys', 'readonly', (s) => s.get('k')),
    setKey: async (k) => { await run('keys', 'readwrite', (s) => s.put(k, 'k')); },
  };
}

function newId(): string {
  const a = new Uint8Array(10);
  crypto.getRandomValues(a);
  return `n_${Date.now().toString(36)}_${Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

type Meta = Omit<Note, 'blob' | 'id' | 'createdAt'>;

export class PrivateNotesStore {
  private keyP: Promise<CryptoKey> | null = null;
  constructor(private backend: NotesBackend) {}

  private key(): Promise<CryptoKey> {
    return (this.keyP ??= (async () => {
      const have = await this.backend.getKey();
      if (have) return have;
      const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await this.backend.setKey(k);
      return k;
    })());
  }

  private async seal(note: Note): Promise<StoredNote> {
    const key = await this.key();
    const meta: Meta = {
      kind: note.kind, text: note.text, updatedAt: note.updatedAt,
      pinned: note.pinned, starred: note.starred, done: note.done, mime: note.mime, name: note.name, size: note.size,
    };
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(meta)));
    const rec: StoredNote = { id: note.id, createdAt: note.createdAt, iv, data };
    if (note.blob) {
      const blobIv = crypto.getRandomValues(new Uint8Array(12));
      rec.blobIv = blobIv;
      rec.blobData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: blobIv }, key, await note.blob.arrayBuffer());
    }
    return rec;
  }

  private async open(rec: StoredNote): Promise<Note | null> {
    try {
      const key = await this.key();
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv as BufferSource }, key, rec.data);
      const meta = JSON.parse(new TextDecoder().decode(plain)) as Meta;
      const note: Note = { ...meta, id: rec.id, createdAt: rec.createdAt };
      if (rec.blobData && rec.blobIv) {
        const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.blobIv as BufferSource }, key, rec.blobData);
        note.blob = new Blob([bytes], { type: meta.mime || 'application/octet-stream' });
      }
      return note;
    } catch {
      return null; // a record from another key (another browser profile restore) is skipped
    }
  }

  async list(): Promise<Note[]> {
    const recs = await this.backend.getAll();
    const notes = (await Promise.all(recs.map((r) => this.open(r)))).filter((n): n is Note => !!n);
    return sortNotes(notes);
  }

  async add(input: { kind?: NoteKind; text?: string; blob?: Blob; name?: string; at?: number }): Promise<Note> {
    const now = input.at ?? Date.now();
    const note: Note = {
      id: newId(),
      kind: input.kind ?? (input.blob ? blobKind(input.blob) : 'text'),
      text: (input.text ?? '').slice(0, 20_000),
      createdAt: now,
      updatedAt: now,
      ...(input.kind === 'check' ? { done: false } : {}),
      ...(input.blob ? { blob: input.blob, mime: input.blob.type, name: input.name, size: input.blob.size } : {}),
    };
    await this.backend.put(await this.seal(note));
    return note;
  }

  async update(note: Note, patch: Partial<Pick<Note, 'text' | 'pinned' | 'starred' | 'done'>>): Promise<Note> {
    const next: Note = { ...note, ...patch, updatedAt: Date.now() };
    await this.backend.put(await this.seal(next));
    return next;
  }

  remove(id: string): Promise<void> { return this.backend.delete(id); }
  clear(): Promise<void> { return this.backend.clear(); }
}

export function blobKind(b: Blob): NoteKind {
  if (b.type.startsWith('image/')) return 'image';
  if (b.type.startsWith('audio/')) return 'audio';
  return 'file';
}

/** Pinned notes first, then oldest to newest (a chat reads top to bottom). */
export function sortNotes(notes: readonly Note[]): Note[] {
  return [...notes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || a.createdAt - b.createdAt);
}

export function searchNotes(notes: readonly Note[], q: string): Note[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [...notes];
  return notes.filter((n) => n.text.toLowerCase().includes(needle) || (n.name ?? '').toLowerCase().includes(needle));
}

const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]]/gi;
/** Split text into plain and link parts for rendering. */
export function linkify(text: string): { text: string; href?: string }[] {
  const out: { text: string; href?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i) });
    out.push({ text: m[0], href: m[0] });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export type ExportFormat = 'md' | 'txt' | 'json';

export function formatExport(notes: readonly Note[], format: ExportFormat): string {
  const sorted = [...notes].sort((a, b) => a.createdAt - b.createdAt);
  const when = (t: number) => new Date(t).toISOString().replace('T', ' ').slice(0, 16);
  const label = (n: Note) =>
    n.kind === 'check' ? `${n.done ? '[x]' : '[ ]'} ${n.text}` : n.kind === 'text' ? n.text : `${n.text ? n.text + ' ' : ''}(${n.kind}: ${n.name || n.mime || 'attachment'})`;
  if (format === 'json') {
    return JSON.stringify(
      sorted.map(({ blob: _b, ...rest }) => rest),
      null,
      2,
    );
  }
  if (format === 'md') {
    return `# ${PRIVATE_NOTES_NAME}\n\n` + sorted.map((n) => `- ${n.pinned ? '📌 ' : ''}${n.starred ? '★ ' : ''}${label(n)}  \n  _${when(n.createdAt)}_`).join('\n') + '\n';
  }
  return sorted.map((n) => `[${when(n.createdAt)}] ${label(n)}`).join('\n') + '\n';
}
