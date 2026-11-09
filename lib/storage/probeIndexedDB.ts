/**
 * Writes one record to a throwaway IndexedDB database to find out whether
 * local storage works. Safari private browsing, a full quota or a corrupted
 * store make the open, the transaction or the write fail, or hang.
 *
 * Never rejects: the answer is a boolean, so a storage problem cannot take
 * the React tree down. Cached after the first run.
 */
let cached: Promise<boolean> | null = null;

export function probeIndexedDB(timeoutMs = 800): Promise<boolean> {
  if (cached) return cached;
  cached = new Promise<boolean>((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(false);
    const name = "__hl_idb_probe__";
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        indexedDB.deleteDatabase(name);
      } catch {
        /* nothing to clean */
      }
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    try {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => {
        try {
          req.result.createObjectStore("t");
        } catch {
          finish(false);
        }
      };
      req.onerror = () => finish(false);
      req.onblocked = () => finish(false);
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction("t", "readwrite");
          tx.objectStore("t").put(1, "k");
          tx.oncomplete = () => {
            db.close();
            finish(true);
          };
          tx.onerror = tx.onabort = () => {
            db.close();
            finish(false);
          };
        } catch {
          try {
            db.close();
          } catch {
            /* already closed */
          }
          finish(false);
        }
      };
    } catch {
      finish(false);
    }
  });
  return cached;
}
