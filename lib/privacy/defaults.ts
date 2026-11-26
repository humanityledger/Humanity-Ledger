import { t } from '@/lib/i18n/runtime';
/**
 * lib/privacy/defaults.ts — privacy is the default; sharing is what a person turns on.
 *
 * A setting that has never been touched (undefined) reads as the private choice. Alignment item 51.
 *  - Notification previews: hidden unless the person turned them on. The operating system's
 *    notification centre, lock screen and any push relay then see "New message" and nothing else:
 *    not the text, not who sent it.
 */

type PrivacySettings = { hide_notification_content?: boolean } | null | undefined;

/** True unless the person explicitly chose to show message content in notifications. */
export function hidesNotificationContent(settings: PrivacySettings): boolean {
  return settings?.hide_notification_content !== false;
}

/** The text an OS notification may carry for a new message. */
export function messageNotification(settings: PrivacySettings, sender: string, preview: string): { title: string; body: string } {
  // Translated in the user's language (lib/i18n/runtime.ts); the product name stays as is.
  return hidesNotificationContent(settings) ? { title: 'Ledger Chat', body: t('New message') } : { title: `Ledger Chat: ${sender}`, body: preview };
}
