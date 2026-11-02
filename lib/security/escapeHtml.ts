/**
 * Escape text before it goes into HTML we build ourselves (emails, Telegram
 * messages with parse_mode HTML). Without it, a form field like
 * `<a href="https://evil.example">Reset your password</a>` arrives in the
 * admin's inbox as a working link that looks like it came from us.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
