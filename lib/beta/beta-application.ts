/**
 * lib/beta/beta-application.ts: the request form on /beta for people without an invitation code.
 *
 * The form is open to anyone, signed in or not. A valid request is sent by email to the beta inbox
 * with Reply-To set to the person's email, so the operator answers that same message with a code.
 * Nothing from the form is saved in the database; when the person is signed in, only their wallet
 * address and the date are also recorded as a request (lib/beta/cusdc-beta-request.ts), so the
 * operator can reserve a place for that wallet instead of sending a code.
 */
import { escapeHtml } from '@/lib/security/escapeHtml';

/** Where requests go, unless BETA_REQUESTS_TO is set on the server. */
export const DEFAULT_BETA_INBOX = 'humanityledger@gmail.com';

export type Application = {
  name: string;
  email: string;
  wallet: string;
  social: string;
  message: string;
};

export const LIMITS = { name: 80, email: 254, social: 60, message: 600 } as const;

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;

const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '';

/**
 * Checks what the form sent. Returns the cleaned request, or the first problem in words the page
 * shows next to the form. `website` is a field people never see: a filled one is a bot.
 */
export function parseApplication(body: unknown): { ok: true; app: Application } | { ok: false; field: string; error: string } | { ok: false; bot: true } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.website === 'string' && b.website.trim()) return { ok: false, bot: true };
  const name = clean(b.name, LIMITS.name).replace(/\s+/g, ' ');
  const email = clean(b.email, LIMITS.email).toLowerCase();
  const wallet = clean(b.wallet, 42);
  const social = clean(b.social, LIMITS.social);
  const message = clean(b.message, LIMITS.message);
  if (name.length < 2) return { ok: false, field: 'name', error: 'Write your name.' };
  if (!EMAIL_RE.test(email)) return { ok: false, field: 'email', error: 'Write an email address we can reply to.' };
  if (wallet && !WALLET_RE.test(wallet)) return { ok: false, field: 'wallet', error: 'A wallet address starts with 0x and has 40 more characters. Leave it empty if you are not sure.' };
  if (b.adult !== true) return { ok: false, field: 'adult', error: 'The beta is only for people aged 18 or older.' };
  if (b.contact !== true) return { ok: false, field: 'contact', error: 'We need your permission to reply to this email.' };
  return { ok: true, app: { name, email, wallet: wallet.toLowerCase(), social, message } };
}

/** The email the operator receives. Replying to it answers the person. */
export function applicationEmail(app: Application, ctx: { signedInWallet: string | null; at: Date }) {
  const when = ctx.at.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const rows: [string, string][] = [
    ['Name', app.name],
    ['Email', app.email],
    ['Ethereum wallet', app.wallet || 'Not given'],
    ['Signed in with', ctx.signedInWallet ?? 'Not signed in'],
    ['X or Telegram', app.social || 'Not given'],
    ['What they want to test', app.message || 'Not given'],
    ['Confirmed 18 or older', 'Yes'],
    ['Agreed to be contacted by email', 'Yes'],
    ['Sent', when],
  ];
  const subject = `Ledger Chat beta: code request from ${app.name}`.slice(0, 140);
  const text = [
    'New request for a Ledger Chat beta invitation code.',
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    'Reply to this email with the code. Before you give one, check the person against the EU sanctions list and record it:',
    'node scripts/beta/cusdc-invites.mjs assign <number> --sanctions-list-date YYYY-MM-DD --sanctions clear --adult-checked',
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#F8FAFC;font-family:Inter,-apple-system,Segoe UI,sans-serif;color:#15171C">
<table role="presentation" style="max-width:560px;width:100%;margin:0 auto;background:#ffffff;border:1px solid #E4E7EC;border-radius:16px;border-collapse:separate">
<tr><td style="padding:24px 28px 8px"><p style="margin:0;font-size:13px;color:#5200FF;font-weight:600">Ledger Chat beta</p>
<h1 style="margin:6px 0 0;font-size:20px">Code request from ${escapeHtml(app.name)}</h1></td></tr>
<tr><td style="padding:12px 28px 4px"><table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">
${rows.map(([k, v]) => `<tr><td style="padding:8px 12px 8px 0;color:#667085;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:8px 0;border-bottom:1px solid #F2F4F7;word-break:break-word">${escapeHtml(v)}</td></tr>`).join('\n')}
</table></td></tr>
<tr><td style="padding:16px 28px 24px;font-size:13px;color:#475467">Reply to this email with the code. Before you give one, check the person against the EU sanctions list and record it with <code>scripts/beta/cusdc-invites.mjs assign</code>.</td></tr>
</table></body></html>`;
  return { subject, text, html, replyTo: app.email };
}
