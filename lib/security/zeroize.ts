/**
 * lib/security/zeroize.ts
 *
 * Provides cryptographic zeroization helpers to securely wipe secret
 * buffers, key material, and ephemeral witnesses from memory immediately
 * after execution (Fortification Items 2, 45, 89).
 */

/**
 * Wipes a Node.js Buffer or Uint8Array in-place with zeroes.
 */
export function zeroizeBuffer(buffer: Buffer | Uint8Array): void {
  if (!buffer) return;
  if (Buffer.isBuffer(buffer)) {
    buffer.fill(0);
  } else if (buffer instanceof Uint8Array) {
    buffer.fill(0);
  }
}

/**
 * Recursively zeroizes and nullifies fields of an object containing sensitive buffers.
 */
export function zeroizeObject<T extends Record<string, any>>(obj: T): void {
  if (!obj || typeof obj !== 'object') return;

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (Buffer.isBuffer(val) || val instanceof Uint8Array) {
      val.fill(0);
      delete obj[key];
    } else if (typeof val === 'string' && (key.toLowerCase().includes('secret') || key.toLowerCase().includes('key') || key.toLowerCase().includes('witness'))) {
      // Overwrite property with empty string
      (obj as any)[key] = '';
    } else if (typeof val === 'object' && val !== null) {
      zeroizeObject(val);
    }
  }
}
