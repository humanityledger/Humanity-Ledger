import { isLocalSimulationAllowed, assertLocalSimulationAllowed } from '@/lib/features/zk';
import { sendTip, createBounty } from '@/lib/zk/zkCommunityPayments';

const KEYS = ['NEXT_PUBLIC_ZK_MODE', 'NEXT_PUBLIC_AZTEC_NETWORK', 'NODE_ENV'] as const;

describe('local ZK simulations never run with real funds', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => KEYS.forEach((k) => (saved[k] = process.env[k])));
  afterEach(() =>
    KEYS.forEach((k) => {
      if (saved[k] === undefined) delete (process.env as Record<string, string | undefined>)[k];
      else (process.env as Record<string, string | undefined>)[k] = saved[k];
    }),
  );
  const set = (k: (typeof KEYS)[number], v: string | undefined) => {
    if (v === undefined) delete (process.env as Record<string, string | undefined>)[k];
    else (process.env as Record<string, string | undefined>)[k] = v;
  };

  it('is refused unless the mode is demo', () => {
    set('NEXT_PUBLIC_ZK_MODE', 'testnet');
    expect(isLocalSimulationAllowed()).toBe(false);
    set('NEXT_PUBLIC_ZK_MODE', undefined);
    expect(isLocalSimulationAllowed()).toBe(false);
  });

  it('is refused on Aztec Alpha even in demo mode', () => {
    set('NEXT_PUBLIC_ZK_MODE', 'demo');
    set('NEXT_PUBLIC_AZTEC_NETWORK', 'alpha');
    set('NODE_ENV', 'development');
    expect(isLocalSimulationAllowed()).toBe(false);
    expect(() => assertLocalSimulationAllowed('X')).toThrow(/not available/);
  });

  it('is refused in a production build even in demo mode', () => {
    set('NEXT_PUBLIC_ZK_MODE', 'demo');
    set('NEXT_PUBLIC_AZTEC_NETWORK', undefined);
    set('NODE_ENV', 'production');
    expect(isLocalSimulationAllowed()).toBe(false);
  });

  it('community tips and bounties cannot fabricate a transaction hash outside demo', () => {
    set('NEXT_PUBLIC_ZK_MODE', undefined);
    expect(() => sendTip({ senderAddress: '0x1', recipientAddress: '0x2', amount: '1', token: 'USDC', communityId: 'c' } as any)).toThrow();
    expect(() => createBounty({ communityId: 'c', postedBy: 'zk:a', title: 't', description: 'd', reward: '1', token: 'USDC' } as any)).toThrow();
  });
});
