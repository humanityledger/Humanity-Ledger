import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { clearVerified, markVerified, verifyState, wasVerified } from '@/lib/chat/verified-contacts';

function memory() { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; }
const N1 = '11111 22222 33333 44444 55555 66666 77777 88888 99999 00000 12345 67890';
const N2 = '11111 22222 33333 44444 55555 66666 77777 88888 99999 00000 12345 67891';
const P = '0xAbC0000000000000000000000000000000000001';

describe('verify a contact', () => {
  it('unverified, then verified, then changed when the number changes', () => {
    const s = memory();
    expect(verifyState(P, N1, s)).toBe('unverified');
    markVerified(P, N1, s);
    expect(verifyState(P.toLowerCase(), N1, s)).toBe('verified');
    expect(verifyState(P, N2, s)).toBe('changed');
    expect(wasVerified(P, s)).toBe(true);
    clearVerified(P, s);
    expect(verifyState(P, N1, s)).toBe('unverified');
  });
  it('only a real safety number can be marked', () => {
    expect(() => markVerified(P, 'abc', memory())).toThrow();
  });
  it('every chat has a Verify button that opens the safety number', () => {
    const chat = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
    expect(chat).toMatch(/data-testid="verify-button"/);
    expect(fs.readFileSync('components/chat/EncryptionInfoSheet.tsx', 'utf8')).toMatch(/markVerified\(peerAddress, code\)/);
  });
});
