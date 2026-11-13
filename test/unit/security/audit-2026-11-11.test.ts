import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { RETIRED_API_ROUTES, isRetiredApiRoute } from '@/lib/security/retiredRoutes';

/**
 * 2026-11-11: UI to backend wiring.
 *
 * 1. Nothing the client calls is retired (a call to a retired route is a 410 in production).
 * 2. Every API path the client calls has a route file.
 * 3. Cron, webhook, admin and public-API routes are never retired by an audit of the client.
 */

const ROOT = path.resolve(__dirname, '../../..');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const apiDir = path.join(ROOT, 'app/api');
const routeFiles = walk(apiDir).filter(f => f.endsWith('route.ts'));
const routes = routeFiles.map(f => path.relative(apiDir, path.dirname(f)).split(path.sep).filter(s => !/^\(.*\)$/.test(s)));

function hasRoute(callPath: string): boolean {
  const segs = callPath.replace(/^\/api\//, '').replace(/\?.*$/, '').replace(/\/$/, '').split('/');
  return routes.some(r => r.length === segs.length && r.every((s, i) => /^\[.+\]$/.test(s) || segs[i] === '*' || s === segs[i]));
}

const clientFiles = ['app', 'components', 'hooks', 'context', 'lib']
  .flatMap(d => (fs.existsSync(path.join(ROOT, d)) ? walk(path.join(ROOT, d)) : []))
  .filter(f => !f.startsWith(apiDir) && !f.endsWith('retiredRoutes.ts'));

const CALL = /fetch\(\s*[`'"](\/api\/[^`'"?\s]*)/g;
const calls: { file: string; url: string }[] = [];
for (const f of clientFiles) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(CALL)) calls.push({ file: path.relative(ROOT, f), url: m[1].replace(/\$\{[^}]*\}/g, '*') });
}

describe('client to API wiring', () => {
  it('finds the calls it is meant to check', () => {
    expect(calls.length).toBeGreaterThan(40);
  });

  it('never calls a retired route', () => {
    const bad = calls.filter(c => isRetiredApiRoute(c.url.replace(/\*/g, 'x')));
    expect(bad).toEqual([]);
  });

  it('only calls routes that have a handler', () => {
    const bad = calls.filter(c => !hasRoute(c.url));
    expect(bad).toEqual([]);
  });
});

describe('retired list', () => {
  it('has no duplicates', () => {
    expect(new Set(RETIRED_API_ROUTES).size).toBe(RETIRED_API_ROUTES.length);
  });

  it('answers 410 for the routes added by the 2026-11-11 audit', () => {
    for (const p of ['/api/forum/posts', '/api/forum/topics/abc', '/api/market/prices', '/api/wallet/swap/quote', '/api/network/mempool/recent', '/api/academy/sync', '/api/premium/prover']) {
      expect(isRetiredApiRoute(p)).toBe(true);
    }
  });

  it('never retires routes called from outside the repository', () => {
    const external = /^\/api\/(webhooks|payments|internal|admin|v1|siwe|auth|chat|aztec|call|user|identity|moderation|geo|golden-ticket|security\/csp-report|notifications\/ingest)\b/;
    // Earlier audits retired some of these on purpose; this audit must add none.
    const added = RETIRED_API_ROUTES.slice(RETIRED_API_ROUTES.indexOf('/api/academy/parse-document'), RETIRED_API_ROUTES.indexOf('/api/auth/me'));
    expect(added.filter(r => external.test(r))).toEqual([]);
  });

  it('answers 410 for the second pass (calls, invites, gates, auth helpers, Aztec operator routes)', () => {
    for (const p of ['/api/call/token', '/api/call/room/abc/join', '/api/call/join/abc', '/api/chat/communities/c1/invite', '/api/chat/communities/c1/gate', '/api/auth/me', '/api/identity/token', '/api/aztec/deploy-token', '/api/auth/qr-sync-seed', '/api/chat/telemetry', '/api/moderation/status']) {
      expect(isRetiredApiRoute(p)).toBe(true);
    }
  });

  it('keeps the community apps routes the UI uses', () => {
    for (const p of ['/api/chat/communities/c1/apps', '/api/chat/communities/c1/apps/a1', '/api/chat/communities/c1/apps/a1/state', '/api/chat/communities/c1/apps/a1/frame', '/api/chat/communities/join', '/api/chat/communities/c1/posts', '/api/chat/attachments/abc']) {
      expect(isRetiredApiRoute(p)).toBe(false);
    }
  });

  it('keeps the scheduled and health routes served', () => {
    for (const p of ['/api/network/getblock-health', '/api/ledger/alerts/check', '/api/scanner/status', '/api/network/ledger/watch', '/api/aztec/value-mode']) {
      expect(isRetiredApiRoute(p)).toBe(false);
    }
  });
});
