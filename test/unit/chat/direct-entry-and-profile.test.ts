/**
 * 18 November 2026: a direct entry (no full-screen guidelines gate), one calm loading mark on
 * every opening screen, and one Profile page with everything from "Profile and devices".
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('direct entry', () => {
  it('no guidelines gate between sign-in and the chat; they are accepted on the sign-in screen', () => {
    expect(fs.existsSync('components/chat/ChatCommunityGate.tsx')).toBe(false);
    const chat = read('components/terminal/LedgerChatV2.tsx');
    expect(chat).not.toContain('ChatCommunityGate');
    expect(chat).not.toContain('hasAcceptedEula');
    const connect = read('components/connect/ConnectView.tsx');
    expect(connect).toContain('href="/docs/community-guidelines"');
    const page = read('lib/docs/pages/community-guidelines.ts');
    // The compliance text, word for word.
    expect(page).toContain('Zero Tolerance for Objectionable Content');
    expect(page).toContain('your access to Ledger Chat may be permanently revoked');
    expect(page).toContain('Blocked users will not be able to contact you.');
    expect(read('lib/docs/registry.ts')).toContain('communityGuidelines');
  });
});

describe('one loading mark', () => {
  it('the PIN check, the chat bundle and the account load all draw BootMark', () => {
    const gate = read('components/auth/TuringShieldGate.tsx');
    // The loading branch (before the PIN screen itself, which keeps its own background).
    const loading = gate.slice(gate.indexOf('if (!mounted || (!cleared'), gate.indexOf('FIRST-TIME SETUP OVERLAY'));
    expect(loading).toContain('<BootMark />');
    expect(loading).toContain('bg-white md:bg-[#f4f6fa]');
    expect(loading).not.toContain('linear-gradient');
    expect(read('components/chat/surface/ChatSurface.tsx')).toContain('<BootMark />');
    expect(read('components/terminal/LedgerChatV2.tsx')).toContain('<BootMark label="Loading your account" />');
    expect(read('components/terminal/PadlockLoader.tsx')).toContain('/boot-mark.webp');
    expect(read('app/layout.tsx')).toContain('href="/boot-mark.webp"');
    expect(fs.statSync('public/boot-mark.webp').size).toBeLessThan(20_000);
  });
});

describe('one profile page', () => {
  it('Profile shows the editable card and every group of Profile and devices', () => {
    const s = read('components/chat/LedgerSettingsFull.tsx');
    expect(s).toContain("(activeTab === 'profile' || activeTab === 'account')");
    expect(s).toContain('header={<div className="bg-white rounded-2xl border border-[#e6e8ec] overflow-hidden">{profileCardBody}</div>}');
    expect(s).toContain('{accountGroups}');
    const groups = s.slice(s.indexOf('const accountGroups'), s.indexOf('return (', s.indexOf('const accountGroups')));
    for (const t of ['title="Devices"', 'title="Profile visibility"', 'title="Data and backup"', 'title="Session"', 'label="Linked devices"', 'label="Sign out"']) {
      expect(groups).toContain(t);
    }
    const card = s.slice(s.indexOf('const profileCardBody'), s.indexOf('const accountGroups'));
    for (const t of ['avatarFileRef', 'Add a bio', 'copyAddress', 'balance']) expect(card).toContain(t);
    expect(s).not.toContain("activeTab === 'account' && (");
    expect(read('components/chat/profile/ProfileShare.tsx')).toContain('{children}');
  });
});
