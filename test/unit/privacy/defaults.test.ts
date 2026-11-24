import { describe, expect, it } from 'vitest';
import { hidesNotificationContent, messageNotification } from '@/lib/privacy/defaults';

describe('privacy by default', () => {
  it('hides notification content unless the person turned previews on', () => {
    expect(hidesNotificationContent(undefined)).toBe(true);
    expect(hidesNotificationContent({})).toBe(true);
    expect(hidesNotificationContent({ hide_notification_content: true })).toBe(true);
    expect(hidesNotificationContent({ hide_notification_content: false })).toBe(false);
  });
  it('a hidden notification names neither the sender nor the text', () => {
    const n = messageNotification({}, '0x12…34', 'meet at 9');
    expect(n.title).toBe('Ledger Chat');
    expect(n.body).toBe('New message');
    expect(messageNotification({ hide_notification_content: false }, '0x12…34', 'meet at 9')).toEqual({ title: 'Ledger Chat: 0x12…34', body: 'meet at 9' });
  });
});
