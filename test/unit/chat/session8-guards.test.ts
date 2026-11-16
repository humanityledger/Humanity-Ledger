import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { feeJuiceGuidance } from '@/components/zk/PaymentProgress';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('swipe does not run an action by itself', () => {
  it('settles on the actions and waits for a tap', () => {
    const src = read('components/chat/SwipeableConversationRow.tsx');
    expect(src).not.toMatch(/Deep full-swipe triggers/);
    expect(src).not.toMatch(/handleAction\("archive"/);
    expect(src).not.toMatch(/handleAction\("pin"/);
    expect(src).toMatch(/The person taps one to run it/);
    expect(src).toMatch(/dragMomentum=\{false\}/);
  });
});

describe('Ledger Studio is closed', () => {
  it('the page does not load the studio', () => {
    const src = read('app/studio/page.tsx');
    expect(src).not.toMatch(/LedgerStudio/);
    expect(src).toMatch(/Ledger Studio is closed/);
  });

  it('studio APIs are refused in middleware', () => {
    expect(read('middleware.ts')).toMatch(/pathname\.startsWith\('\/api\/studio\/'\)/);
    expect(read('middleware.ts')).toMatch(/STUDIO_LOCKED/);
  });
});

describe('fee juice failure copy', () => {
  it('tells the person to add Fee Juice and that nothing was sent', () => {
    expect(feeJuiceGuidance('insufficient fee payer balance')).toMatch(/Fee Juice/);
    expect(feeJuiceGuidance('insufficient fee payer balance')).toMatch(/Nothing was sent/);
    expect(feeJuiceGuidance('note not found')).toBeNull();
  });
});
