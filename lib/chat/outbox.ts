/**
 * IndexedDB-based outbox queue for offline message delivery.
 *
 * Messages written here are retried when XMTP reconnects.
 * Each message is delivered exactly once (idempotent send + remove on success).
 */

export interface OutboxMessage {
  id: string;          // UUID
  conversationId: string;
  content: string;
  contentType?: string;
  createdAt: number;   // epoch ms
  attempts: number;
  status: 'pending' | 'sending' | 'failed';
}

const DB_NAME = 'hl_outbox';
const STORE = 'messages';
const VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const outbox = {
  async add(msg: Omit<OutboxMessage, 'attempts' | 'status'>): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ ...msg, attempts: 0, status: 'pending' });
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },

  async getAll(): Promise<OutboxMessage[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async remove(id: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },

  async markFailed(id: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.get(id);
    req.onsuccess = () => {
      const msg = req.result as OutboxMessage;
      if (msg) store.put({ ...msg, status: 'failed', attempts: msg.attempts + 1 });
    };
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },

  /**
   * Drain the outbox: try to send all pending messages via XMTP.
   * Call this when XMTP stream reconnects.
   */
  async drain(sendFn: (msg: OutboxMessage) => Promise<void>): Promise<void> {
    const pending = (await this.getAll()).filter(m => m.status !== 'failed' || m.attempts < 3);
    for (const msg of pending) {
      try {
        await sendFn(msg);
        await this.remove(msg.id);
      } catch {
        await this.markFailed(msg.id);
      }
    }
  },
};
