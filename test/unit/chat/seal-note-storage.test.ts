import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { openRecord, parseRecordMessage, wipeRecordKeys, type EpochSecret } from '@/vendor/ledger-record/src/index';
import { sealFileMessage, sealNoteInsideMessage, sealNoteMessage } from '@/lib/chat/seal-record';
import { openLegacyRecord } from '@/vendor/ledger-record/src/index';

const members = ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'];

function epoch(): EpochSecret {
  const bytes = new Uint8Array(32).fill(3);
  return { bytes, mlsEpoch: '1', conversationId: 'conv-note', source: 'mls-exporter' };
}

describe('a sealed note never needs file storage', () => {
  it('builds the note without calling the network', async () => {
    const fetchImpl = vi.fn();
    const message = await sealNoteMessage('keep this', members, epoch());
    expect(fetchImpl).not.toHaveBeenCalled();
    const pointer = parseRecordMessage(message);
    expect(pointer?.kind).toBe('note');
    expect(pointer?.inline).toBeTruthy();
    expect(pointer?.url).toBeUndefined();
    expect(message).not.toContain('storage_unavailable');
  });

  it('the chat screen no longer refuses a note for lack of an exporter', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'components/terminal/LedgerChatV2.tsx'), 'utf8');
    expect(src).not.toContain('weaker key');
    expect(src).toContain('await sealNoteInsideMessage(text, [address, activePeer])');
  });

  it('seals a note inside the encrypted message when the exporter is missing', async () => {
    const message = await sealNoteInsideMessage('the deed is in the drawer', members);
    expect(message).not.toContain('storage_unavailable');
    expect(message).not.toContain('"url"');
    const opened = await openLegacyRecord(message, members);
    expect(opened.text).toBe('the deed is in the drawer');
  });

  it('seals and opens a note twenty thousand times, and never asks storage', async () => {
    const fetchImpl = vi.fn();
    for (let i = 0; i < 20_000; i++) {
      const text = `sealed note ${i}`;
      const message = await sealNoteMessage(text, i % 2 === 0 ? members : [members[1], members[0]], epoch());
      if (fetchImpl.mock.calls.length !== 0) throw new Error(`storage was called on note ${i}`);
      if (message.includes('storage_unavailable') || message.includes('"url"') || message.includes('"key"')) {
        throw new Error(`note ${i} leaked storage, a url, or a raw key`);
      }
      const pointer = parseRecordMessage(message);
      if (!pointer || pointer.kind !== 'note' || !pointer.inline) throw new Error(`note ${i} did not parse as an inline note`);
      const opened = await openRecord(message, members, epoch());
      if (opened.text !== text) throw new Error(`note ${i} opened as ${opened.text}`);
      wipeRecordKeys(opened.contentKey);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  }, 180_000);

  it('keeps a small sealed file inside the message when storage answers storage_unavailable', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: 'storage_unavailable' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    }));
    const file = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'application/octet-stream' });
    const message = await sealFileMessage(file, 'note.bin', members, epoch(), fetchImpl as unknown as typeof fetch);
    expect(message).not.toContain('storage_unavailable');
    const pointer = parseRecordMessage(message);
    expect(pointer?.kind).toBe('file');
    expect(pointer?.inline).toBeTruthy();
    expect(pointer?.url).toBeUndefined();
  });
});
