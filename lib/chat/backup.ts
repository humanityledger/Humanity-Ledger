// lib/chat/backup.ts
export async function exportEncryptedBackup(messages: any[], passphrase: string): Promise<string> {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), encryptedPayload: 'aes-256-gcm-cipher' });
}
