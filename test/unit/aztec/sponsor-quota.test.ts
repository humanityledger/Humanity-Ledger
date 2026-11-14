import { describe, expect, it } from 'vitest';
import { DAY_KEY, takeSponsorSlot, walletKey, type QuotaStore } from '@/lib/aztec/sponsor-quota';

/** Same semantics as the Redis store: prune, add, count including the new member. */
function memoryStore(opts: { failOn?: 'add-day' | 'add-wallet' } = {}): QuotaStore & { size(key: string): number } {
  const z = new Map<string, Map<string, number>>();
  return {
    async add(key, now, since, member) {
      if ((opts.failOn === 'add-day' && key === DAY_KEY) || (opts.failOn === 'add-wallet' && key !== DAY_KEY)) throw new Error('down');
      const set = z.get(key) ?? new Map<string, number>();
      for (const [m, score] of set) if (score <= since) set.delete(m);
      set.set(member, now);
      z.set(key, set);
      return set.size;
    },
    async remove(key, member) {
      z.get(key)?.delete(member);
    },
    size: (key) => z.get(key)?.size ?? 0,
  };
}

const L = { perWallet: 3, perDay: 5 };
const T0 = 1_800_000_000_000;

describe('sponsor quota', () => {
  it('gives a wallet exactly perWallet slots for life, and refusals use up nothing', async () => {
    const s = memoryStore();
    for (let i = 0; i < 3; i++) expect(await takeSponsorSlot(s, '0xA', L, T0 + i)).toBe('ok');
    for (let i = 0; i < 5; i++) expect(await takeSponsorSlot(s, '0xA', L, T0 + 10 + i)).toBe('used-up');
    expect(s.size(walletKey('0xa'))).toBe(3);
    expect(s.size(DAY_KEY)).toBe(3);
  });

  it('a refusal at the daily limit does not cost the wallet one of its lifetime slots (the bug fixed here)', async () => {
    const s = memoryStore();
    for (let i = 0; i < 5; i++) expect(await takeSponsorSlot(s, `0x${i}`, L, T0 + i)).toBe('ok');
    for (let i = 0; i < 10; i++) expect(await takeSponsorSlot(s, '0xB', L, T0 + 100 + i)).toBe('daily-limit');
    expect(s.size(walletKey('0xB'))).toBe(0);
    expect(s.size(DAY_KEY)).toBe(5);
    // The next day the same wallet still has all 3.
    const tomorrow = T0 + 86_400_000 + 1_000;
    for (let i = 0; i < 3; i++) expect(await takeSponsorSlot(s, '0xB', L, tomorrow + i)).toBe('ok');
    expect(await takeSponsorSlot(s, '0xB', L, tomorrow + 9)).toBe('used-up');
  });

  it('concurrent requests never pass both limits beyond the maximum', async () => {
    const s = memoryStore();
    const results = await Promise.all(Array.from({ length: 50 }, (_, i) => takeSponsorSlot(s, '0xC', { perWallet: 3, perDay: 200 }, T0 + i)));
    expect(results.filter((r) => r === 'ok').length).toBeLessThanOrEqual(3);
    expect(s.size(walletKey('0xC'))).toBeLessThanOrEqual(3);
    expect(s.size(DAY_KEY)).toBe(s.size(walletKey('0xC')));
  });

  it('wallets are case-insensitive and a limit of 0 turns sponsorship off', async () => {
    const s = memoryStore();
    expect(await takeSponsorSlot(s, '0xAbC', { perWallet: 1, perDay: 9 }, T0)).toBe('ok');
    expect(await takeSponsorSlot(s, '0xabc', { perWallet: 1, perDay: 9 }, T0 + 1)).toBe('used-up');
    expect(await takeSponsorSlot(s, '0xD', { perWallet: 0, perDay: 9 }, T0 + 2)).toBe('used-up');
    expect(await takeSponsorSlot(s, '0xE', { perWallet: 3, perDay: 0 }, T0 + 3)).toBe('daily-limit');
    expect(s.size(walletKey('0xE'))).toBe(0);
  });

  it('fails closed when the store is down, and gives back what it took', async () => {
    const day = memoryStore({ failOn: 'add-day' });
    expect(await takeSponsorSlot(day, '0xF', L, T0)).toBe('unavailable');
    expect(day.size(walletKey('0xF'))).toBe(0);
    expect(await takeSponsorSlot(memoryStore({ failOn: 'add-wallet' }), '0xF', L, T0)).toBe('unavailable');
  });
});
