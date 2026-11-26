import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { coldContactDecision, quarantinePeer, isQuarantined, acceptRequest, dismissRequest, listQuarantined, setAdmittedPeers } from '@/lib/g8/quarantine';
import { DEFAULT_PXE_SETTINGS as DEFAULT_SETTINGS } from '@/lib/settings/schema';

class Mem { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } removeItem(k: string) { this.m.delete(k); } }
const me = '0x' + 'a'.repeat(40), stranger = '0x' + 'b'.repeat(40), friend = '0x' + 'c'.repeat(40), invited = '0x' + 'd'.repeat(40);
const ui = readFileSync(path.resolve(__dirname, '../../../components/terminal/LedgerChatV2.tsx'), 'utf8');

describe('G8 privacy shield', () => {
  it('is off by default and changes nothing while off', () => {
    expect((DEFAULT_SETTINGS as any).g8_privacy_shield).toBe(false);
    const s = new Mem() as unknown as Storage;
    expect(coldContactDecision({ owner: me, peer: stranger, shieldOn: false, known: false, blocked: false }, s)).toBe('request');
  });
  it('holds only strangers; contacts, invitees and accepted peers pass', () => {
    const s = new Mem() as unknown as Storage;
    setAdmittedPeers([invited.toUpperCase().replace('0X', '0x')]);
    expect(coldContactDecision({ owner: me, peer: stranger, shieldOn: true, known: false, blocked: false }, s)).toBe('quarantine');
    expect(coldContactDecision({ owner: me, peer: friend, shieldOn: true, known: true, blocked: false }, s)).toBe('deliver');
    expect(coldContactDecision({ owner: me, peer: invited, shieldOn: true, known: false, blocked: false }, s)).toBe('deliver');
    expect(coldContactDecision({ owner: me, peer: stranger, shieldOn: true, known: true, blocked: true }, s)).toBe('drop');
    acceptRequest(me, stranger, s);
    expect(coldContactDecision({ owner: me, peer: stranger, shieldOn: true, known: false, blocked: false }, s)).toBe('deliver');
  });
  it('Requests list: hold, accept, dismiss (per owner)', () => {
    const s = new Mem() as unknown as Storage;
    quarantinePeer(me, stranger.toUpperCase().replace('0X', '0x'), s);
    quarantinePeer(me, stranger, s);
    expect(listQuarantined(me, s)).toEqual([stranger]);
    expect(isQuarantined(friend, stranger, s)).toBe(false);
    dismissRequest(me, stranger, s);
    expect(isQuarantined(me, stranger, s)).toBe(false);
    quarantinePeer(me, stranger, s); acceptRequest(me, stranger, s);
    expect(listQuarantined(me, s)).toEqual([]);
  });
  it('every incoming path consults the shield; held contact never rings or notifies', () => {
    expect(ui).toMatch(/const heldByShield = fromPeer && bgVerdict !== 'revive' && g8Hold\(bgPeerLower\)/);
    expect(ui).toMatch(/!content\.startsWith\('__'\) && !heldByShield/);
    expect(ui).toMatch(/g8Hold\(String\(msgConvPeer\)\.toLowerCase\(\)\)\) \{\n\s+continue;/);
    expect(ui).toMatch(/if \(hinted && g8Hold\(String\(hinted\)\.toLowerCase\(\)\)\)/);
    expect((ui.match(/if \(!g8Hold\(pLower\)\) knownPeersRef/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});
