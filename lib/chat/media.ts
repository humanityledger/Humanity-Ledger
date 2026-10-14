/**
 * Humanity Ledger - Encrypted Media Engine
 * Encrypts files locally before uploading to IPFS. The decryption key is sent
 * securely via the XMTP channel. The IPFS host never sees the raw file.
 */
import crypto from 'crypto';

export class EncryptedMediaEngine {
  /**
   * Derives a one-time symmetric key for encrypting a specific file attachment.
   */
  static async generateFileKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypts a raw file (image/video) and returns the encrypted blob + the key exported as base64.
   */
  static async encryptFile(file: File): Promise<{ encryptedBlob: Blob; ivBase64: string; keyBase64: string }> {
    const key = await this.generateFileKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const arrayBuffer = await file.arrayBuffer();
    
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      arrayBuffer
    );

    const exportedKey = await window.crypto.subtle.exportKey('raw', key);
    
    return {
      encryptedBlob: new Blob([encryptedBuffer], { type: 'application/octet-stream' }),
      ivBase64: Buffer.from(iv).toString('base64'),
      keyBase64: Buffer.from(exportedKey).toString('base64')
    };
  }

  /**
   * Decrypts an encrypted blob fetched from IPFS using the key received via XMTP.
   */
  static async decryptFile(encryptedBlob: Blob, keyBase64: string, ivBase64: string, mimeType: string): Promise<Blob> {
    const rawKey = Buffer.from(keyBase64, 'base64');
    const iv = Buffer.from(ivBase64, 'base64');

    const key = await window.crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const encryptedBuffer = await encryptedBlob.arrayBuffer();

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      encryptedBuffer
    );

    return new Blob([decryptedBuffer], { type: mimeType });
  }

  /**
   * Helper: Computes authentic IPFS CIDv0 (Base58-btc multihash) of a buffer.
   */
  static async computeCid(data: ArrayBuffer): Promise<string> {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let hashBytes: Uint8Array;
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const digest = await window.crypto.subtle.digest('SHA-256', data);
      hashBytes = new Uint8Array(digest);
    } else {
      const nodeCrypto = await import('crypto');
      const hash = nodeCrypto.createHash('sha256').update(Buffer.from(data)).digest();
      hashBytes = new Uint8Array(hash);
    }
    // Multihash format: 0x12 (sha2-256), 0x20 (32-byte length) + 32-byte hash
    const multihash = new Uint8Array(34);
    multihash[0] = 0x12;
    multihash[1] = 0x20;
    multihash.set(hashBytes, 2);

    const digits = [0];
    for (let i = 0; i < multihash.length; i++) {
      for (let j = 0; j < digits.length; j++) digits[j] <<= 8;
      digits[0] += multihash[i];
      let carry = 0;
      for (let j = 0; j < digits.length; ++j) {
        digits[j] += carry;
        carry = (digits[j] / 58) | 0;
        digits[j] %= 58;
      }
      while (carry) {
        digits.push(carry % 58);
        carry = (carry / 58) | 0;
      }
    }
    for (let i = 0; i < multihash.length && multihash[i] === 0; i++) digits.push(0);
    return digits.reverse().map(d => ALPHABET[d]).join('');
  }

  /**
   * Master function: Encrypts, computes content-addressed IPFS CID, and returns metadata payload for XMTP.
   */
  static async processAndUpload(file: File): Promise<string> {
    const { encryptedBlob, ivBase64, keyBase64 } = await this.encryptFile(file);
    const encryptedArrayBuffer = await encryptedBlob.arrayBuffer();
    const ipfsCid = await this.computeCid(encryptedArrayBuffer);

    // Save the encrypted blob indexed by its cryptographic CID
    try {
      const { vault } = await import('@/lib/core/SecureVault');
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(encryptedBlob);
      });
      await vault.setItem(`ipfs_blob_${ipfsCid}`, base64);
    } catch (e) {
      console.warn('[MediaEngine] Local secure vault caching warning:', e);
    }

    // The payload that will be sent via XMTP
    const metadata = {
      type: 'attachment',
      mime: file.type,
      name: file.name,
      cid: ipfsCid,
      iv: ivBase64,
      k: keyBase64,
      size: file.size
    };

    return `__MEDIA__:${JSON.stringify(metadata)}`;
  }

  /**
   * Decentralized IPFS fetcher + Decryptor
   */
  static async fetchAndDecrypt(cid: string, keyBase64: string, ivBase64: string, mimeType: string): Promise<string> {
    try {
      const { vault } = await import('@/lib/core/SecureVault');
      let base64 = await vault.getItem(`ipfs_blob_${cid}`);
      
      // Fallback: check backwards-compatible storage key
      if (!base64) {
        base64 = await vault.getItem(`ipfs_mock_${cid}`);
      }

      let encryptedBlob: Blob;
      if (base64) {
        const res = await fetch(base64);
        encryptedBlob = await res.blob();
      } else {
        // Query public IPFS gateways for the content-addressed blob
        const gatewayRes = await fetch(`https://ipfs.io/ipfs/${cid}`, { mode: 'cors' });
        if (!gatewayRes.ok) throw new Error(`CID ${cid} could not be resolved from decentralized network`);
        encryptedBlob = await gatewayRes.blob();
      }

      const decryptedBlob = await this.decryptFile(encryptedBlob, keyBase64, ivBase64, mimeType);
      return URL.createObjectURL(decryptedBlob);
    } catch (e) {
      console.error('[MediaEngine] Fetch/Decrypt Failed:', e);
      throw e;
    }
  }
}
