/**
 * IA-03 (internal audit, 18 November 2026): the caller is the signed session, never a cookie or
 * header the client chose.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession }));

import { resolveVerifiedCaller } from '@/lib/security/resolveCaller';

const VICTIM = '0x1111111111111111111111111111111111111111';
const ME = '0x2222222222222222222222222222222222222222';

function forged() {
  return new Request('https://ledgerchat.org/api/chat/stories', {
    headers: {
      cookie: `system_handshake=${VICTIM}`,
      'x-web3-address': VICTIM,
      'x-wallet-address': VICTIM,
    },
  });
}

describe('resolveVerifiedCaller', () => {
  beforeEach(() => getSession.mockReset());

  it('without a session, a forged system_handshake cookie or identity header is nobody', async () => {
    getSession.mockResolvedValue(null);
    expect(await resolveVerifiedCaller(forged())).toBeNull();
  });

  it('with a session, the session wins over anything the client sent', async () => {
    getSession.mockResolvedValue({ userId: ME, type: 'access' });
    expect(await resolveVerifiedCaller(forged())).toBe(ME);
  });

  it('the source reads no cookie and no header', () => {
    const src = fs.readFileSync('lib/security/resolveCaller.ts', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(src).not.toMatch(/cookies|headers|system_handshake|x-web3-address|x-wallet-address/);
  });
});
