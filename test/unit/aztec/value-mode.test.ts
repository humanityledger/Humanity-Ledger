/** Exits-only switch: only ever restricts, fails closed. */
import { describe, it, expect } from 'vitest';
import { parseValueMode, currentValueMode, assertNewValueAllowed, EXITS_ONLY_MESSAGE, VALUE_MODE_UNCONFIRMED_MESSAGE } from '@/lib/aztec/value-mode';
import { InvitationNotPostedError } from '@/lib/aztec/agreement-order';

const answer = (status: number, body: unknown) => (async () => ({ ok: status === 200, json: async () => body })) as unknown as typeof fetch;

describe('parseValueMode', () => {
  it('unset or open is open; anything else is exits-only', () => {
    expect(parseValueMode(undefined)).toBe('open');
    expect(parseValueMode('')).toBe('open');
    expect(parseValueMode('open')).toBe('open');
    expect(parseValueMode('exits-only')).toBe('exits-only');
    expect(parseValueMode('OPEN')).toBe('exits-only');
    expect(parseValueMode('paused')).toBe('exits-only');
  });
});

describe('currentValueMode', () => {
  it('follows the server when the build is open', async () => {
    expect(await currentValueMode(answer(200, { mode: 'open' }), 'open')).toEqual({ mode: 'open' });
    expect(await currentValueMode(answer(200, { mode: 'exits-only' }), 'open')).toEqual({ mode: 'exits-only' });
  });
  it('a stricter build wins without asking the server', async () => {
    let asked = false;
    const f = (async () => { asked = true; return { ok: true, json: async () => ({ mode: 'open' }) }; }) as unknown as typeof fetch;
    expect((await currentValueMode(f, 'exits-only')).mode).toBe('exits-only');
    expect(asked).toBe(false);
  });
  it('fails closed on error, non-200 or a malformed answer', async () => {
    const boom = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    expect(await currentValueMode(boom, 'open')).toEqual({ mode: 'exits-only', unconfirmed: true });
    expect(await currentValueMode(answer(500, {}), 'open')).toEqual({ mode: 'exits-only', unconfirmed: true });
    expect(await currentValueMode(answer(200, { mode: 'yes' }), 'open')).toEqual({ mode: 'exits-only', unconfirmed: true });
    expect(await currentValueMode(answer(200, null), 'open')).toEqual({ mode: 'exits-only', unconfirmed: true });
  });
});

describe('assertNewValueAllowed', () => {
  it('passes when open and says why when not', async () => {
    await assertNewValueAllowed(answer(200, { mode: 'open' }), 'open');
    await expect(assertNewValueAllowed(answer(200, { mode: 'exits-only' }), 'open')).rejects.toThrow(EXITS_ONLY_MESSAGE);
    await expect(assertNewValueAllowed(answer(503, {}), 'open')).rejects.toThrow(VALUE_MODE_UNCONFIRMED_MESSAGE);
  });
  it('a pause raised before posting keeps its message through InvitationNotPostedError', async () => {
    let err: unknown;
    try { await assertNewValueAllowed(answer(200, { mode: 'exits-only' }), 'open'); } catch (e) { err = e; }
    expect(new InvitationNotPostedError(err).message).toBe(EXITS_ONLY_MESSAGE);
    expect(new InvitationNotPostedError(new Error('x')).message).toMatch(/could not be posted/);
  });
});
