/**
 * lib/xmtp/device-key-vault.ts
 *
 * One signature to sign in. The key of this device's XMTP database used to be derived from a
 * second wallet signature ("Ledger Chat: unlock my message database on this device"), asked on
 * EVERY page load, after the sign-in signature: people signed two or three times to get in, and
 * again on each visit.
 *
 * Now the database key is kept on this device, wrapped (AES-256-GCM) by a key the browser holds
 * as a NON-EXTRACTABLE CryptoKey in IndexedDB. Its bytes cannot be read by any script, exported
 * or synced; the browser only lets this origin use it to unwrap. Nothing is in localStorage and
 * nothing is sent to a server.
 *
 * - A device with no message database yet for the account: a random 32-byte key, wrapped here.
 *   No signature at all.
 * - A device whose database was locked by the old signature (lib/xmtp/db-key.ts): that signature
 *   is asked ONE last time, the key it opens is wrapped here, and it is never asked again.
 * - The vault unavailable (private mode, an old browser, IndexedDB refused): the signature path of
 *   lib/xmtp/db-key.ts, exactly as before. Fail closed: a key that does not unwrap is never
 *   replaced by a new one, because a new key would orphan the existing database.
 *
 * Trade-off, stated plainly: the database is now protected by this browser profile's storage, as
 * in desktop messengers, instead of by a wallet signature on every load. Someone with this
 * browser profile open on this device can read the local copy of the messages; a copy of the
 * profile's files alone cannot run this origin's key without the browser.
 */

const DB_NAME = 'hl-xmtp-device-keys';
const STORE = 'keys';
const VERSION = 1;

interface Entry {
  address: string;
  wrapKey: CryptoKey;
  iv: Uint8Array;
  ct: Uint8Array;
  createdAt: number;
}

function idb(): IDBFactory | null {
  try {
    return typeof indexedDB !== 'undefined' ? indexedDB : null;
  } catch {
    return null;
  }
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const f = idb();
    if (!f) return reject(new Error('No IndexedDB'));
    const req = f.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'address' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
        t.oncomplete = () => db.close();
        t.onabort = () => { db.close(); reject(t.error || new Error('IndexedDB aborted')); };
      }),
  );
}

function subtle(): SubtleCrypto | null {
  return globalThis.crypto?.subtle ?? null;
}

/** The key wrapped on this device for this account, or null when there is none (or no vault). */
export async function loadDeviceDbKey(address: string): Promise<Uint8Array | null> {
  const s = subtle();
  if (!s || !idb()) return null;
  let entry: Entry | undefined;
  try {
    entry = await tx<Entry | undefined>('readonly', (st) => st.get(address.toLowerCase()) as IDBRequest<Entry | undefined>);
  } catch {
    return null;
  }
  if (!entry) return null;
  // Present but unusable: fail closed (see the header). The caller stops; it does not make a new key.
  const pt = await s.decrypt({ name: 'AES-GCM', iv: entry.iv as BufferSource }, entry.wrapKey, entry.ct as BufferSource);
  const key = new Uint8Array(pt);
  if (key.length !== 32) throw new Error('The database key on this device is malformed.');
  return key;
}

/** Wraps and stores the key. False when this browser cannot keep it (the caller signs as before). */
export async function saveDeviceDbKey(address: string, key: Uint8Array): Promise<boolean> {
  const s = subtle();
  if (!s || !idb() || key.length !== 32) return false;
  try {
    const wrapKey = await s.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const ct = new Uint8Array(await s.encrypt({ name: 'AES-GCM', iv }, wrapKey, key as BufferSource));
    const entry: Entry = { address: address.toLowerCase(), wrapKey, iv, ct, createdAt: Date.now() };
    await tx('readwrite', (st) => st.put(entry));
    // Read it back: a browser that accepted the write but cannot store a CryptoKey must not leave
    // the database with a key nobody can unwrap.
    const back = await loadDeviceDbKey(address);
    const same = !!back && back.length === key.length && back.every((b, i) => b === key[i]);
    back?.fill(0);
    if (!same) {
      await forgetDeviceDbKey(address);
      return false;
    }
    return true;
  } catch {
    try { await forgetDeviceDbKey(address); } catch { /* nothing stored */ }
    return false;
  }
}

/** Removes this account's wrapped key from this device. */
export async function forgetDeviceDbKey(address: string): Promise<void> {
  if (!idb()) return;
  try {
    await tx('readwrite', (st) => st.delete(address.toLowerCase()));
  } catch {
    /* nothing to remove */
  }
}

/** A fresh database key for an account with no database on this device. */
export function randomDbKey(): Uint8Array {
  const k = new Uint8Array(32);
  crypto.getRandomValues(k);
  return k;
}
