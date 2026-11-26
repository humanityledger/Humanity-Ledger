import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { isWalletAddress } from '@/components/chat/UserAvatar';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

describe('one avatar everywhere', () => {
  it('every person avatar goes through UserAvatar (photo, else the 10 × 10 mosaic)', () => {
    for (const f of [
      'components/chat/ui/kit.tsx', 'components/terminal/LedgerChatV2.tsx', 'components/chat/LedgerChatStatusBar.tsx',
      'components/chat/LedgerChatCallHistory.tsx', 'components/chat/LedgerChatProfile.tsx', 'components/chat/ContactInfoPanel.tsx',
      'components/chat/LedgerSettingsFull.tsx', 'components/chat/call/CallScreens.tsx', 'components/communities/CommunityReader.tsx',
      'components/zk/wallet/WalletUI.tsx',
    ]) expect(read(f)).toMatch(/<UserAvatar /);
    // No more initials-on-a-colour for a wallet address in these screens.
    expect(read('components/chat/LedgerSettingsFull.tsx')).not.toMatch(/myAddress\.slice\(2, 4\)\.toUpperCase\(\)/);
    expect(read('components/chat/LedgerChatProfile.tsx')).not.toMatch(/peerAddress\.slice\(2, 4\)/);
    const ua = read('components/chat/UserAvatar.tsx');
    expect(ua).toMatch(/<WalletGlyph /);
    expect(ua).toMatch(/ledger_settings_update/); // your new photo shows everywhere at once
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
