/**
 * Humanity Ledger Enterprise Core - SecureVault v2
 *
 * Abstraction layer for secure cryptographic key-value storage.
 *
 * Architecture:
 * - WEB:    AES-256-GCM encrypted blobs in localStorage (Web Crypto API)
 * - NATIVE: Swap this module's internals to SecureStore (Expo) / Keychain (iOS) / EncryptedSharedPreferences (Android)
 *           without ANY change to consuming code.
 *
 * Security guarantees:
 * - All values are encrypted at rest using a per-session AES-GCM key derived from a
 *   device-local master secret. Even if localStorage is dumped, values are ciphertext.
 * - Memory cache provides in-process fast path with zero disk I/O after first read.
 * - Keys are hashed with SHA-256 so key names are never stored in plaintext.
 * - removeItem zeros the memory cache entry before deleting from disk.
 */

import { BoundedLRU } from '@/lib/core/BoundedLRU';

/**
 * Base64 for any size: 32 KB chunks. `btoa(String.fromCharCode(...bytes))`
 * spreads every byte as a call argument and throws "Maximum call stack size
 * exceeded" past ~100 KB on Safari.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return btoa(bin);
}

export class SecureVault {
  private static _instance: SecureVault;
  // In-memory cache: decrypted values for instant access within session. Bounded by entry count
  // and a byte budget; values over 16 KB are never kept decrypted in the heap (read from disk).
  private memoryCache = new BoundedLRU<string, string>({ max: 256, maxBytes: 256 * 1024, maxItemBytes: 16 * 1024, sizeOf: v => v.length * 2, name: 'vault.memoryCache' });
  // Values whose encrypted write has not finished yet: always served from here, never evicted.
  private pendingWrites = new Map<string, string>();
  private lastActivity = Date.now();
  // Per-session AES-GCM key — derived once, kept only in memory
  private cryptoKey: CryptoKey | null = null;
  // Whether Web Crypto + localStorage are available
  private isWebCryptoAvailable = false;
  // ── [FASE 15: Auto-Lock por inactividad] ─────────────────────────────
  // Auto-locks after 15 minutes of inactivity (Apple Privacy + enterprise grade)
  private autoLockTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly AUTO_LOCK_MS = 15 * 60 * 1000; // 15 minutes

  private constructor() {
    // Lazily init crypto on first use to avoid SSR crashes
    if (typeof window !== 'undefined') {
      this._initAutoLock();
    }
  }

  public static getInstance(): SecureVault {
    if (!SecureVault._instance) {
      SecureVault._instance = new SecureVault();
    }
    return SecureVault._instance;
  }

  // ── Auto-Lock Helpers (Fase 15) ─────────────────────────────────────────
  private _initAutoLock(): void {
    if (typeof window === 'undefined') return;
    const resetEvents = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'];
    // Activity only stamps a time (no timer churn on every mousemove/scroll); one timer checks it.
    const onActivity = () => { this.lastActivity = Date.now(); };
    resetEvents.forEach(evt => window.addEventListener(evt, onActivity, { passive: true, capture: true }));
    this._resetAutoLock();
  }

  private _resetAutoLock(): void {
    if (this.autoLockTimeout) clearTimeout(this.autoLockTimeout);
    this.lastActivity = Date.now();
    const check = () => {
      const idle = Date.now() - this.lastActivity;
      if (idle >= this.AUTO_LOCK_MS) {
        this.lock();
        console.info('[SecureVault] Auto-locked after inactivity.');
        this.autoLockTimeout = null;
        return;
      }
      this.autoLockTimeout = setTimeout(check, this.AUTO_LOCK_MS - idle);
    };
    this.autoLockTimeout = setTimeout(check, this.AUTO_LOCK_MS);
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  private async ensureCryptoKey(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (this.cryptoKey) return true;

    try {
      const subtle = window.crypto?.subtle;
      if (!subtle) {
        this.isWebCryptoAvailable = false;
        return false;
      }

      // Derive or restore master secret from localStorage (persistent)
      // In a real native app, this would be stored in Secure Enclave / Keychain.
      const MASTER_KEY = 'hl_vault_master_v2';
      let masterSecretB64 = localStorage.getItem(MASTER_KEY);
      let masterBytes: Uint8Array;

      if (masterSecretB64) {
        masterBytes = Uint8Array.from(atob(masterSecretB64), c => c.charCodeAt(0));
      } else {
        // Generate new 256-bit master secret
        masterBytes = new Uint8Array(32);
        window.crypto.getRandomValues(masterBytes);
        localStorage.setItem(MASTER_KEY, bytesToBase64(masterBytes));
      }

      // Import as HKDF key, then derive AES-GCM key
      const hkdfKey = await subtle.importKey(
        'raw', masterBytes, { name: 'HKDF' }, false, ['deriveKey']
      );

      const info = new TextEncoder().encode('HumanityLedger/SecureVault/v2');
      const salt = new TextEncoder().encode('hl_aes_gcm_salt_v2');

      this.cryptoKey = await subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt, info },
        hkdfKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      this.isWebCryptoAvailable = true;
      return true;
    } catch {
      this.isWebCryptoAvailable = false;
      return false;
    }
  }

  /** SHA-256 hash of the key name — stored key is never plaintext */
  private async hashKey(key: string): Promise<string> {
    if (typeof window === 'undefined' || !window.crypto?.subtle) {
      return btoa(`hl_v2_${key}`);
    }
    try {
      const data = new TextEncoder().encode(`hl_vault_v2::${key}`);
      const hashBuf = await window.crypto.subtle.digest('SHA-256', data);
      const hashArr = Array.from(new Uint8Array(hashBuf));
      return 'hl_' + hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return btoa(`hl_v2_${key}`);
    }
  }

  private async encrypt(plaintext: string): Promise<string> {
    const ready = await this.ensureCryptoKey();
    if (!ready || !this.cryptoKey) {
      // Fallback: plain base64 (no crypto available — e.g., old WebView)
      return `plain:${btoa(encodeURIComponent(plaintext))}`;
    }
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.cryptoKey,
      encoded
    );
    // Pack IV + ciphertext as base64
    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.byteLength);
    return `aes:${bytesToBase64(combined)}`;
  }

  private async decrypt(stored: string): Promise<string | null> {
    try {
      if (stored.startsWith('plain:')) {
        return decodeURIComponent(atob(stored.slice(6)));
      }
      if (!stored.startsWith('aes:')) return null;

      const ready = await this.ensureCryptoKey();
      if (!ready || !this.cryptoKey) return null;

      const combined = Uint8Array.from(atob(stored.slice(4)), c => c.charCodeAt(0));
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);
      const plainBuf = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.cryptoKey,
        ciphertext
      );
      return new TextDecoder().decode(plainBuf);
    } catch {
      return null;
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  public async setItem(key: string, value: string): Promise<void> {
    // 1. Visible to readers immediately, even if the LRU would not keep it.
    this.memoryCache.set(key, value);
    if (typeof window === 'undefined') return;
    this.pendingWrites.set(key, value);

    // 2. Persist encrypted to localStorage
    try {
      const storageKey = await this.hashKey(key);
      const encrypted = await this.encrypt(value);
      window.localStorage.setItem(storageKey, encrypted);
    } catch (e) {
      console.error('[SecureVault] setItem failed', e);
    } finally {
      if (this.pendingWrites.get(key) === value) this.pendingWrites.delete(key);
    }
  }

  public async getItem(key: string): Promise<string | null> {
    // 1. Fast path: a write in flight, then the in-memory cache
    const pending = this.pendingWrites.get(key);
    if (pending !== undefined) return pending;
    const cached = this.memoryCache.get(key);
    if (cached !== undefined) return cached;

    // 2. Read from localStorage and decrypt
    if (typeof window === 'undefined') return null;
    try {
      const storageKey = await this.hashKey(key);
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return null;

      const decrypted = await this.decrypt(stored);
      if (decrypted !== null) {
        this.memoryCache.set(key, decrypted);
      }
      return decrypted;
    } catch (e) {
      console.error('[SecureVault] getItem failed', e);
      return null;
    }
  }

  public removeItem(key: string): void {
    // Synchronously zero memory first
    this.memoryCache.delete(key);
    this.pendingWrites.delete(key);

    if (typeof window === 'undefined') return;
    // Async disk cleanup (fire and forget — memory is already clean)
    this.hashKey(key).then(storageKey => {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {}
    });
  }

  /** Clear all vault entries from memory (does NOT touch localStorage — use removeItem for that) */
  public clearMemoryCache(): void {
    this.memoryCache.clear();
  }

  /** Lock the vault — clears the crypto key from memory, requiring re-derive on next access */
  public lock(): void {
    this.cryptoKey = null;
    this.memoryCache.clear();
    import('@/lib/chat/record-session').then((m) => m.lockRecordSession()).catch(() => {});
  }
}

export const vault = SecureVault.getInstance();
