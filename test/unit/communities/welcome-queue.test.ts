import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { WelcomeQueue } from '@/lib/communities/welcome-queue';

describe('encrypted-channel welcome queue', () => {
  it('reports waiting members per community, never the caller, and forgets after the TTL', () => {
    const q = new WelcomeQueue(1_000);
    q.add('c1', '0xAAA0000000000000000000000000000000000001', 0);
    q.add('c1', '0xbbb0000000000000000000000000000000000002', 10);
    q.add('c2', '0xccc0000000000000000000000000000000000003', 20);
    expect(q.pendingFor(['c1'], '0xaaa0000000000000000000000000000000000001', 30)).toEqual([{ communityId: 'c1', waiting: 1 }]);
    expect(q.pendingFor(['c3'], '0x0', 30)).toEqual([]);
    q.clear('c2', '0xCCC0000000000000000000000000000000000003');
    expect(q.pendingFor(['c2'], '0x0', 30)).toEqual([]);
    expect(q.pendingFor(['c1'], '0x0', 5_000)).toEqual([]);
  });

  it('the route uses the verified session only and checks membership', () => {
    const src = fs.readFileSync('app/api/chat/communities/welcome-queue/route.ts', 'utf8');
    expect(src).toContain('resolveVerifiedCaller(req)');
    expect(src).not.toMatch(/x-web3-address|x-wallet-address/);
    expect(src).toContain('isMember(communityId, caller)');
  });
});
