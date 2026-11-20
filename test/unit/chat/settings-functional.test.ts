/** Every setting changes something today. The app lock without a PIN changed nothing (20/11/2026). */
import fs from 'node:fs';

const settings = fs.readFileSync('components/chat/LedgerSettingsFull.tsx', 'utf8');
const chat = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');

describe('settings are functional', () => {
  it('the app lock is offered and enforced only while PINs can exist', () => {
    expect(settings).toMatch(/\{pinLockEnabled\(\) && \(\s*<Group title="App lock"/);
    expect(chat).toMatch(/ledgerSettings\?\.biometric_lock && pinLockEnabled\(\) && !isBiometricallyUnlocked/);
  });
  it('every switch writes a key that the app reads outside the settings screens', () => {
    const keys = [...new Set([...settings.matchAll(/updateSetting\('([a-z_]+)'/g)].map((m) => m[1]))];
    const readers = ['components/terminal/LedgerChatV2.tsx', 'components/chat/MessageBubble.tsx', 'lib/hooks/useSettingsEffect.ts']
      .map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    const profile = new Set(['avatar_url', 'bio', 'chat_background', 'chat_theme', 'font_family', 'bubble_style', 'payments_enabled', 'notification_sound', 'show_read_receipts', 'auto_delete_timer', 'webrtc_ip_masking']);
    const unread = keys.filter((k) => !profile.has(k) && !readers.includes(k));
    expect(unread).toEqual([]);
  });
});
