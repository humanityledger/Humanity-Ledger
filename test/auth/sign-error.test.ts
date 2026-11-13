import { describe, it, expect } from 'vitest';
import { classifySignError, SIGN_MESSAGES } from '@/lib/auth/sign-error';
import { withSignTimeout } from '@/lib/auth/sign-timeout';

describe('classifySignError', () => {
  it('treats code 4001 as a user decline', () => {
    expect(classifySignError({ code: 4001, message: 'whatever' })).toBe('declined');
  });

  it('treats rejected / denied text as a user decline', () => {
    expect(classifySignError(new Error('User rejected the request'))).toBe('declined');
    expect(classifySignError(new Error('Request denied'))).toBe('declined');
  });

  it('treats the sign timeout as expired', async () => {
    const err = await withSignTimeout(new Promise<string>(() => {}), 5).catch((e) => e);
    expect(classifySignError(err)).toBe('expired');
  });

  it('treats transport errors as a lost request', () => {
    expect(classifySignError(new Error('socket stall detected'))).toBe('lost');
    expect(classifySignError(undefined)).toBe('lost');
  });

  it('never shows raw error text', () => {
    expect(SIGN_MESSAGES.lost).toBe(
      'The wallet did not return the signature. Open your wallet, approve, then tap Try again.',
    );
  });
});
