/**
 * Sign-in to /beta or /chat without loops: the middleware accepts every valid session the rest of
 * the app accepts, /connect sends everyone to /chat unless a return path says otherwise, and a
 * slow cookie write after a phone returns from its wallet gets one more try.
 */
import fs from 'node:fs';
import { landingAfterSignIn, readLandingStatus } from '@/lib/beta/landing';

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe('where sign-in lands', () => {
  const gated = { member: false, open: true, remaining: 40, gate: true };
  it('an explicit return path wins; a member asking for /beta goes to the chat', () => {
    expect(landingAfterSignIn('/settings', gated)).toBe('/settings');
    expect(landingAfterSignIn('/beta', { member: true, active: true, open: true, gate: true })).toBe('/chat');
    expect(landingAfterSignIn('/chat', gated)).toBe('/chat');
    expect(landingAfterSignIn('/beta?x=1', gated)).toBe('/beta?x=1');
  });
  it('everyone else goes to the chat: the beta limits cUSDC, not the chat', () => {
    expect(landingAfterSignIn(null, { member: true, active: false, open: true, gate: true })).toBe('/chat');
    expect(landingAfterSignIn(null, gated)).toBe('/chat');
    expect(landingAfterSignIn(null, { ...gated, open: false })).toBe('/chat');
    expect(landingAfterSignIn(null, { ...gated, remaining: 0 })).toBe('/chat');
    expect(landingAfterSignIn(null, null)).toBe('/chat');
  });
});

describe('reading the status right after sign-in', () => {
  const noWait = async () => {};
  it('retries once when the cookie is not there yet', async () => {
    let n = 0;
    const f = (async () => (++n === 1 ? reply(401, {}) : reply(200, { member: true, active: true, open: true, remaining: 3 }))) as unknown as typeof fetch;
    expect(await readLandingStatus(f, noWait)).toEqual({ member: true, active: true, open: true, remaining: 3, gate: false });
    expect(n).toBe(2);
  });
  it('gives up quietly on errors and malformed answers', async () => {
    expect(await readLandingStatus((async () => reply(401, {})) as unknown as typeof fetch, noWait)).toBeNull();
    expect(await readLandingStatus((async () => reply(503, {})) as unknown as typeof fetch, noWait)).toBeNull();
    expect(await readLandingStatus((async () => reply(200, { member: 'yes' })) as unknown as typeof fetch, noWait)).toBeNull();
    expect(await readLandingStatus((async () => { throw new Error('offline'); }) as unknown as typeof fetch, noWait)).toBeNull();
  });
});

describe('wiring', () => {
  it('the middleware no longer rejects sessions by a fixed epoch', () => {
    expect(fs.readFileSync('middleware.ts', 'utf8')).not.toMatch(/SESSION_EPOCH/);
  });
  it('/connect lands through the beta status, with one navigation', () => {
    const page = fs.readFileSync('components/landing/ConnectPage.tsx', 'utf8');
    expect(page).not.toMatch(/returnPathFromQuery/);
    expect(page).toMatch(/window\.location\.replace\(landingAfterSignIn\(explicit, status\)\)/);
    expect(page.match(/void goAfterSignIn\(\);/g)?.length).toBeGreaterThanOrEqual(5);
  });
  it('/beta sends a member straight to the chat and keeps the gate pieces', () => {
    const view = fs.readFileSync('components/beta/BetaGateView.tsx', 'utf8');
    expect(view).toMatch(/if \(stage !== 'member' \|\| step === 'done'\) return;\s*if \(allowAutoRedirect\(\)\) router\.replace\('\/chat'\);/);
    expect(view).toMatch(/Closed Beta/);
    expect(view).toMatch(/Ledger Chat · Aztec Alpha Privacy Layer/);
    expect(fs.readFileSync('app/beta/page.tsx', 'utf8')).toMatch(/title: 'Closed Beta · Ledger Chat'/);
  });
});
