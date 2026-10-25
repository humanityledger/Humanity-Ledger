import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const ALGORITHM = 'aes-256-gcm';
// Read when used, not at import: a missing secret fails the request that
// needs it instead of every route that happens to import this file.
function secret(): string {
    const s = process.env.ENCRYPTION_SECRET;
    if (!s) throw new Error('ENCRYPTION_SECRET is not set.');
    return s;
}

// Ensure key is 32 bytes
const getKey = async () => {
    return (await promisify(scrypt)(secret(), 'salt', 32)) as Buffer;
};

export async function encrypt(text: string): Promise<string> {
    const key = await getKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export async function decrypt(text: string): Promise<string> {
    const [ivHex, authTagHex, encryptedHex] = text.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) throw new Error('Invalid encrypted format');

    const key = await getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

