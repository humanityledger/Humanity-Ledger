import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  confirmOptimistic,
  createSendQueue,
  failOptimistic,
  insertOptimistic,
  isOptimisticId,
  newOptimisticId,
  optimisticMessage,
  sendStatusLabel,
  adoptOptimistic,
  renderKey,
  strongerStatus,
} from '@/lib/chat/optimistic-send';

const base = { senderInboxId: 'me', content: 'hi', conversationId: 'dm-0xabc' };

describe('optimistic send', () => {
  it('ids are unique within the same millisecond', () => {
    const a = newOptimisticId(1000);
    const b = newOptimisticId(1000);
    expect(a).not.toBe(b);
    expect(isOptimisticId(a) && isOptimisticId(b)).toBe(true);
    expect(isOptimisticId('real-id')).toBe(false);
  });

  it('a new message starts as "sending" and appears well under 50 ms', () => {
    const history = Array.from({ length: 5000 }, (_, i) => ({ id: `m${i}`, sentAtNs: i, content: 'x' }));
    const t0 = performance.now();
    const msg = optimisticMessage({ id: newOptimisticId(), ...base, sentAtNs: 10_000 });
    const next = insertOptimistic(history as any[], msg);
    const ms = performance.now() - t0;
    expect(msg.status).toBe('sending');
    expect(next.at(-1)).toBe(msg);
    expect(next).toHaveLength(5001);
    expect(ms).toBeLessThan(50);
  });

  it('keeps time order when the clock is behind the last message', () => {
    const prev = [{ id: 'a', sentAtNs: 10 }, { id: 'b', sentAtNs: 30 }];
    expect(insertOptimistic(prev, { id: 'c', sentAtNs: 20 }).map((m) => m.id)).toEqual(['a', 'c', 'b']);
  });

  it('confirm swaps the id and turns "sent"; a stream echo that came first wins', () => {
    const prev = [{ id: 'optimistic-1', status: 'sending', content: 'hi' }];
    expect(confirmOptimistic(prev, 'optimistic-1', 'real')).toEqual([{ id: 'real', status: 'sent', content: 'hi' }]);
    const echoed = [{ id: 'optimistic-1', status: 'sending' }, { id: 'real', status: 'sent' }];
    // The echoed real copy takes over the optimistic render key, so the bubble does not remount.
    expect(confirmOptimistic(echoed, 'optimistic-1', 'real')).toEqual([{ id: 'real', status: 'sent', clientKey: 'optimistic-1' }]);
    // A receipt that already arrived is kept.
    expect(confirmOptimistic([{ id: 'optimistic-2', status: 'read' }], 'optimistic-2', 'r2')[0].status).toBe('read');
  });

  it('a failed send is marked, nothing else changes', () => {
    const prev = [{ id: 'a' }, { id: 'optimistic-3', status: 'sending' }];
    const next = failOptimistic(prev, 'optimistic-3', 'offline');
    expect(next[0]).toBe(prev[0]);
    expect(next[1]).toEqual({ id: 'optimistic-3', status: 'sending', failed: true, error: 'offline' });
  });

  it('labels the real status', () => {
    expect(sendStatusLabel('sending')).toBe('Sending');
    expect(sendStatusLabel('sent')).toBe('Sent');
    expect(sendStatusLabel(undefined)).toBe('Sent');
    expect(sendStatusLabel('delivered')).toBe('Delivered');
    expect(sendStatusLabel('read')).toBe('Read');
    expect(sendStatusLabel('read', { readReceipts: false })).toBe('Sent');
    expect(sendStatusLabel('scheduled')).toBe('Scheduled');
    expect(sendStatusLabel('sending', { failed: true })).toBe('Not sent');
  });
});

describe('send queue', () => {
  it('runs sends in order without blocking the caller, and a failure does not stop the rest', async () => {
    const q = createSendQueue();
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const first = q.run(async () => { await gate; order.push('a'); return 'A'; });
    const second = q.run(async () => { order.push('b'); throw new Error('boom'); });
    const third = q.run(async () => { order.push('c'); return 'C'; });
    expect(q.pending).toBe(3);
    await Promise.resolve();
    expect(order).toEqual([]); // b and c wait for a
    release();
    expect(await first).toBe('A');
    await expect(second).rejects.toThrow('boom');
    expect(await third).toBe('C');
    expect(order).toEqual(['a', 'b', 'c']);
    await Promise.resolve();
    expect(q.pending).toBe(0);
  });
});

describe('chat wiring', () => {
  const chat = readFileSync(join(process.cwd(), 'components/terminal/LedgerChatV2.tsx'), 'utf8');
  const send = chat.slice(chat.indexOf('const executeSend = async (content: string'), chat.indexOf('executeSendRef.current = executeSend;'));

  it('inserts the bubble before any network call and no longer locks the composer', () => {
    expect(send.indexOf('setMessages(prev => insertOptimistic(prev, optimisticMsg))')).toBeGreaterThan(-1);
    expect(send.indexOf('setMessages(prev => insertOptimistic(prev, optimisticMsg))')).toBeLessThan(send.indexOf('sendMessage(client'));
    expect(send).not.toMatch(/sending\) return false/);
    expect(send).not.toMatch(/setSending\(true\)/);
    expect(chat).not.toMatch(/disabled=\{sending/);
  });

  it('messages go through the queue; call signals skip it', () => {
    expect(send).toMatch(/isSignal\s+\? await sendMessage\(client, peerAtSend, finalContent, address\)\s+: await sendQueueRef\.current\.run\(\(\) => sendMessage\(client, peerAtSend, finalContent, address\)\)/);
    expect(send).toMatch(/confirmOptimistic\(prev, optimisticId, realId\)/);
    expect(send).toMatch(/failOptimistic\(prev, optimisticId, errString\)/);
  });

  it('the list re-renders a row when it fails', () => {
    const list = readFileSync(join(process.cwd(), 'components/chat/VirtualizedMessageList.tsx'), 'utf8');
    expect(list).toMatch(/prev\.msg\.failed === next\.msg\.failed/);
  });
});

describe('one bubble from send to read (no remount, no re-sort, status only forward)', () => {
  it('the render key survives the id swap, whichever path confirms the message', () => {
    const opt = optimisticMessage({ id: 'optimistic-9-1', senderInboxId: 'me', content: 'hi', conversationId: 'dm-x', sentAtNs: 1_000 });
    expect(renderKey(opt)).toBe('optimistic-9-1');
    const viaSend = confirmOptimistic([opt], opt.id, 'real-9');
    expect(viaSend[0].id).toBe('real-9');
    expect(renderKey(viaSend[0])).toBe('optimistic-9-1');
    const viaEcho = adoptOptimistic(opt, { ...opt, id: 'real-9', clientKey: undefined, sentAtNs: 999_000, status: 'sent' });
    expect(renderKey(viaEcho)).toBe('optimistic-9-1');
    // Keeps its local time, so ten rapid sends never reorder when their network times arrive.
    expect(viaEcho.sentAtNs).toBe(1_000);
  });

  it('status never moves backwards, and a receipt that came first is kept on confirmation', () => {
    expect(strongerStatus('read', 'delivered')).toBe('read');
    expect(strongerStatus('sent', 'delivered')).toBe('delivered');
    expect(strongerStatus(undefined, 'sent')).toBe('sent');
    const opt = { id: 'optimistic-1', clientKey: 'optimistic-1', sentAtNs: 5, status: 'delivered' };
    expect(adoptOptimistic(opt, { id: 'r', sentAtNs: 9, status: 'sent' }).status).toBe('delivered');
    expect(adoptOptimistic({ ...opt, status: 'sending' }, { id: 'r', sentAtNs: 9, status: undefined as any }).status).toBe('sent');
  });
});

