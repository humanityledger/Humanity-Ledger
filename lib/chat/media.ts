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
    const formData = new FormData();
    formData.append('file', encryptedBlob);
    
    // Mock upload for scaffolding
    console.log('[MediaEngine] Uploading encrypted blob to IPFS...');
    const ipfsCid = `QmMockCid${Date.now()}...`; 
    
    // The payload that will be sent via XMTP (in plaintext relative to the XMTP channel, but E2E encrypted by XMTP itself)
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
}
