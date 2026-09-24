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
   * Master function: Encrypts, uploads to IPFS, and returns the metadata payload to send via XMTP.
   */
  static async processAndUpload(file: File): Promise<string> {
    const { encryptedBlob, ivBase64, keyBase64 } = await this.encryptFile(file);
    
    // In production, this posts to a decentralized storage pinning service (e.g., Pinata/Web3Storage)
    const ipfsCid = `QmMockCid${Date.now()}`; 
    
    // Simulate IPFS by saving the encrypted blob to IndexedDB
    try {
      const { vault } = await import('@/lib/core/SecureVault');
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(encryptedBlob);
      });
      await vault.setItem(`ipfs_mock_${ipfsCid}`, base64);
      console.log(`[MediaEngine] Uploaded encrypted blob to mock IPFS (CID: ${ipfsCid})`);
    } catch (e) {
      console.error('[MediaEngine] IPFS Mock Upload Failed:', e);
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
   * Mock IPFS fetcher + Decryptor
   */
  static async fetchAndDecrypt(cid: string, keyBase64: string, ivBase64: string, mimeType: string): Promise<string> {
    try {
      const { vault } = await import('@/lib/core/SecureVault');
      const base64 = await vault.getItem(`ipfs_mock_${cid}`);
      if (!base64) throw new Error('CID not found in mock IPFS network');
      
      const res = await fetch(base64);
      const encryptedBlob = await res.blob();
      
      const decryptedBlob = await this.decryptFile(encryptedBlob, keyBase64, ivBase64, mimeType);
      return URL.createObjectURL(decryptedBlob);
    } catch (e) {
      console.error('[MediaEngine] Fetch/Decrypt Failed:', e);
      throw e;
    }
  }
}
