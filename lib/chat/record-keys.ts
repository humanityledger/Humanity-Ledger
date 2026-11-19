/**
 * Local copies of record content keys, wrapped by a non-extractable AES key
 * that stays in this browser profile. A copy of the profile's files cannot
 * use that key. Wiping the store removes the keys from this device only.
 *
 * This is the same boundary as the message database key: an unlocked browser
 * profile on this device can still unwrap. It is not a passphrase lock.
 */
const DB_NAME = 'hl-record-keys';
const STORE = 'keys';
const META = 'meta';
const VERSION = 1;

interface Row { id: string; iv: Uint8Array; ct: Uint8Array; passNonce?: string; passCt?: string }

function idb(): IDBFactory | null {
  try { return typeof indexedDB !== 'undefined' ? indexedDB : null; } catch { return null; }
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const factory = idb();
    if (!factory) return reject(new Error('No IndexedDB'));
    const req = factory.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

async function wrappingKey(db: IDBDatabase): Promise<CryptoKey> {
  const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const tx = db.transaction(META, 'readonly');
    const req = tx.objectStore(META).get('wrap');
    req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
    req.onerror = () => reject(req.error);
  });
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(META, 'readwrite');
    tx.objectStore(META).put(key, 'wrap');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return key;
}

function keyId(recordId: string, generation: number): string {
  return `${recordId}:${generation}`;
}

export async function rememberRecordKey(recordId: string, generation: number, contentKey: Uint8Array): Promise<void> {
  if (!idb() || contentKey.byteLength !== 32) return;
  let passNonce: string | undefined;
  let passCt: string | undefined;
  try {
    const { recordSession } = await import('./record-session');
    const session = recordSession();
    if (!session.locked) {
      const wrapped = await session.protect(contentKey);
      passNonce = wrapped.nonce;
      passCt = wrapped.ct;
    }
  } catch {
    // A locked session still gets the device wrap below.
  }
  const db = await open();
  try {
    const wrap = await wrappingKey(db);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrap, contentKey as unknown as BufferSource));
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ id: keyId(recordId, generation), iv, ct, passNonce, passCt } satisfies Row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function recallRecordKey(recordId: string, generation: number): Promise<Uint8Array | null> {
  if (!idb()) return null;
  const db = await open();
  try {
    const wrap = await wrappingKey(db);
    const row = await new Promise<Row | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(keyId(recordId, generation));
      req.onsuccess = () => resolve(req.result as Row | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!row) return null;
    if (row.passNonce && row.passCt) {
      const { recordSession } = await import('./record-session');
      return recordSession().hold(keyId(recordId, generation), { nonce: row.passNonce, ct: row.passCt });
    }
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: row.iv as unknown as BufferSource }, wrap, row.ct as unknown as BufferSource);
    return new Uint8Array(plain);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) throw error;
    return null;
  } finally {
    db.close();
  }
}

/** Deletes every stored record key on this device. Other members keep theirs. */
export function wipeRecordKeyStore(): Promise<void> {
  const factory = idb();
  if (!factory) return Promise.resolve();
  return new Promise((resolve) => {
    const req = factory.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
