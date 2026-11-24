export class ChatDatabase {
  private dbName = 'HumanityLedgerChatDB';
  private dbVersion = 1;
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
        
        // Messages Store
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('conversationId', 'conversationId', { unique: false });
          messageStore.createIndex('sentAt', 'sentAt', { unique: false });
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
        store.put(msg);
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

  async getMessagesForConversation(conversationId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('conversationId');
      // Always store and query lowercase for consistency
      const request = index.getAll(IDBKeyRange.only(conversationId.toLowerCase()));

      request.onsuccess = () => {
        // Sort by sentAtNs descending, then paginate
        const msgs = request.result.sort((a, b) => (b.sentAtNs || 0) - (a.sentAtNs || 0));
        resolve(msgs.slice(offset, offset + limit).reverse()); // Return chronological for UI
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
  conversations: any[];
  messages: any[];
}

export async function snapshotChatHistory(db: ChatDatabase = chatDB): Promise<ChatHistorySnapshot> {
  const [conversations, messages] = await Promise.all([db.getAll('conversations'), db.getAll('messages')]);
  return { kind: 'chat-history', exportedAt: new Date().toISOString(), conversations, messages };
}

/** Merges a snapshot into this device: existing records with the same id are overwritten, nothing is deleted. */
export async function restoreChatHistory(snapshot: ChatHistorySnapshot, db: ChatDatabase = chatDB): Promise<{ conversations: number; messages: number }> {
  if (!snapshot || snapshot.kind !== 'chat-history' || !Array.isArray(snapshot.messages) || !Array.isArray(snapshot.conversations)) {
    throw new Error('This archive does not contain a chat history.');
  }
  const messages = snapshot.messages.filter((m) => m && typeof m.id === 'string');
  await db.saveMessages(messages);
  let conversations = 0;
  for (const c of snapshot.conversations) {
    if (c && typeof c.peerAddress === 'string') { await db.saveConversation(c); conversations++; }
  }
  return { conversations, messages: messages.length };
}

