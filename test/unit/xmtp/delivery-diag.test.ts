import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { diag, diagEvents, diagText, short } from '@/lib/xmtp/diag';

describe('delivery diagnostics', () => {
  it('shortens ids so no full address or inbox id is kept', () => {
    expect(short('0x1ba9e2f0c3d4b5a6978877665544332211f675')).toBe('0x1ba9…f675');
    expect(short('abc')).toBe('abc');
    expect(short(undefined)).toBe('');
  });
  it('keeps the last 300 events, in order, as text', () => {
    for (let i = 0; i < 310; i++) diag('recv', { n: i });
    const ev = diagEvents();
    expect(ev).toHaveLength(300);
    expect(ev[0].detail?.n).toBe(10);
    expect(diagText().split('\n')).toHaveLength(300);
  });
  it('every place a received message can be dropped leaves an event', () => {
    const chat = readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
    for (const reason of ['blocked', 'already shown', 'error while handling']) expect(chat).toContain(`reason: '${reason}'`);
    expect(chat).toMatch(/'deleted on this device' : 'before this chat was cleared'/);
    expect(chat).toMatch(/diag\('recv', \{/);
    expect(chat).toMatch(/diag\('stream_ended'/);
    expect(chat).toMatch(/diag\('stream_restart'/);
    expect(chat).toMatch(/kind: signalKind,/);
    expect(chat).toMatch(/diag\('shown', \{/);
  });
  it('the stream, the client and every send leave events; the server accepts the new problem kinds', () => {
    const client = readFileSync('lib/xmtp/client.ts', 'utf8');
    for (const k of ['client_ready', 'client_failed', 'stream_open', 'stream_closed', 'stream_error', 'send_published', 'send_attempt_failed', 'send_pending', 'send_failed']) expect(client).toContain(`diag('${k}'`);
    const route = readFileSync('app/api/chat/delivery-report/route.ts', 'utf8');
    for (const k of ['stream_failed', 'receive_unresolved', 'receive_cleared']) expect(route).toContain(`'${k}'`);
  });
  it('the events never carry message content', () => {
    const chat = readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
    const recv = chat.slice(chat.indexOf("diag('recv', {"), chat.indexOf("diag('recv', {") + 400);
    expect(recv).not.toMatch(/content:|_rawContentStr|msg\.content\b(?!Type)/);
  });
});
