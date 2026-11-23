/**
 * The request form on /beta: what it accepts, the email the operator receives, and the wiring.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_BETA_INBOX, applicationEmail, parseApplication } from '@/lib/beta/beta-application';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../../..', p), 'utf8');
const good = { name: '  Elena   Ruiz ', email: 'Elena@Example.org', wallet: '', social: '@elena', message: 'Paying friends in chats', adult: true, contact: true };

describe('parseApplication', () => {
  it('cleans and accepts a complete request', () => {
    expect(parseApplication(good)).toEqual({ ok: true, app: { name: 'Elena Ruiz', email: 'elena@example.org', wallet: '', social: '@elena', message: 'Paying friends in chats' } });
  });

  it('names the field that is wrong', () => {
    expect(parseApplication({ ...good, name: 'E' })).toMatchObject({ ok: false, field: 'name' });
    expect(parseApplication({ ...good, email: 'not-an-email' })).toMatchObject({ ok: false, field: 'email' });
    expect(parseApplication({ ...good, wallet: '0x123' })).toMatchObject({ ok: false, field: 'wallet' });
    expect(parseApplication({ ...good, adult: false })).toMatchObject({ ok: false, field: 'adult' });
    expect(parseApplication({ ...good, contact: 'yes' })).toMatchObject({ ok: false, field: 'contact' });
  });

  it('treats a filled hidden field as a bot', () => {
    expect(parseApplication({ ...good, website: 'http://spam' })).toEqual({ ok: false, bot: true });
  });

  it('caps lengths and drops control characters', () => {
    const r = parseApplication({ ...good, message: 'a\u0000b'.padEnd(2000, 'x') });
    expect(r.ok && r.app.message.length).toBe(600);
    expect(r.ok && r.app.message.startsWith('ab')).toBe(true);
  });
});

describe('applicationEmail', () => {
  it('replies go to the person, and the body escapes what they typed', () => {
    const r = parseApplication({ ...good, name: 'Eve <script>x</script>' });
    if (!r.ok) throw new Error('expected ok');
    const m = applicationEmail(r.app, { signedInWallet: null, at: new Date('2026-11-23T14:20:00Z') });
    expect(m.replyTo).toBe('elena@example.org');
    expect(m.subject).toBe('Ledger Chat beta: code request from Eve <script>x</script>');
    expect(m.html).not.toMatch(/<script>/);
    expect(m.text).toMatch(/Signed in with: Not signed in/);
    expect(m.text).toMatch(/Sent: 2026-11-23 14:20 UTC/);
  });

  it('goes to the beta inbox unless the server sets another', () => {
    expect(DEFAULT_BETA_INBOX).toBe('humanityledger@gmail.com');
    const route = read('app/api/beta/cusdc/apply/route.ts');
    expect(route).toMatch(/process\.env\.BETA_REQUESTS_TO \|\| DEFAULT_BETA_INBOX/);
    expect(route).toMatch(/replyTo: mail\.replyTo/);
    expect(route).toMatch(/status: 415/);
    expect(route).toMatch(/rl:beta-apply/);
    expect(route).not.toMatch(/prisma\.\w+\.create\(\{[^}]*email/);
  });
});

describe('the form', () => {
  it('has labelled fields only, two confirmations and no stored data', () => {
    const form = read('components/beta/BetaRequestForm.tsx');
    for (const l of ['Full name', 'Email', 'Ethereum wallet address', 'X or Telegram', 'What would you like to test', 'I am 18 or older.']) expect(form).toContain(l);
    expect(form).toMatch(/\/api\/beta\/cusdc\/apply/);
    expect(form).toMatch(/htmlFor=\{`\$\{id\}-email`\}/);
  });
});
