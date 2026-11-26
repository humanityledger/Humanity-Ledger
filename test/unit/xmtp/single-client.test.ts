import { vi } from 'vitest';

/**
 * One XMTP client per account per tab (26 November 2026). Every Client.create starts a worker on
 * the same database file; a second one appeared when two callers raced, and when the 20 s start-up
 * watchdog gave up on a creation that kept running and the retry started another.
 */
const creates: Array<{ resolve: (c: unknown) => void; reject: (e: unknown) => void }> = [];
const createSpy = vi.fn(() => new Promise((resolve, reject) => { creates.push({ resolve, reject }); }));

vi.mock('@xmtp/browser-sdk', () => ({ Client: { create: createSpy, canMessage: async () => new Map() } }));
vi.mock('@/lib/xmtp/device-key-vault', () => ({
  loadDeviceDbKey: async () => new Uint8Array(32).fill(7),
  saveDeviceDbKey: async () => true,
  randomDbKey: () => new Uint8Array(32).fill(1),
}));
vi.mock('@/lib/xmtp/wallet-kind', () => ({
  detectWalletKind: async () => ({ type: 'EOA' }),
  isPlainEcdsa: () => true,
  SCW_CHAINS: [],
  COUNTERFACTUAL_DEFAULT_CHAIN: 8453,
}));

const ADDR = '0x' + 'c'.repeat(40);
const signer = { getAddress: async () => ADDR, signMessage: async () => '0x' + '1'.repeat(130) };
const fakeClient = (n: number) => ({ n, inboxId: 'inbox-' + n, installationId: 'inst', conversations: {}, close: vi.fn() });

describe('getXMTPClient: one client per account per tab', () => {
  beforeEach(() => { vi.resetModules(); creates.length = 0; createSpy.mockClear(); });

  it('concurrent callers share one Client.create', async () => {
    const { getXMTPClient } = await import('@/lib/xmtp/client');
    const a = getXMTPClient(signer);
    const b = getXMTPClient(signer);
    await new Promise((r) => setTimeout(r, 10));
    expect(createSpy).toHaveBeenCalledTimes(1);
    const c = fakeClient(1);
    creates[0].resolve(c);
    expect(await a).toBe(c);
    expect(await b).toBe(c);
    expect(await getXMTPClient(signer)).toBe(c);
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it('a retry after the watchdog waits for the creation still running instead of starting another', async () => {
    vi.useFakeTimers();
    try {
      const { getXMTPClient } = await import('@/lib/xmtp/client');
      const first = getXMTPClient(signer);
      const firstResult = first.then(() => 'ok', (e: Error) => e.message);
      await vi.advanceTimersByTimeAsync(20_500);
      expect(await firstResult).toMatch(/XMTP_INIT_TIMEOUT/);
      const retry = getXMTPClient(signer);
      await vi.advanceTimersByTimeAsync(100);
      expect(createSpy).toHaveBeenCalledTimes(1); // no second worker on the same database
      const c = fakeClient(2);
      creates[0].resolve(c);
      await vi.advanceTimersByTimeAsync(10);
      expect(await retry).toBe(c);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a creation that finishes after its caller gave up is registered and reused', async () => {
    vi.useFakeTimers();
    try {
      const { getXMTPClient } = await import('@/lib/xmtp/client');
      getXMTPClient(signer).catch(() => {});
      await vi.advanceTimersByTimeAsync(20_500); // the caller gave up
      const late = fakeClient(3);
      creates[0].resolve(late);
      await vi.advanceTimersByTimeAsync(10);
      expect(await getXMTPClient(signer)).toBe(late);
      expect(createSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('after sign-out, a creation still running is closed, not adopted', async () => {
    vi.useFakeTimers();
    try {
      const { getXMTPClient, destroyXMTPClient } = await import('@/lib/xmtp/client');
      getXMTPClient(signer).catch(() => {});
      await vi.advanceTimersByTimeAsync(20_500);
      destroyXMTPClient(ADDR);
      const orphan = fakeClient(4);
      creates[0].resolve(orphan);
      await vi.advanceTimersByTimeAsync(10);
      expect(orphan.close).toHaveBeenCalled();
      const next = getXMTPClient(signer);
      await vi.advanceTimersByTimeAsync(10);
      expect(createSpy).toHaveBeenCalledTimes(2);
      const fresh = fakeClient(5);
      creates[1].resolve(fresh);
      await vi.advanceTimersByTimeAsync(10);
      expect(await next).toBe(fresh);
    } finally {
      vi.useRealTimers();
    }
  });
});
