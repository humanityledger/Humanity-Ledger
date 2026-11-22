/** Incoming payment notices: once per payment, never for old history, never an amount outside the app. */
import fs from 'node:fs';
import { incomingWords, takeNewIncoming } from '@/lib/payments/incoming';
import { agreementPreview } from '@/lib/aztec/agreement-message';

const ME = '0x' + 'ab'.repeat(32);
function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}
const rx = (id: string, status = 'settled') => ({ id, kind: 'receive', status, token: 'CUSDC', amount: '1500000' });

describe('takeNewIncoming', () => {
  it('the first time, records the history and announces nothing', () => {
    const s = memory();
    expect(takeNewIncoming(ME, [rx('a'), rx('b')], s)).toEqual([]);
    expect(takeNewIncoming(ME, [rx('a'), rx('b')], s)).toEqual([]);
  });
  it('then announces each new settled receive once', () => {
    const s = memory();
    takeNewIncoming(ME, [rx('a')], s);
    expect(takeNewIncoming(ME, [rx('a'), rx('c')], s).map((a) => a.id)).toEqual(['c']);
    expect(takeNewIncoming(ME, [rx('a'), rx('c')], s)).toEqual([]);
  });
  it('ignores sends and payments not settled yet', () => {
    const s = memory();
    takeNewIncoming(ME, [], s);
    expect(takeNewIncoming(ME, [{ id: 'x', kind: 'send', status: 'settled' }, rx('y', 'pending')], s)).toEqual([]);
    expect(takeNewIncoming(ME, [rx('y')], s).map((a) => a.id)).toEqual(['y']);
  });
  it('keeps one record per wallet', () => {
    const s = memory();
    takeNewIncoming(ME, [rx('a')], s);
    expect(takeNewIncoming('0x' + 'cd'.repeat(32), [rx('a')], s)).toEqual([]);
  });
  it('works without storage, without throwing', () => {
    expect(takeNewIncoming(ME, [rx('a')], null)).toEqual([]);
  });
});

describe('words', () => {
  it('the system notification never carries the amount', () => {
    expect(incomingWords('1.5 cUSDC')).toEqual({ toast: 'You received 1.5 cUSDC privately.', system: 'You received a private payment.' });
    expect(incomingWords(null).toast).toBe('You received a private payment.');
  });
  it('requests and payments are announced as words, never as their content', () => {
    expect(agreementPreview('request')).toBe('Payment request');
    expect(agreementPreview('payment')).toBe('Private payment');
  });
});

describe('wiring', () => {
  it('the chat mounts the notifier with the person’s notification settings', () => {
    const chat = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
    expect(chat).toMatch(/<IncomingPaymentNotifier muted=\{/);
    expect(chat).toMatch(/hideContent=\{!!\(ledgerSettings as any\)\?\.hide_notification_content\}/);
  });
});
