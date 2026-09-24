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
}

export const chatDB = new ChatDatabase();
