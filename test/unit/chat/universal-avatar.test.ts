import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { AVATAR_RADIUS, isWalletAddress } from '@/components/chat/UserAvatar';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

describe('one avatar everywhere', () => {
  it('every person avatar goes through UserAvatar (photo, else the 10 × 10 mosaic)', () => {
    for (const f of [
      'components/chat/ui/kit.tsx', 'components/terminal/LedgerChatV2.tsx', 'components/chat/LedgerChatStatusBar.tsx',
      'components/chat/LedgerChatCallHistory.tsx', 'components/chat/LedgerChatProfile.tsx', 'components/chat/ContactInfoPanel.tsx',
      'components/chat/LedgerSettingsFull.tsx', 'components/chat/call/CallScreens.tsx', 'components/communities/CommunityReader.tsx',
      'components/zk/wallet/WalletUI.tsx', 'components/chat/LedgerChatUserSearch.tsx', 'components/chat/ContactRequestsPanel.tsx',
      'components/terminal/LedgerChatSettings.tsx',
    ]) expect(read(f)).toMatch(/<UserAvatar /);
    // No more initials-on-a-colour for a wallet address in these screens.
    expect(read('components/chat/LedgerSettingsFull.tsx')).not.toMatch(/myAddress\.slice\(2, 4\)\.toUpperCase\(\)/);
    expect(read('components/chat/LedgerChatProfile.tsx')).not.toMatch(/peerAddress\.slice\(2, 4\)/);
    const ua = read('components/chat/UserAvatar.tsx');
    expect(ua).toMatch(/<WalletGlyph /);
    expect(ua).toMatch(/ledger_settings_update/); // your new photo shows everywhere at once
  });

  it('integrates both photos and the 10 × 10 mosaic inside the unified rounded-square frame everywhere', () => {
    expect(AVATAR_RADIUS).toBe('29.17%');
    const ua = read('components/chat/UserAvatar.tsx');
    expect(ua).not.toMatch(/rounded-full/);
    expect(ua).toMatch(/borderRadius:\s*AVATAR_RADIUS/);
    expect(ua).toMatch(/object-cover object-center/);

    const wg = read('components/chat/WalletGlyph.tsx');
    expect(wg).toMatch(/clipPath/);
    expect(wg).toMatch(/rx="7"/);
    expect(wg).toMatch(/step = \(24 \+ gap\) \/ GLYPH_SIDE/);

    const kit = read('components/chat/ui/kit.tsx');
    expect(kit.slice(kit.indexOf('export function PeerAvatar'), kit.indexOf('export function SectionLabel'))).not.toMatch(/rounded-full/);

    const cs = read('components/chat/call/CallScreens.tsx');
    expect(cs.slice(cs.indexOf('export function CallAvatar'), cs.indexOf('function hueOf'))).toMatch(/borderRadius:\s*39/);
    expect(cs.slice(cs.indexOf('export function CallAvatar'), cs.indexOf('function hueOf'))).toMatch(/size=\{120\}/);

    expect(read('components/chat/LedgerChatOnboarding.tsx')).toMatch(/borderRadius:\s*AVATAR_RADIUS/);
    expect(read('components/chat/LedgerUpdatesTab.tsx')).not.toMatch(/rounded-full p-\[2px\]/);
  });
  it('recognises wallet addresses only', () => {
    expect(isWalletAddress('0x' + 'aB'.repeat(20))).toBe(true);
    expect(isWalletAddress('community:123')).toBe(false);
    expect(isWalletAddress('')).toBe(false);
  });
  it('sticker effects start off for every account', () => {
    const s = read('components/chat/StickerSceneHost.tsx');
    expect(s).toMatch(/PREF_KEY = 'ledger_sticker_effects_v2'/);
    expect(s).toMatch(/getItem\(PREF_KEY\) === 'on'/);
  });
  it('Clear cache empties the offline cache and reports what it freed; never the message DB or the wallet', () => {
    const s = read('components/chat/LedgerSettingsFull.tsx');
    const fn = s.slice(s.indexOf('const purgeCache = useCallback'), s.indexOf('const requestNotificationPermission'));
    expect(fn).toMatch(/purgeOfflineCaches\(\)/);
    expect(fn).toMatch(/purgeCachedMedia\(\)/);
    expect(fn).toMatch(/freed/);
    expect(fn).not.toMatch(/getDirectory|deleteDatabase|aztec-kv|xmtp-/);
  });
});
