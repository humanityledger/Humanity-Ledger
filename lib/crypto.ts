/**
 * AES-256-GCM System Encryption Vault
 * Phase 2: Environment Variable Cryptography
 *
 * Secrets stored in PostgreSQL are always ciphertext.
 * The raw VAULT_SECRET env var is the master key - it never leaves the server.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // bytes  standard for AES-GCM

function getMasterKey(): string {
    const secret = process.env.VAULT_SECRET || process.env.NEXTAUTH_SECRET || (() => { throw new Error('VAULT_SECRET or NEXTAUTH_SECRET must be set.'); })();
    return secret.padEnd(32, '0').slice(0, 32);
}

async function importKey(rawKey: string): Promise<CryptoKey> {
    const keyMaterial = new TextEncoder().encode(rawKey);
    return crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: ALGORITHM, length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * @returns Base64 string: `iv:ciphertext`
 */
export async function encryptValue(plaintext: string): Promise<string> {
    const key = await importKey(getMasterKey());
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = new TextEncoder().encode(plaintext);

    const cipherBuffer = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv },
        key,
        encoded
    );

    const ivB64 = Buffer.from(iv).toString('base64');
    const cipherB64 = Buffer.from(cipherBuffer).toString('base64');
    return `${ivB64}:${cipherB64}`;
}

/**
 * Decrypts an AES-256-GCM ciphertext string.
 * @param ciphertext Format: `iv_b64:cipher_b64`
 * @returns Decrypted plaintext
 */
export async function decryptValue(ciphertext: string): Promise<string> {
    if (!ciphertext.includes(':')) return ciphertext; // legacy plaintext passthrough
    const key = await importKey(getMasterKey());
    const [ivB64, cipherB64] = ciphertext.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const cipherBuffer = Buffer.from(cipherB64, 'base64');

    const decrypted = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv },
        key,
        cipherBuffer
    );

    return new TextDecoder().decode(decrypted);
}
