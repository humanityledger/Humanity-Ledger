// scripts/ui/r8-two-browser.mjs: R8 between two real browsers on the Aztec TEST network.
//   node scripts/ui/r8-two-browser.mjs <baseUrl> <outDir>
//
// Needs a build with NEXT_PUBLIC_E2E_HARNESS=1 (it serves /chat?e2e=r8, components/chat/e2e/R8Harness.tsx),
// the test-network configuration written by scripts/aztec/setup-testnet.mjs (tokens, sponsored FPC,
// faucet) and NEXT_PUBLIC_XMTP_ENV=dev. Alice and Bob are two throwaway Ethereum accounts made here
// for this run: neither is the operator. Each has its own Chromium context (own storage, own PXE,
// own XMTP installation); this script only signs for them and calls the harness steps in order.
//
// Checks, in order:
//   1. both open XMTP and the private wallet (each Aztec account deployed on testnet);
//   2. Alice gets test tokens (faucet, then shield into her private balance);
//   3. a payment to a DM peer whose address has no proof of control is refused before proving;
//   4. both share their Aztec address with a G7 v2 proof over the real DM, and each side pins the
//      other's address as verified (recordPeerAnnouncement, then a fresh verifiedPeerBinding);
//   5. Alice's copy of Bob's proof is refused when replayed to another inbox, forwarded by another
//      sender, checked for another network, with the address swapped and with the signature flipped;
//   6. Alice pays Bob 0.01 privately through sendDirectPrivatePayment (proved in her page) and says so
//      in the DM with the transaction hash;
//   7. Bob's wallet finds the note after a sync and his private balance is 0.01; the DM shows the hash;
//   8. Alice's private balance went down by exactly 0.01;
//   9. R-17 AC-03: Alice makes a community channel's MLS group with Bob, posts, Bob reads it; Alice
//      removes Bob and posts again; Bob's client never gets the second post.
// Writes <outDir>/r8-receipt.json (public data only: addresses, inbox ids, hashes, checks) and a
// screenshot of each page, and appends a summary to $GITHUB_STEP_SUMMARY.
import { chromium } from 'playwright';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] || 'http://localhost:3100';
const out = process.argv[3] || 'r8-e2e';
fs.mkdirSync(out, { recursive: true });

const TOKEN = 'USDC';
const DECIMALS = 6; // zkUSDC (scripts/aztec/setup-testnet.mjs)
const PAY = '0.01';
const PAY_UNITS = 10_000n;
const FUND = '1';
const FUND_UNITS = 1_000_000n;

const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(0);
const receipt = { network: 'aztec-testnet', startedAt: new Date().toISOString(), base, people: {}, steps: [], checks: [] };
let failed = false;
const check = (name, ok, detail = '') => {
  receipt.checks.push({ name, ok, detail: detail || undefined });
  if (!ok) failed = true;
  console.log(`[${secs()}s] ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const step = (name, info = {}) => {
  receipt.steps.push({ name, at: Number(secs()), ...info });
  console.log(`[${secs()}s] step  ${name}${Object.keys(info).length ? ' ' + JSON.stringify(info) : ''}`);
};
const within = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what}: no answer after ${ms / 1000}s`)), ms))]);

const browser = await chromium.launch({ args: ['--enable-features=SharedArrayBuffer'] });

async function open(who) {
  const account = privateKeyToAccount(generatePrivateKey());
  const ctx = await browser.newContext({ viewport: { width: 520, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  await page.exposeFunction('__r8Sign', async (req) => {
    if (req.kind === 'message') return account.signMessage({ message: req.message });
    const td = req.typedData;
    return account.signTypedData({ domain: td.domain, types: td.types, primaryType: td.primaryType, message: td.message });
  });
  await page.goto(`${base}/chat?e2e=r8&as=${who}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  // The app's CSP has no 'unsafe-eval' (kept on purpose): wait on the DOM, then evaluate.
  await page.waitForSelector(`[data-testid="r8-harness"][data-as="${who}"]`, { timeout: 120000 });
  for (let i = 0; i < 60 && !(await page.evaluate(() => !!window.__r8)); i++) await page.waitForTimeout(500);
  const call = (fn, ...args) => page.evaluate(([f, a]) => window.__r8[f](...a), [fn, args]);
  return { who, account, page, errors, call };
}

const shot = async (p, name) => {
  try {
    await p.page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  } catch {
    /* best effort */
  }
};

try {
  const alice = await open('alice');
  const bob = await open('bob');

  // 1. XMTP and the private wallet, both sides at once (account deploys take minutes).
  const [a, b] = await within(Promise.all([alice.call('start', alice.account.address), bob.call('start', bob.account.address)]), 25 * 60_000, 'start');
  receipt.people = {
    alice: { evm: alice.account.address, inboxId: a.inboxId, aztec: a.aztecAddress },
    bob: { evm: bob.account.address, inboxId: b.inboxId, aztec: b.aztecAddress },
  };
  step('both wallets and XMTP clients open', { network: a.network });
  check('two different XMTP inboxes', !!a.inboxId && !!b.inboxId && a.inboxId !== b.inboxId);
  check('two different Aztec accounts', /^0x[0-9a-f]{64}$/i.test(a.aztecAddress) && /^0x[0-9a-f]{64}$/i.test(b.aztecAddress) && a.aztecAddress !== b.aztecAddress);
  check('both wallets name the same Aztec network', !!a.network && a.network === b.network, String(a.network));

  // 2. Alice's test tokens.
  const funded = await within(alice.call('fund', TOKEN, FUND), 20 * 60_000, 'fund');
  step('alice funded', funded);
  const aliceStart = await within(alice.call('balance', TOKEN, FUND_UNITS.toString(), 10 * 60_000), 11 * 60_000, 'alice balance');
  check(`alice holds ${FUND} privately`, BigInt(aliceStart.privateUnits) >= FUND_UNITS, aliceStart.privateUnits);

  // 3. No proof of control, no payment.
  const unverified = await within(alice.call('payUnverified', TOKEN, PAY, 'r8-stranger-inbox'), 5 * 60_000, 'payUnverified');
  check('payment to an unverified pin refused before proving', unverified !== 'SENT' && /proof of control|G7/i.test(unverified), unverified);

  // 4. G7 v2 over the real DM, both ways.
  await within(bob.call('share', alice.account.address, a.inboxId), 5 * 60_000, 'bob share');
  await within(alice.call('share', bob.account.address, b.inboxId), 5 * 60_000, 'alice share');
  step('both shared their Aztec address');
  const aliceGot = await within(alice.call('receive', b.inboxId, 300_000), 6 * 60_000, 'alice receive');
  const bobGot = await within(bob.call('receive', a.inboxId, 300_000), 6 * 60_000, 'bob receive');
  check("alice pinned bob's address as verified", aliceGot.results.some((r) => r.startsWith('pinned:verified') || r.startsWith('unchanged:verified')), aliceGot.results.join(' | '));
  check("alice's fresh G7 check passes for bob's address", aliceGot.binding.verified === true && aliceGot.binding.address?.toLowerCase() === b.aztecAddress.toLowerCase(), aliceGot.binding.reason || '');
  check("bob pinned alice's address as verified", bobGot.results.some((r) => r.startsWith('pinned:verified') || r.startsWith('unchanged:verified')), bobGot.results.join(' | '));
  check("bob's fresh G7 check passes for alice's address", bobGot.binding.verified === true && bobGot.binding.address?.toLowerCase() === a.aztecAddress.toLowerCase(), bobGot.binding.reason || '');

  // 5. The same proof, reused the ways an attacker would.
  const r = await within(alice.call('refusals', b.inboxId, 'r8-other-inbox'), 3 * 60_000, 'refusals');
  receipt.refusals = r;
  check('genuine proof accepted', r.genuine === 'ACCEPTED', r.genuine);
  check('proof replayed to another inbox refused', /replayed|someone else/.test(r.replayedToAnotherInbox), r.replayedToAnotherInbox);
  check('proof forwarded by another sender refused', /someone other than the sender/.test(r.forwardedByAnotherSender), r.forwardedByAnotherSender);
  check('proof checked for another network refused', /another Aztec network/.test(r.otherNetwork), r.otherNetwork);
  check('proof with the address swapped refused', /do not produce this address/.test(r.addressSwapped), r.addressSwapped);
  check('proof with the signature flipped refused', /does not verify|could not be checked/.test(r.signatureFlipped), r.signatureFlipped);

  // 6. The private payment, proved in Alice's page.
  const paid = await within(alice.call('pay', bob.account.address, b.inboxId, TOKEN, PAY), 20 * 60_000, 'pay');
  step('alice paid bob', paid);
  receipt.payment = { token: TOKEN, amount: PAY, txHash: paid.txHash, payee: paid.payee };
  check('payment has a transaction hash', /^0x[0-9a-f]{64}$/i.test(paid.txHash), paid.txHash);
  check('payee is the verified pin of bob', paid.payee.toLowerCase() === b.aztecAddress.toLowerCase());

  // 7. Bob finds it.
  const bobEnd = await within(bob.call('balance', TOKEN, PAY_UNITS.toString(), 15 * 60_000), 16 * 60_000, 'bob balance');
  check(`bob's private balance is ${PAY}`, BigInt(bobEnd.privateUnits) === PAY_UNITS, bobEnd.privateUnits);
  const bobDm = await within(bob.call('receive', a.inboxId, 120_000), 3 * 60_000, 'bob dm');
  check('the DM tells bob the transaction hash', bobDm.texts.some((t) => t.includes(paid.txHash)));

  // 8. Alice paid exactly that.
  const aliceEnd = await within(alice.call('balance', TOKEN, '0', 5 * 60_000), 6 * 60_000, 'alice balance');
  check(`alice's private balance went down by exactly ${PAY}`, BigInt(aliceStart.privateUnits) - BigInt(aliceEnd.privateUnits) === PAY_UNITS, `${aliceStart.privateUnits} -> ${aliceEnd.privateUnits}`);

  // 9. AC-03: a removed member reads nothing new.
  const tag = Math.random().toString(36).slice(2, 8);
  const before = `r8 before removal ${tag}`;
  const after = `r8 after removal ${tag}`;
  const groupId = await within(alice.call('mlsCreate', bob.account.address), 5 * 60_000, 'mlsCreate');
  await within(alice.call('mlsPost', groupId, before), 3 * 60_000, 'mlsPost before');
  const seen = await within(bob.call('mlsRead', groupId, before, 180_000), 4 * 60_000, 'bob reads before');
  check('AC-03: a member reads the group post', seen.inGroup && seen.posts.includes(before), `${seen.posts.length} posts`);
  await within(alice.call('mlsRemove', groupId, bob.account.address), 3 * 60_000, 'mlsRemove');
  await within(alice.call('mlsPost', groupId, after), 3 * 60_000, 'mlsPost after');
  const own = await within(alice.call('mlsRead', groupId, after, 60_000), 2 * 60_000, 'alice reads after');
  check('AC-03: the post after the removal exists', own.posts.includes(after));
  const later = await within(bob.call('mlsRead', groupId, after, 90_000), 3 * 60_000, 'bob reads after');
  check('AC-03: the removed member does not get the post made after the removal', !later.posts.includes(after), `${later.posts.length} posts`);
  receipt.ac03 = { groupCreated: true, removedSeesNew: later.posts.includes(after) };

  await shot(alice, 'alice');
  await shot(bob, 'bob');
  receipt.pageErrors = { alice: alice.errors.slice(0, 30), bob: bob.errors.slice(0, 30) };
} catch (e) {
  failed = true;
  receipt.error = String(e?.message ?? e).slice(0, 500);
  console.error(`[${secs()}s] ERROR`, receipt.error);
}

receipt.finishedAt = new Date().toISOString();
receipt.passed = !failed;
fs.writeFileSync(path.join(out, 'r8-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    `## R8 on the Aztec test network: ${failed ? 'FAILED' : 'passed'}`,
    '',
    'Two throwaway accounts (neither is the operator), two Chromium contexts, real XMTP and a real Aztec node.',
    '',
    ...receipt.checks.map((c) => `- ${c.ok ? '✅' : '❌'} ${c.name}${c.detail ? ` — \`${String(c.detail).slice(0, 120)}\`` : ''}`),
    '',
    receipt.payment ? `Payment: \`${receipt.payment.txHash}\`` : 'No payment was made.',
    receipt.error ? `\nError: \`${receipt.error}\`` : '',
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
}
await browser.close();
process.exit(failed ? 1 : 0);
