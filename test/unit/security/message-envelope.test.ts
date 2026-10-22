import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isSealedEnvelope,
  checkMessageEnvelope,
  withinSizeLimit,
  ENVELOPE_PREFIX,
} from '@/lib/security/messageEnvelope';

/**
 * F2-02 regression — the server must not silently become readable again.
 *
 * These tests assert the refusal, not the happy path. A test that only checked
 * that a sealed envelope is accepted would pass against the broken version too.
 */

const SEALED = `${ENVELOPE_PREFIX}mls.q83nF9xKd2JpLm4vQ1RsZXh0`;

describe('isSealedEnvelope', () => {
  it('accepts a well-formed hlv1 envelope', () => {
    expect(isSealedEnvelope(SEALED)).toBe(true);
  });

  it.each([
    ['a readable sentence', 'hey, are we still on for tomorrow?'],
    ['an empty string', ''],
    ['a prefix with nothing after it', 'hlv1.'],
    ['a prefix with no payload', 'hlv1.mls.'],
    ['a wrong version', 'hlv0.mls.q83nF9xKd2Jp'],
    ['text that merely mentions the prefix', 'see hlv1.mls.abc for details'],
    ['a payload with characters outside base64url', 'hlv1.mls.abc$def'],
    ['a non-string', { ciphertext: 'abc' } as unknown],
    ['null', null as unknown],
  ])('rejects %s', (_label, value) => {
    expect(isSealedEnvelope(value)).toBe(false);
  });
});

describe('checkMessageEnvelope — enforcing mode', () => {
  beforeEach(() => {
    process.env.CHAT_REQUIRE_SEALED_ENVELOPE = 'true';
  });
  afterEach(() => {
    delete process.env.CHAT_REQUIRE_SEALED_ENVELOPE;
  });

  it('refuses a readable body', () => {
    const r = checkMessageEnvelope('meet me at the usual place', 'chat/direct');
    expect(r.sealed).toBe(false);
    expect(r.rejection?.code).toBe('PLAINTEXT_REFUSED');
  });

  it('does not echo the body it refused', () => {
    const secret = 'account number 123456789';
    const r = checkMessageEnvelope(secret, 'chat/direct');
    expect(JSON.stringify(r)).not.toContain(secret);
  });

  it('lets a sealed envelope through', () => {
    const r = checkMessageEnvelope(SEALED, 'chat/direct');
    expect(r.sealed).toBe(true);
    expect(r.rejection).toBeUndefined();
  });
});

describe('checkMessageEnvelope — report-only mode', () => {
  beforeEach(() => {
    delete process.env.CHAT_REQUIRE_SEALED_ENVELOPE;
  });

  it('warns but allows, so remaining plaintext callers surface in logs', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = checkMessageEnvelope('still plaintext', 'chat/send');
    expect(r.sealed).toBe(false);
    expect(r.rejection).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('never writes the message body into the warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const secret = 'seed phrase: abandon abandon abandon';
    checkMessageEnvelope(secret, 'chat/send');
    const logged = warn.mock.calls.flat().join(' ');
    expect(logged).not.toContain(secret);
    expect(logged).toContain('chat/send');
    warn.mockRestore();
  });

  it('stays quiet for a sealed envelope', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    checkMessageEnvelope(SEALED, 'chat/send');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('withinSizeLimit', () => {
  it('holds plaintext to the stated limit', () => {
    expect(withinSizeLimit('x'.repeat(100), 100)).toBe(true);
    expect(withinSizeLimit('x'.repeat(101), 100)).toBe(false);
  });

  it('allows a sealed envelope the base64url expansion margin', () => {
    const payload = 'A'.repeat(130);
    expect(withinSizeLimit(`${ENVELOPE_PREFIX}mls.${payload}`, 100)).toBe(true);
  });

  it('still bounds a sealed envelope', () => {
    const payload = 'A'.repeat(10_000);
    expect(withinSizeLimit(`${ENVELOPE_PREFIX}mls.${payload}`, 100)).toBe(false);
  });
});
