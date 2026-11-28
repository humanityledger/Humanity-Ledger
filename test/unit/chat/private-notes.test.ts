/** Private Notes: local, encrypted, per wallet, never on the network. */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  PRIVATE_NOTES_PEER_ID, PrivateNotesStore, formatExport, isPrivateNotesPeer, linkify, memoryNotesBackend, notesDbName, searchNotes,
} from '@/lib/chat/private-notes';

describe('Private Notes store', () => {
  it('adds, updates, pins, checks and deletes notes, encrypted at rest', async () => {
    const backend = memoryNotesBackend();
    const store = new PrivateNotesStore(backend);
    const a = await store.add({ text: 'buy milk', at: 1 });
    const b = await store.add({ kind: 'check', text: 'call mum', at: 2 });
    await store.update(b, { done: true });
    await store.update(a, { pinned: true });
    const list = await store.list();
    expect(list.map((n) => n.text)).toEqual(['buy milk', 'call mum']);
    expect(list[0].pinned).toBe(true);
    expect(list[1].done).toBe(true);
    // At rest only id and time are readable.
    const raw = await backend.getAll();
    const bytes = new TextDecoder().decode(new Uint8Array(raw[0].data));
    expect(bytes).not.toContain('buy milk');
    await store.remove(a.id);
    expect((await store.list()).map((n) => n.id)).toEqual([b.id]);
    await store.clear();
    expect(await store.list()).toEqual([]);
  });

  it('keeps attachment bytes encrypted and gives them back as a Blob', async () => {
    const store = new PrivateNotesStore(memoryNotesBackend());
    await store.add({ blob: new Blob(['hello'], { type: 'text/plain' }), name: 'a.txt' });
    const [n] = await store.list();
    expect(n.kind).toBe('file');
    expect(await n.blob!.text()).toBe('hello');
  });

  it('one database per wallet, so accounts never mix', () => {
    expect(notesDbName('0xABCDEF')).toBe('hl_private_notes_v1_0xabcdef');
    expect(notesDbName('0xABCDEF')).not.toBe(notesDbName('0x123456'));
  });

  it('search, links and export', () => {
    const notes = [
      { id: '1', kind: 'text' as const, text: 'see https://example.org/x.', createdAt: 1, updatedAt: 1 },
      { id: '2', kind: 'check' as const, text: 'pay rent', done: true, createdAt: 2, updatedAt: 2 },
    ];
    expect(searchNotes(notes, 'RENT').map((n) => n.id)).toEqual(['2']);
    expect(linkify(notes[0].text).find((p) => p.href)?.href).toBe('https://example.org/x');
    expect(formatExport(notes, 'md')).toContain('[x] pay rent');
    expect(JSON.parse(formatExport(notes, 'json'))).toHaveLength(2);
    expect(formatExport(notes, 'txt').split('\n')[0]).toContain('see https://example.org/x.');
  });

  it('the reserved id is recognised and never reaches XMTP or /api', () => {
    expect(PRIVATE_NOTES_PEER_ID).toBe('__private_notes__');
    expect(isPrivateNotesPeer('__PRIVATE_NOTES__')).toBe(true);
    const lib = fs.readFileSync('lib/chat/private-notes.ts', 'utf8');
    const view = fs.readFileSync('components/chat/PrivateNotesView.tsx', 'utf8');
    for (const src of [lib, view]) {
      expect(src).not.toMatch(/\bfetch\(|sendMessage\(|findInboxIdByIdentifier|\/api\//);
    }
    expect(fs.readFileSync('components/chat/ContactInfoPanel.tsx', 'utf8')).toContain('if (!key || isPrivateNotesPeer(key)) return;');
  });

  it('is pinned first in Chats with the book logo and the blue check', () => {
    const chat = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
    expect(chat).toContain('<PrivateNotesRow active={privateNotesOpen}');
    const icons = fs.readFileSync('components/chat/PrivateNotesIcons.tsx', 'utf8');
    expect(icons).toContain('export function VerifiedBlueCheckBadge');
    expect(icons).toContain('export function PrivateNotesBookIcon');
    expect(icons).toContain('fill="#1279C0"');
  });
});
