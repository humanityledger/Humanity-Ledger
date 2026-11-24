// scripts/ui/payments-e2e.mjs: the payment flow between two sessions, in Chromium.
//   node scripts/ui/payments-e2e.mjs <baseUrl> <outDir>
// Needs a build with NEXT_PUBLIC_E2E_HARNESS=1 (it serves /chat?e2e=payments) and a test-network
// token configuration. Alice and Bob each get their own browser context (separate storage); this
// script carries every message one posts to the other, as XMTP would.
//
// Flow: Alice requests 1.5 -> Bob sees the request and pays it -> Bob's card shows sent, both request
// cards show Paid -> Bob's wallet settles (confirmed) -> Alice's card waits until her wallet finds the
// transfer, then shows received, and a notice with the amount appears once.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] || 'http://localhost:3100';
const out = process.argv[3] || 'payments-e2e';
fs.mkdirSync(out, { recursive: true });

const steps = [];
let failed = false;
const check = (name, ok, detail = '') => {
  steps.push({ name, ok, detail });
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};

const browser = await chromium.launch();
const open = async (who) => {
  const ctx = await browser.newContext({ viewport: { width: 520, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  await page.goto(`${base}/chat?e2e=payments&as=${who}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector(`[data-testid="payments-harness"][data-as="${who}"]`, { timeout: 30000 });
  return { page, errors };
};
const carry = async (from, to) => {
  const msgs = await from.page.evaluate(() => window.__paymentsHarness.takeOutbox());
  for (const m of msgs) await to.page.evaluate((c) => window.__paymentsHarness.deliver(c), m);
  return msgs;
};
const stateOf = (p, testid, fromMe) =>
  p.page.locator(`[data-testid="message"][data-from-me="${fromMe}"] [data-testid="${testid}"]`).last().getAttribute('data-state');
const waitState = async (p, testid, fromMe, want, ms = 10000) => {
  const end = Date.now() + ms;
  let last = null;
  while (Date.now() < end) {
    last = await stateOf(p, testid, fromMe).catch(() => null);
    if (last === want) return last;
    await p.page.waitForTimeout(200);
  }
  return last;
};

try {
  const alice = await open('alice');
  const bob = await open('bob');

  // 1. Alice asks Bob for 1.5.
  await alice.page.getByTestId('request-payment').click();
  const dialog = alice.page.getByRole('dialog', { name: 'Request a payment' });
  await dialog.locator('input[inputmode="decimal"]').fill('1.5');
  await dialog.getByRole('button', { name: 'Send request' }).click();
  const [request] = await carry(alice, bob);
  check('Alice posts one structured request', !!request && request.startsWith('{"type":"hl.payment_request"'));
  check('the request carries no address', !!request && !/"(to|payee|recipient)"/.test(request));
  check('Alice sees her request waiting', (await waitState(alice, 'payment-request-card', 'true', 'open')) === 'open');
  check('Bob sees the request open', (await waitState(bob, 'payment-request-card', 'false', 'open')) === 'open');
  await bob.page.screenshot({ path: path.join(out, '1-bob-request.png') });

  // 2. Bob pays it.
  await bob.page.getByRole('button', { name: 'Pay privately' }).click();
  const [payment] = await carry(bob, alice);
  const pay = payment ? JSON.parse(payment) : null;
  check('Bob posts one structured payment that names the request', !!pay && pay.type === 'hl.payment' && pay.requestId === JSON.parse(request).id);
  check('the payment never carries the amount', !!payment && !/amount/.test(payment));
  check('Bob sees his payment sent', (await waitState(bob, 'payment-card', 'true', 'sent')) === 'sent');
  check('Bob sees the request paid', (await waitState(bob, 'payment-request-card', 'false', 'paid')) === 'paid');

  // 3. Alice's card does not trust the message: it waits for her wallet.
  check('Alice waits for her wallet before showing it received', (await waitState(alice, 'payment-card', 'false', 'awaiting')) === 'awaiting');

  // 4. The network includes Bob's payment; Alice's wallet finds it.
  await bob.page.evaluate((tx) => window.__paymentsHarness.addActivity({ id: `send-${tx}`, kind: 'send', amount: '1500000', txHash: tx, status: 'settled', createdAt: Date.now() }), pay.txHash);
  check('Bob sees his payment confirmed', (await waitState(bob, 'payment-card', 'true', 'confirmed')) === 'confirmed');
  await alice.page.evaluate((tx) => window.__paymentsHarness.addActivity({ id: `receive-${tx}`, kind: 'receive', token: 'USDC', amount: '1500000', txHash: tx, status: 'settled', createdAt: Date.now() }), pay.txHash);
  check('Alice sees the payment received', (await waitState(alice, 'payment-card', 'false', 'received')) === 'received');
  // A chat message alone never marks Alice's request paid (PaymentRequestCard): only her own wallet's receive does.
  check('Alice sees the request paid', (await waitState(alice, 'payment-request-card', 'true', 'paid')) === 'paid');
  const notice = alice.page.getByText(/You received 1\.5 .* privately\./);
  check('Alice gets one notice with the amount', (await notice.count()) === 1);
  await alice.page.screenshot({ path: path.join(out, '2-alice-received.png') });

  // 5. No page errors on either side.
  check('no page errors for Alice', alice.errors.length === 0, alice.errors.join(' | '));
  check('no page errors for Bob', bob.errors.length === 0, bob.errors.join(' | '));
} catch (e) {
  check('flow completed', false, String(e?.message || e).slice(0, 300));
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(steps, null, 2));
if (failed) {
  console.error('payments e2e: FAILED');
  process.exit(1);
}
console.log(`payments e2e: ${steps.length} checks passed`);
