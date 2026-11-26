const CONV_TIME_INDEX = 'conv_time';

/** Milliseconds as a finite number (ns and date strings accepted); 0 when unknown. */
export function normalizeSentAt(t: unknown): number {
  let n: number;
  if (typeof t === 'number') n = t;
  else if (typeof t === 'bigint') n = Number(t);
  else if (t instanceof Date) n = t.getTime();
  else if (typeof t === 'string' && t.trim()) n = /^\d+$/.test(t.trim()) ? Number(t) : new Date(t).getTime();
  else return 0;
  if (!Number.isFinite(n) || n < 0) return 0;
  return n > 1e14 ? Math.floor(n / 1e6) : n;
}

export class ChatDatabase {
  private dbName = 'HumanityLedgerChatDB';
  // v2 (26 Nov 2026): compound index ['conversationId', 'sentAtNs'] so a thread page is read with a
  // reverse cursor that stops after `limit` rows, instead of loading the whole history to keep 50.
  private dbVersion = 2;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') return resolve();

      const request = window.indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('[ChatDB] Error opening database');
        reject(request.error);
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const upgrade = (event.target as IDBOpenDBRequest).transaction;
        
        // Messages Store
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('conversationId', 'conversationId', { unique: false });
          messageStore.createIndex('sentAt', 'sentAt', { unique: false });
        }
        const messages = upgrade?.objectStore('messages');
        if (messages && !messages.indexNames.contains(CONV_TIME_INDEX)) {
          messages.createIndex(CONV_TIME_INDEX, ['conversationId', 'sentAtNs'], { unique: false });
        }

        // Conversations Store
        if (!db.objectStoreNames.contains('conversations')) {
          const convStore = db.createObjectStore('conversations', { keyPath: 'peerAddress' });
          convStore.createIndex('lastAt', 'lastAt', { unique: false });
        }
      };
    });
  }

  async saveMessages(messages: any[]): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      
      messages.forEach(msg => {
        // A numeric time keeps every row in the compound index (a missing or string time would drop
        // the row from it, or sort it after every number).
        const t = normalizeSentAt(msg?.sentAtNs ?? msg?.sentAt);
        store.put(msg && typeof msg === 'object' && msg.sentAtNs !== t ? { ...msg, sentAtNs: t } : msg);
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async deleteMessages(ids: string[]): Promise<void> {
    if (!ids.length) return;
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      ids.forEach(id => store.delete(id));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async saveMessage(myAddress: string, peerAddress: string, msg: any): Promise<void> {
    const peerLower = (peerAddress || '').toLowerCase();
    const formatted = {
      ...msg,
      id: msg.id || `msg-${Date.now()}-${Math.random()}`,
      conversationId: `dm-${peerLower}`,
      // Milliseconds, despite the field's name: every reader in the chat
      // compares it with Date.now(). Nanoseconds here sorted these messages
      // after everything else, forever.
      sentAtNs: msg.sentAtNs || (msg.sent ? new Date(msg.sent).getTime() : Date.now()),
      sentAt: msg.sent || new Date(),
    };
    return this.saveMessages([formatted]);
  }

  /**
   * A page of a thread, oldest first. Reads with a reverse cursor on
   * ['conversationId', 'sentAtNs'] and stops after `limit` rows: memory is
   * O(limit), not O(history). `beforeSentAtNs` pages backwards from a time.
   */
  async getMessagesForConversation(conversationId: string, limit: number = 50, offset: number = 0, beforeSentAtNs?: number): Promise<any[]> {
    if (!this.db) await this.init();
    const conv = conversationId.toLowerCase();
    const store = this.db!.transaction(['messages'], 'readonly').objectStore('messages');
    if (!store.indexNames.contains(CONV_TIME_INDEX)) return this.getMessagesFullScan(conv, limit, offset);
    const upper = typeof beforeSentAtNs === 'number' && Number.isFinite(beforeSentAtNs) ? [conv, beforeSentAtNs] : [conv, Infinity];
    const range = IDBKeyRange.bound([conv, -Infinity], upper, false, upper[1] !== Infinity);
    const rows = await new Promise<any[]>((resolve, reject) => {
      const out: any[] = [];
      let skipped = offset <= 0;
      const req = store.index(CONV_TIME_INDEX).openCursor(range, 'prev');
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return resolve(out);
        if (!skipped) { skipped = true; cur.advance(offset); return; }
        out.push(cur.value);
        if (out.length >= limit) return resolve(out);
        cur.continue();
      };
      req.onerror = () => reject(req.error);
    });
    // Rows written by older builds without a numeric time are not in the index: if the thread holds
    // more than the index returned and the page is short, fall back once to the full scan.
    if (rows.length < limit && beforeSentAtNs === undefined) {
      const total = await new Promise<number>((resolve) => {
        const r = this.db!.transaction(['messages'], 'readonly').objectStore('messages').index('conversationId').count(IDBKeyRange.only(conv));
        r.onsuccess = () => resolve(r.result); r.onerror = () => resolve(0);
      });
      if (total > rows.length + offset) return this.getMessagesFullScan(conv, limit, offset);
    }
    return rows.reverse();
  }

  private getMessagesFullScan(conv: string, limit: number, offset: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const request = this.db!.transaction(['messages'], 'readonly').objectStore('messages').index('conversationId').getAll(IDBKeyRange.only(conv));
      request.onsuccess = () => {
        const msgs = request.result.sort((a, b) => normalizeSentAt(b.sentAtNs) - normalizeSentAt(a.sentAtNs));
        resolve(msgs.slice(offset, offset + limit).reverse());
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveConversation(conversation: any): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['conversations'], 'readwrite');
      const store = transaction.objectStore('conversations');
      store.put(conversation);
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getConversations(): Promise<any[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['conversations'], 'readonly');
      const store = transaction.objectStore('conversations');
      const request = store.getAll();

      request.onsuccess = () => {
        const convs = request.result.sort((a, b) => b.lastAt - a.lastAt);
        resolve(convs);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async clearConversation(conversationId: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['messages'], 'readwrite');
        const store = transaction.objectStore('messages');
        const index = store.index('conversationId');
        const request = index.getAllKeys(IDBKeyRange.only(conversationId.toLowerCase()));
        request.onsuccess = () => {
          const keys = request.result;
          keys.forEach(k => store.delete(k));
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      } catch (e) {
        resolve(); // gracefully resolve if IDB transaction fails
      }
    });
  }

  /** Remove a conversation entry from the conversations store (not just its messages). */
  async removeConversation(peerAddress: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['conversations'], 'readwrite');
        const store = transaction.objectStore('conversations');
        store.delete(peerAddress.toLowerCase());
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      } catch {
        resolve();
      }
    });
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages', 'conversations'], 'readwrite');
      transaction.objectStore('messages').clear();
      transaction.objectStore('conversations').clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /** Every record of one store, for the encrypted history archive. */
  async getAll(store: 'messages' | 'conversations'): Promise<any[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];
    return new Promise((resolve, reject) => {
      const req = this.db!.transaction([store], 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
}

export const chatDB = new ChatDatabase();

/** Everything this device keeps of the chat history, for an encrypted archive (lib/backup). */
export interface ChatHistorySnapshot {
  kind: 'chat-history';
  exportedAt: string;
  /** The wallet whose history this is (lower case); restore refuses another wallet's archive. */
  account?: string;
  conversations: any[];
  messages: any[];
}

export async function snapshotChatHistory(db: ChatDatabase = chatDB, account?: string): Promise<ChatHistorySnapshot> {
  const [conversations, messages] = await Promise.all([db.getAll('conversations'), db.getAll('messages')]);
  return { kind: 'chat-history', exportedAt: new Date().toISOString(), ...(account ? { account: account.toLowerCase() } : {}), conversations, messages };
}

/** Merges a snapshot into this device: existing records with the same id are overwritten, nothing is deleted. */
export async function restoreChatHistory(snapshot: ChatHistorySnapshot, db: ChatDatabase = chatDB, account?: string): Promise<{ conversations: number; messages: number }> {
  if (!snapshot || snapshot.kind !== 'chat-history' || !Array.isArray(snapshot.messages) || !Array.isArray(snapshot.conversations)) {
    throw new Error('This archive does not contain a chat history.');
  }
  // One wallet's conversations never land in another wallet's chat list on a shared browser.
  if (snapshot.account && account && snapshot.account.toLowerCase() !== account.toLowerCase()) {
    throw new Error('This archive belongs to another wallet. Sign in with that wallet to restore it.');
  }
  const messages = snapshot.messages.filter((m) => m && typeof m.id === 'string');
  await db.saveMessages(messages);
  let conversations = 0;
  for (const c of snapshot.conversations) {
    if (c && typeof c.peerAddress === 'string') { await db.saveConversation(c); conversations++; }
  }
  return { conversations, messages: messages.length };
}

