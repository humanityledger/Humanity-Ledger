import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { putChatAttachment, getChatAttachment } from '@/lib/storage/chat-attachment-store';

describe('chat-attachment-store', () => {
  const testId = '1234567890abcdef1234567890abcdef';
  const fallbackId = 'abcdefabcdefabcdefabcdefabcdef12';
  const testData = new Uint8Array([1, 2, 3, 4, 5, 42, 99, 255]);
  const prevDir = process.env.CHAT_ATTACHMENTS_DIR;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-att-test-'));
    process.env.CHAT_ATTACHMENTS_DIR = tmpDir;
  });

  afterEach(() => {
    if (prevDir === undefined) delete process.env.CHAT_ATTACHMENTS_DIR;
    else process.env.CHAT_ATTACHMENTS_DIR = prevDir;
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    try { fs.unlinkSync(path.join(os.tmpdir(), 'hl-chat-attachments', `${fallbackId}.bin`)); } catch {}
  });

  it('stores and retrieves attachment from local filesystem when R2 is not configured', async () => {
    await putChatAttachment(testId, testData);
    const retrieved = await getChatAttachment(testId);
    expect(retrieved).not.toBeNull();
    expect(Array.from(retrieved!)).toEqual(Array.from(testData));
  });

  it('falls back cleanly to another writable directory if CHAT_ATTACHMENTS_DIR fails', async () => {
    process.env.CHAT_ATTACHMENTS_DIR = '\0invalid-path';
    await putChatAttachment(fallbackId, testData);
    const retrieved = await getChatAttachment(fallbackId);
    expect(retrieved).not.toBeNull();
    expect(Array.from(retrieved!)).toEqual(Array.from(testData));
  });

  it('returns null for non-existent id', async () => {
    const retrieved = await getChatAttachment('00000000000000000000000000000000');
    expect(retrieved).toBeNull();
  });

  it('rejects invalid id formatting', async () => {
    await expect(putChatAttachment('../invalid', testData)).rejects.toThrow();
    const retrieved = await getChatAttachment('../invalid');
    expect(retrieved).toBeNull();
  });
});
