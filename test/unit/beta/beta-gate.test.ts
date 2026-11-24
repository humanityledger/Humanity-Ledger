/**
 * The 100-person cUSDC beta gate: codes and their table, redemption with the operator's checks and
 * the 100 cap, /beta's screens and code input, the hidden → send transition, and the payment form's
 * checks. The last block runs redeem → visibility → payment capability end to end in memory.
 */
import fs from 'node:fs';
import { hashInviteCode, normalizeInviteCode } from '@/lib/alpha/invites';
import {
  CODES_FILE, MAX_BETA_CODES, TABLE_HEADER, betaCodeHash, canonicalCode, inviteStatus, newBetaCode, newBetaCodes, parseCodesTable,
  redeemedLine, renderCodesTable, resolveCodeArg, tableMeta,
} from '@/lib/beta/invite-codes.mjs';
import { BETA_NOTICE_VERSION, BETA_REASONS, cusdcBetaVisibility } from '@/lib/beta/cusdc-beta';
import {
  BAD_CODE, BETA_FULL, NOT_ACTIVE, memberState, recipientAnswer, redeemBetaInvite, remainingPlaces, type BetaMemberRow, type BetaStore,
} from '@/lib/beta/cusdc-beta-store';
import {
  EMPTY_BLOCKS, applyBlockInput, betaSummary, blocksToCode, capacityPill, codeBlocks, gateStage, isCompleteCode, redeemErrorView, shortAddress,
  type GateStatus,
} from '@/lib/beta/gate';
import {
  __resetCusdcBetaClient, assertCusdcBetaAllows, invalidateCusdcBeta, parseRecipientAnswer, refreshCusdcBeta, visibilityAfter,
} from '@/lib/beta/cusdc-beta-client';
import { tokensFor, type TokenConfig } from '@/lib/aztec/wallet/config';
import { balanceProblem, recipientProblem } from '@/lib/payments/send-checks';
import { paidRequestIds, rememberPaidRequest, requestSettlement } from '@/lib/payments/paid-requests';
import { BANNED } from '@/lib/landing/claims';

const PEPPER = 'q'.repeat(40);
const now = new Date('2026-12-01T00:00:00Z');
const wallet = (n: number) => '0x' + n.toString(16).padStart(40, '0');
let seed = 1;
const rand = (n: number) => Uint8Array.from({ length: n }, () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) & 255);

describe('codes', () => {
  it('are 16 Crockford characters in four blocks, distinct, at most 100 per run', () => {
    const codes = newBetaCodes(100, rand);
    expect(codes).toHaveLength(100);
    expect(new Set(codes).size).toBe(100);
    for (const c of codes) expect(c).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    expect(() => newBetaCodes(101, rand)).toThrow();
    expect(() => newBetaCodes(0, rand)).toThrow();
    expect(MAX_BETA_CODES).toBe(100);
  });
  it('hash exactly as the redeem endpoint does (lib/alpha/invites.ts)', () => {
    for (let i = 0; i < 20; i++) {
      const c = newBetaCode(rand);
      expect(canonicalCode(c)).toBe(normalizeInviteCode(c));
      expect(betaCodeHash(c, PEPPER)).toBe(hashInviteCode(normalizeInviteCode(c)!, PEPPER));
      expect(betaCodeHash(c.toLowerCase().replace(/-/g, ' '), PEPPER)).toBe(betaCodeHash(c, PEPPER));
    }
    expect(() => betaCodeHash('0123-4567-89AB-CDEF', 'short')).toThrow(/ALPHA_INVITE_PEPPER/);
    expect(() => betaCodeHash('nope', PEPPER)).toThrow();
  });
});

describe('the operator table', () => {
  const codes = newBetaCodes(3, rand);
  const md = renderCodesTable(codes.map((code) => ({ code, status: 'Unassigned' })), { generatedAt: now, by: wallet(9), redeemed: 0 });
  it('has the agreed columns and reads back in order', () => {
    expect(md).toContain(TABLE_HEADER);
    expect(md).toContain('0 / 100 redeemed');
    expect(parseCodesTable(md)).toEqual(codes.map((code, i) => ({ n: i + 1, code })));
    expect(tableMeta(md)).toEqual({ generatedAt: now, by: wallet(9) });
  });
  it('resolves #n or a typed code', () => {
    const table = parseCodesTable(md);
    expect(resolveCodeArg('#2', table)).toBe(codes[1]);
    expect(resolveCodeArg('3', table)).toBe(codes[2]);
    expect(resolveCodeArg(codes[0].toLowerCase(), [])).toBe(codes[0]);
    expect(() => resolveCodeArg('#9', table)).toThrow(/no code #9/);
    expect(() => resolveCodeArg('xx', table)).toThrow();
  });
  it('status of each row', () => {
    const base = { revokedAt: null, redeemedBy: null, expiresAt: null, sanctionsResult: null, adultCheckedAt: null };
    expect(inviteStatus(base, now)).toBe('Unassigned');
    expect(inviteStatus({ ...base, sanctionsResult: 'clear', adultCheckedAt: now }, now)).toBe('Assigned');
    expect(inviteStatus({ ...base, redeemedBy: wallet(1) }, now)).toBe('Redeemed');
    expect(inviteStatus({ ...base, revokedAt: now, redeemedBy: wallet(1) }, now)).toBe('Revoked');
    expect(inviteStatus({ ...base, expiresAt: now }, now)).toBe('Expired');
    expect(inviteStatus(undefined, now)).toBe('Unknown');
    expect(redeemedLine(42)).toBe('42 / 100 redeemed');
  });
  it('the file is never committed and is written owner-only', () => {
    expect(fs.readFileSync('.gitignore', 'utf8')).toContain(CODES_FILE);
    const gen = fs.readFileSync('scripts/beta/generate-100-codes.mjs', 'utf8');
    expect(gen).toMatch(/flag: 'wx', mode: 0o600/);
    expect(gen).toMatch(/open \+ count > MAX_BETA_CODES/);
    expect(gen).toMatch(/betaCodeHash\(code, pepper\)/);
    const ops = fs.readFileSync('scripts/beta/cusdc-invites.mjs', 'utf8');
    expect(ops).toMatch(/cmd === 'assign'/);
    expect(ops).toMatch(/inviteChecksProblem\(checks\)/);
    expect(ops).toMatch(/cmd === 'export-table'/);
  });
});

/** The Prisma store's rules (lib/beta/cusdc-beta-prisma.ts) over memory. */
type Invite = { redeemedBy: string | null; revoked: boolean; checked: boolean; expiresAt: Date | null };
function store(codes: Record<string, Partial<Invite>>) {
  const invites = new Map(Object.entries(codes).map(([c, x]) => [betaCodeHash(c, PEPPER), { redeemedBy: null, revoked: false, checked: true, expiresAt: null, ...x } as Invite]));
  const members = new Map<string, BetaMemberRow>();
  const s: BetaStore = {
    async findMember(w) { return members.get(w) ?? null; },
    async redeem({ wallet: w, codeHash, capacity, noticeVersion, at }) {
      if (members.size >= capacity) return 'full';
      const inv = invites.get(codeHash);
      const usable = inv && !inv.redeemedBy && !inv.revoked && (!inv.expiresAt || inv.expiresAt > at);
      if (!usable) return 'bad';
      if (!inv.checked) return 'inactive';
      inv.redeemedBy = w;
      const row = { walletAddress: w, revokedAt: null, noticeVersion, noticeAckAt: at };
      members.set(w, row);
      return row;
    },
    async redeemReserved() { return 'bad'; },
    async countMembers() { return members.size; },
    async confirmNotice(w, v, at) { const m = { ...members.get(w)!, noticeVersion: v, noticeAckAt: at }; members.set(w, m); return m; },
  };
  return { s, members, invites };
}
const redeemInput = (w: string, code: string) => ({ wallet: w, code, notice: true, noticeVersion: BETA_NOTICE_VERSION, pepper: PEPPER, capacity: 100, open: true, now });

describe('redemption', () => {
  it('needs the operator checks recorded for the code (assign)', async () => {
    const [a, b] = newBetaCodes(2, rand);
    const { s } = store({ [a]: { checked: false }, [b]: {} });
    expect(await redeemBetaInvite(s, redeemInput(wallet(1), a))).toEqual({ status: 403, body: { error: NOT_ACTIVE } });
    expect((await redeemBetaInvite(s, redeemInput(wallet(1), b))).status).toBe(200);
  });
  it('one answer for invalid, used, revoked and expired codes', async () => {
    const [used, revoked, expired] = newBetaCodes(3, rand);
    const { s } = store({ [used]: {}, [revoked]: { revoked: true }, [expired]: { expiresAt: now } });
    expect((await redeemBetaInvite(s, redeemInput(wallet(1), used))).status).toBe(200);
    for (const c of [used, revoked, expired, 'ZZZZ-ZZZZ-ZZZZ-ZZZZ', 'short']) {
      expect(await redeemBetaInvite(s, redeemInput(wallet(2), c))).toEqual({ status: 400, body: { error: BAD_CODE } });
    }
  });
  it('already redeemed: the same wallet trying again is a member, not an error', async () => {
    const [c] = newBetaCodes(1, rand);
    const { s } = store({ [c]: {} });
    expect((await redeemBetaInvite(s, redeemInput(wallet(1), c))).status).toBe(200);
    expect(await redeemBetaInvite(s, redeemInput(wallet(1), c))).toEqual({ status: 200, body: { member: true } });
  });
  it('admits 100 people and refuses the 101st, with the counter going to zero', async () => {
    const codes = newBetaCodes(100, rand);
    const extra = newBetaCodes(1, rand)[0];
    const { s } = store(Object.fromEntries([...codes, extra].map((c) => [c, {}])));
    for (let i = 0; i < 100; i++) {
      expect((await redeemBetaInvite(s, redeemInput(wallet(i + 1), codes[i]))).status).toBe(200);
      expect(remainingPlaces(100, await s.countMembers())).toBe(99 - i);
    }
    expect(await redeemBetaInvite(s, redeemInput(wallet(101), extra))).toEqual({ status: 409, body: { error: BETA_FULL } });
    expect(remainingPlaces(100, 130)).toBe(0);
    expect(remainingPlaces(100, null)).toBeNull();
  });
  it('the endpoint keeps its session, rate limit and the checks in the database query', () => {
    const route = fs.readFileSync('app/api/beta/cusdc/redeem/route.ts', 'utf8');
    expect(route).toMatch(/getVerifiedCaller/);
    expect(route).toMatch(/max: 5, windowSec: 3600/);
    const prisma = fs.readFileSync('lib/beta/cusdc-beta-prisma.ts', 'utf8');
    expect(prisma).toMatch(/sanctionsResult: 'clear', adultCheckedAt: \{ not: null \}/);
    expect(prisma).toMatch(/pg_advisory_xact_lock/);
    const status = fs.readFileSync('app/api/beta/cusdc/status/route.ts', 'utf8');
    expect(status).toMatch(/remaining: remainingPlaces\(capacity, members\)/);
    expect(status).toMatch(/wallet: w,/);
  });
});

describe('/beta', () => {
  const st = (x: Partial<GateStatus> = {}): GateStatus => ({
    wallet: wallet(7), open: true, reasons: [], member: false, active: false, access: false, accessReasons: [], visibility: 'hidden',
    capacity: 100, remaining: 58, notice: { version: BETA_NOTICE_VERSION, text: ['a'] }, ...x,
  });
  it('picks the screen', () => {
    expect(gateStage(null)).toBe('loading');
    expect(gateStage(null, { signedOut: true })).toBe('signedOut');
    expect(gateStage(st(), { failed: true })).toBe('unavailable');
    expect(gateStage(st())).toBe('join');
    expect(gateStage(st({ remaining: 0 }))).toBe('full');
    expect(gateStage(st({ open: false }))).toBe('closed');
    expect(gateStage(st({ member: true, active: true, access: true, remaining: 0 }))).toBe('member');
    expect(gateStage(st({ member: true, active: true, accessReasons: [BETA_REASONS.notice] }))).toBe('notice');
    expect(gateStage(st({ member: true, active: true, accessReasons: [BETA_REASONS.off] }))).toBe('waiting');
    expect(gateStage(st({ member: true, active: false }))).toBe('revoked');
  });
  it('the code input takes caps, look-alikes, spaces, hyphens and a paste into any block', () => {
    expect(codeBlocks('abcd efgh-jkmn pqrs')).toEqual(['ABCD', 'EFGH', 'JKMN', 'PQRS']);
    expect(codeBlocks('oIl0')).toEqual(['0110', '', '', '']);
    let r = applyBlockInput(EMPTY_BLOCKS, 2, ' 0123-4567-89ab-cdef ');
    expect(r).toEqual({ blocks: ['0123', '4567', '89AB', 'CDEF'], focus: 3 });
    expect(blocksToCode(r.blocks)).toBe('0123-4567-89AB-CDEF');
    expect(isCompleteCode(r.blocks)).toBe(true);
    r = applyBlockInput(EMPTY_BLOCKS, 0, 'ab');
    expect(r).toEqual({ blocks: ['AB', '', '', ''], focus: 0 });
    r = applyBlockInput(r.blocks, 0, 'abcd');
    expect(r.focus).toBe(1);
    r = applyBlockInput(['ABCD', '', '', ''], 1, 'efghjk');
    expect(r).toEqual({ blocks: ['ABCD', 'EFGH', 'JK', ''], focus: 2 });
    expect(isCompleteCode(r.blocks)).toBe(false);
    expect(applyBlockInput(EMPTY_BLOCKS, 0, '!!').blocks).toEqual(EMPTY_BLOCKS);
  });
  it('says what each redeem answer means, and where to go', () => {
    expect(redeemErrorView(null, null).text).toMatch(/same code is safe/);
    expect(redeemErrorView(401, {}).step).toBe('wallet');
    expect(redeemErrorView(401, {}).text).toMatch(/code was not used/);
    expect(redeemErrorView(400, { error: BAD_CODE })).toEqual({ text: BAD_CODE, step: 'code' });
    expect(redeemErrorView(400, { error: 'Read and confirm the current beta notice.' }).step).toBe('notice');
    expect(redeemErrorView(403, { error: NOT_ACTIVE })).toEqual({ text: NOT_ACTIVE, step: 'code' });
    expect(redeemErrorView(409, { error: BETA_FULL })).toEqual({ text: BETA_FULL, step: 'stay' });
    expect(redeemErrorView(429, {}).text).toMatch(/hour/);
    expect(redeemErrorView(503, {}).text).toMatch(/not open/);
  });
  it('shows the live capacity and the wallet', () => {
    expect(capacityPill(100, 58)).toBe('Closed Beta • 100 spots total • 58 remaining');
    expect(capacityPill(100, null)).toBe('Closed Beta • 100 spots total');
    expect(shortAddress(wallet(255))).toBe('0x0000…00ff');
  });
  it('Settings > Payments reads the same status', () => {
    expect(betaSummary(null, { applies: false }).value).toBe('Not open');
    expect(betaSummary(st(), { applies: true })).toEqual({ value: 'Invitation only', sub: '58 of 100 places left. Join with your invitation code.' });
    expect(betaSummary(st({ member: true, active: true, access: true }), { applies: true }).value).toBe('Member');
    expect(betaSummary(null, { applies: true, signedOut: true }).value).toBe('Invitation only');
    const settings = fs.readFileSync('components/chat/LedgerSettingsFull.tsx', 'utf8');
    expect(settings).toMatch(/<PaymentsAvailability \/>/);
    const panel = fs.readFileSync('components/beta/PaymentsAvailability.tsx', 'utf8');
    for (const s of ['ETH, USDC or USDT on Ethereum mainnet', 'On Aztec Alpha in ${PRIVATE_ASSET.phrase}', 'Fee Juice', "href={applies ? '/beta' : undefined}"]) expect(panel).toContain(s);
  });
  it('the new texts make no claim the landing forbids', () => {
    for (const f of ['components/beta/BetaGateView.tsx', 'components/beta/PaymentsAvailability.tsx', 'lib/beta/gate.ts', 'lib/payments/send-checks.ts', 'docs/beta/CUSDC_BETA.md']) {
      const text = fs.readFileSync(f, 'utf8');
      for (const re of BANNED) expect(text, `${f} ${re}`).not.toMatch(re);
    }
  });
  it('the page is the gate, unlocks with the notice version and drops the cached answer', () => {
    expect(fs.readFileSync('app/beta/page.tsx', 'utf8')).toMatch(/<BetaGateView \/>/);
    const view = fs.readFileSync('components/beta/BetaGateView.tsx', 'utf8');
    expect(view).toMatch(/Unlock cUSDC Beta/);
    expect(view).toMatch(/noticeVersion: status\.notice\.version/);
    expect(view).toMatch(/invalidateCusdcBeta\(\);\n    setStep\('done'\);/);
    expect(view).toMatch(/\/connect\?redirect=%2Fbeta/);
  });
});

describe('redeem → visibility → payment capability', () => {
  const open = {
    entry: { enabled: true, until: '2027-02-01T00:00:00Z', maxTesters: 100 },
    cusdc: { symbol: 'cUSDC', address: '0x30112e52178143b74cf6037d047bbba924f4b0db8aab587a340aacfc6ecb4f38', decimals: 6, verifiedOnChain: true },
    cap: 5_000_000n,
    now,
  };
  const tok = (key: TokenConfig['key'], symbol: string): TokenConfig => ({ key, address: '0x' + 'ab'.repeat(32), symbol, decimals: 6 });
  const lists = { public: [tok('USDC', 'HLC')], withBeta: [tok('USDC', 'HLC'), tok('CUSDC', 'cUSDC')] };
  const reply = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
  beforeEach(() => __resetCusdcBetaClient());

  it('a redeemed member moves from hidden to send at once, and may pay; others stay hidden and are refused', async () => {
    const [c] = newBetaCodes(1, rand);
    const { s } = store({ [c]: {} });
    const alice = wallet(0xa);
    const before = memberState(await s.findMember(alice));
    expect(cusdcBetaVisibility({ ...open, member: before })).toBe('hidden');
    expect(tokensFor(cusdcBetaVisibility({ ...open, member: before }), lists).map((t) => t.key)).toEqual(['USDC']);

    // The wallet asked a moment ago (hidden) and caches that for a minute.
    let asked = 0;
    const counting = (body: unknown) => (async () => { asked++; return new Response(JSON.stringify(body), { status: 200 }); }) as unknown as typeof fetch;
    await refreshCusdcBeta(counting({ visibility: 'hidden' }), 1_000, () => true);
    expect(asked).toBe(1);
    expect((await redeemBetaInvite(s, redeemInput(alice, c))).status).toBe(200);
    const after = memberState(await s.findMember(alice));
    const server = cusdcBetaVisibility({ ...open, member: after });
    expect(server).toBe('send');
    // Without invalidation the cached answer stands for a minute; /beta drops it right after redeem.
    await refreshCusdcBeta(counting({ visibility: server }), 2_000, () => true);
    expect(asked).toBe(1);
    invalidateCusdcBeta();
    await refreshCusdcBeta(counting({ visibility: server }), 3_000, () => true);
    expect(asked).toBe(2);
    expect(visibilityAfter('hidden', server)).toBe('send');
    expect(tokensFor(visibilityAfter('hidden', server), lists).map((t) => t.key)).toEqual(['USDC', 'CUSDC']);
    await assertCusdcBetaAllows('CUSDC', reply({ visibility: server }), () => true);

    // The recipient check: Bob has not joined, so a cUSDC payment to him stops before any proof.
    const bob = wallet(0xb);
    expect(recipientAnswer(await s.findMember(alice), await s.findMember(bob))).toEqual({ status: 200, body: { member: false } });
    expect(recipientAnswer(null, await s.findMember(alice)).status).toBe(403);
    expect(recipientProblem(parseRecipientAnswer(true, { member: false }), 'Bob')!.text).toMatch(/not in the cUSDC beta/);
    expect(recipientProblem(parseRecipientAnswer(true, { member: true }), 'Bob')).toBeNull();
    expect(recipientProblem(parseRecipientAnswer(false, null), 'Bob')!.text).toMatch(/Could not check/);
    expect(recipientProblem(null, 'Bob')!.checking).toBe(true);
    await expect(assertCusdcBetaAllows('CUSDC', reply({ visibility: cusdcBetaVisibility({ ...open, member: null }) }), () => true)).rejects.toThrow(/closed beta/);
  });

  it('the form stops a payment above the private balance, and the wiring is in place', () => {
    const t = { symbol: 'cUSDC', decimals: 6 };
    expect(balanceProblem('2', t, { privateUnits: 1_500_000n, publicUnits: 0n })).toMatch(/1.5 cUSDC, less than this payment/);
    expect(balanceProblem('2', t, { privateUnits: 1_000_000n, publicUnits: 5_000_000n })).toMatch(/Make your public cUSDC private/);
    expect(balanceProblem('1.5', t, { privateUnits: 1_500_000n, publicUnits: 0n })).toBeNull();
    expect(balanceProblem('2', t, undefined)).toBeNull();
    expect(balanceProblem('abc', t, { privateUnits: 0n, publicUnits: 0n })).toBeNull();
    const modal = fs.readFileSync('components/chat/ZkMoneyModal.tsx', 'utf8');
    // Send stays blocked while paused, for a recipient problem or a low balance (other checks may join).
    const blockedLine = modal.match(/const blocked = [^\n]*;/)?.[0] ?? '';
    for (const cond of ['!!paused', '!!recipientIssue', '!!lowBalance']) expect(blockedLine).toContain(cond);
    expect(blockedLine).not.toMatch(/&&\s*!!(paused|recipientIssue|lowBalance)/);
    expect(modal).toMatch(/token === 'CUSDC' && betaApplies\(\)/);
    const route = fs.readFileSync('app/api/beta/cusdc/member/route.ts', 'utf8');
    expect(route).toMatch(/getVerifiedCaller/);
    expect(route).toMatch(/checkRateLimit/);
    expect(route).toMatch(/recipientAnswer\(caller, target\)/);
  });

  it('a request whose payment failed opens again', () => {
    const m = new Map<string, string>();
    const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    rememberPaidRequest('req_ok', '0xAA', st);
    rememberPaidRequest('req_bad', '0xbb', st);
    const activity = [{ kind: 'send', txHash: '0xaa', status: 'settled' }, { kind: 'send', txHash: '0xbb', status: 'failed' }];
    expect([...paidRequestIds(st, activity)]).toEqual(['req_ok']);
    expect(requestSettlement({ id: 'req_bad', amount: '1', tokenKey: 'CUSDC' }, activity, st)).toBe('failed');
    rememberPaidRequest('req_bad', '0xcc', st);
    expect([...paidRequestIds(st, activity)].sort()).toEqual(['req_bad', 'req_ok']);
    m.set('hl.payments.paidRequests.v1', JSON.stringify(['req_old']));
    expect(paidRequestIds(st, activity).has('req_old')).toBe(true);
  });
});
