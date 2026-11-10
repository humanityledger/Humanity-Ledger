/**
 * 4.13: an invitation is posted before funding, and funding never runs when
 * posting fails. A failure after posting is reported so the sender opens a new
 * agreement instead of funding the same escrow_id twice.
 */
import { describe, it, expect } from 'vitest';
import { FundingAfterPostError, InvitationNotPostedError, postThenFund } from '@/lib/aztec/agreement-order';

describe('postThenFund', () => {
  it('posts, then funds, in that order', async () => {
    const order: string[] = [];
    const r = await postThenFund('{"raw":1}', async (raw) => void order.push(`post ${raw}`), async () => (order.push('fund'), 'tx'));
    expect(r).toBe('tx');
    expect(order).toEqual(['post {"raw":1}', 'fund']);
  });

  it('never funds when posting fails', async () => {
    let funded = false;
    await expect(postThenFund('x', async () => { throw new Error('offline'); }, async () => { funded = true; })).rejects.toThrow('Nothing was deposited');
    expect(funded).toBe(false);
    const e = await postThenFund('x', async () => { throw new Error('offline'); }, async () => 1).catch((x) => x);
    expect(e instanceof InvitationNotPostedError).toBe(true);
    expect(e.name).toBe('InvitationNotPostedError');
  });

  it('reports a funding failure after posting as "do not fund again"', async () => {
    const e = await postThenFund('x', async () => {}, async () => { throw new Error('Timeout awaiting isMined'); }).catch((x) => x);
    expect(e instanceof FundingAfterPostError).toBe(true);
    expect(e.name).toBe('FundingAfterPostError');
    expect(e.message).toMatch(/Do not fund it again/);
    expect(e.message).toMatch(/Timeout awaiting isMined/);
  });

  it('without a post step, only funds and passes errors through (scripts, e2e)', async () => {
    expect(await postThenFund('x', undefined, async () => 7)).toBe(7);
    await expect(postThenFund('x', undefined, async () => { throw new Error('boom'); })).rejects.toThrow('boom');
  });
});
