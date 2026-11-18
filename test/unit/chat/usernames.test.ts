import { describe, expect, it } from 'vitest';
import {
  canonicalUsername,
  looksLikeUsername,
  newLinkToken,
  parseProfileLink,
  profileLink,
  qrColor,
  usernameProblem,
  usernameSuggestions,
  LINK_TOKEN_RE,
} from '@/lib/chat/usernames';

describe('usernames', () => {
  it('canonical form: no @, no spaces at the ends, lowercase, NFKC', () => {
    expect(canonicalUsername('  @Stefan_C ')).toBe('stefan_c');
    expect(canonicalUsername('Ｓｔｅｆａｎ')).toBe('stefan'); // full-width letters fold to ASCII
  });

  it('accepts Signal-style names', () => {
    for (const ok of ['stefan', 'stefan_c', 'stefan.01', 'abc', 'a12', 'atfortyseven.01']) expect(usernameProblem(ok)).toBeNull();
  });

  it('refuses what could be confused or impersonate', () => {
    expect(usernameProblem('')).toBe('empty');
    expect(usernameProblem('ab')).toBe('short');
    expect(usernameProblem('1abc')).toBe('start');
    expect(usernameProblem('_abc')).toBe('start');
    expect(usernameProblem('stéfan')).toBe('chars'); // no letters outside a–z: no look-alikes
    expect(usernameProblem('stеfan')).toBe('chars'); // Cyrillic е
    expect(usernameProblem('ste fan')).toBe('chars');
    expect(usernameProblem('stefan.1')).toBe('ending');
    expect(usernameProblem('stefan.ab')).toBe('ending');
    expect(usernameProblem('abc.b.01')).toBe('chars');
    expect(usernameProblem('0x1234')).toBe('address');
    expect(usernameProblem('admin')).toBe('reserved');
    expect(usernameProblem('ledgerchat.01')).toBe('reserved');
    expect(usernameProblem('a'.repeat(33))).toBe('long');
  });

  it('a username to look up is not an address or free text', () => {
    expect(looksLikeUsername('@stefan')).toBe(true);
    expect(looksLikeUsername('0xabc')).toBe(false);
    expect(looksLikeUsername('hello there')).toBe(false);
  });

  it('suggestions keep the name and add a two-digit ending, stable for the same input', () => {
    const a = usernameSuggestions('stefan');
    expect(a).toHaveLength(3);
    for (const s of a) {
      expect(s).toMatch(/^stefan\.\d{2}$/);
      expect(usernameProblem(s)).toBeNull();
    }
    expect(usernameSuggestions('stefan')).toEqual(a);
    expect(usernameSuggestions('1x')).toEqual([]);
  });
});

describe('profile links', () => {
  const token = newLinkToken(() => new Uint8Array(16).fill(7));
  it('tokens are 22 base64url characters (128 bits)', () => {
    expect(token).toMatch(LINK_TOKEN_RE);
    const r = newLinkToken((n) => {
      const b = new Uint8Array(n);
      for (let i = 0; i < n; i++) b[i] = (i * 53 + 11) & 255;
      return b;
    });
    expect(r).toMatch(LINK_TOKEN_RE);
  });
  it('the token sits after #, so it never reaches a server', () => {
    const link = profileLink('https://ledgerchat.org/', token);
    expect(link).toBe(`https://ledgerchat.org/u#${token}`);
    expect(new URL(link).pathname).toBe('/u');
    expect(parseProfileLink(link)).toBe(token);
    expect(parseProfileLink(`https://www.ledgerchat.org/u#${token}`)).toBe(token);
  });
  it('anything else is not a profile link', () => {
    expect(parseProfileLink('https://evil.example/u#' + token.slice(1) + 'x?')).toBeNull();
    expect(parseProfileLink(`https://ledgerchat.org/u#${token}x`)).toBeNull();
    expect(parseProfileLink('0x' + 'a'.repeat(40))).toBeNull();
  });
  it('QR colours keep a dark code on white; unknown ids fall back', () => {
    expect(qrColor('violet').card).toBe('#5200FF');
    expect(qrColor('nope').id).toBe('ink');
  });
});
