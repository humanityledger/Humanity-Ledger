/**
 * lib/beta/invite-codes.mjs: cUSDC beta invitation codes, shared by the operator scripts
 * (scripts/beta/*.mjs, plain Node) and the tests.
 *
 * Same format and hashing as the closed alpha (lib/alpha/invites.ts), so /api/beta/cusdc/redeem
 * checks them with hashInviteCode: 16 Crockford base32 characters (80 random bits), shown as
 * XXXX-XXXX-XXXX-XXXX; the database keeps only HMAC-SHA256(ALPHA_INVITE_PEPPER, code).
 *
 * The operator's table of codes (docs/beta/100_BETA_INVITE_CODES.md) holds the codes in clear, so
 * it is listed in .gitignore and written with owner-only permissions.
 */
import { createHmac } from 'node:crypto';

export const MAX_BETA_CODES = 100;
export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODES_FILE = 'docs/beta/100_BETA_INVITE_CODES.md';
export const TABLE_HEADER = '| # | Invite Code | Status | Redeemed By Wallet | Redeemed At |';
const TABLE_RULE = '|---|---|---|---|---|';

/** One code from 10 random bytes, grouped by four. */
export function newBetaCode(randomBytes) {
  const bytes = randomBytes(10);
  if (!bytes || bytes.length !== 10) throw new Error('need 10 random bytes');
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  let s = '';
  for (let i = 15; i >= 0; i--) s += CROCKFORD[Number((bits >> BigInt(i * 5)) & 31n)];
  return s.match(/.{4}/g).join('-');
}

/** `count` distinct codes. */
export function newBetaCodes(count, randomBytes) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_BETA_CODES) throw new Error(`count must be 1 to ${MAX_BETA_CODES}`);
  const out = new Set();
  while (out.size < count) out.add(newBetaCode(randomBytes));
  return [...out];
}

/** What a person typed, as the 16 characters that are hashed (as normalizeInviteCode). Null if it cannot be a code. */
export function canonicalCode(input) {
  if (typeof input !== 'string') return null;
  const s = input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (s.length !== 16) return null;
  for (const c of s) if (!CROCKFORD.includes(c)) return null;
  return s;
}

/** The stored HMAC for a code, as hashInviteCode(normalizeInviteCode(code), pepper). */
export function betaCodeHash(code, pepper) {
  if (!pepper || pepper.length < 32) throw new Error('ALPHA_INVITE_PEPPER must be set (at least 32 characters).');
  const c = canonicalCode(code);
  if (!c) throw new Error('Not an invitation code.');
  return createHmac('sha256', pepper).update(c).digest('hex');
}

/**
 * The status of one invitation row, for the operator's table.
 * Unassigned: created, no person's checks recorded yet, so it cannot be redeemed.
 * Assigned: the sanctions and age checks for one person are recorded; it can be redeemed once.
 */
export function inviteStatus(invite, now = new Date()) {
  if (!invite) return 'Unknown';
  if (invite.revokedAt) return 'Revoked';
  if (invite.redeemedBy) return 'Redeemed';
  if (invite.expiresAt && new Date(invite.expiresAt) <= now) return 'Expired';
  if (invite.sanctionsResult === 'clear' && invite.adultCheckedAt) return 'Assigned';
  return 'Unassigned';
}

export function redeemedLine(redeemed, capacity = MAX_BETA_CODES) {
  return `${redeemed} / ${capacity} redeemed`;
}

/**
 * The operator's markdown file. rows: [{ code, status, redeemedBy, redeemedAt }] in order.
 */
export function renderCodesTable(rows, { generatedAt, by, redeemed = 0, capacity = MAX_BETA_CODES } = {}) {
  const at = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '');
  return [
    '# cUSDC beta invitation codes',
    '',
    `Generated ${at(generatedAt)}${by ? ` by ${by}` : ''}. Secret: anyone holding an unused, assigned code can join the beta.`,
    'This file is in .gitignore. Never commit it, paste it into a chat or share it whole.',
    '',
    'Give one code to one person, only after recording that person\'s checks:',
    '`node scripts/beta/cusdc-invites.mjs assign <#> --sanctions-list-date YYYY-MM-DD --sanctions clear --adult-checked`.',
    'Refresh the status columns: `node scripts/beta/cusdc-invites.mjs export-table`.',
    '',
    `**${redeemedLine(redeemed, capacity)}**`,
    '',
    TABLE_HEADER,
    TABLE_RULE,
    ...rows.map((r, i) => `| ${i + 1} | ${r.code} | ${r.status} | ${r.redeemedBy ?? ''} | ${at(r.redeemedAt)} |`),
    '',
  ].join('\n');
}

/** The codes in the operator's file, in table order: [{ n, code }]. */
export function parseCodesTable(md) {
  const out = [];
  for (const line of String(md).split(/\r?\n/)) {
    const m = line.match(/^\|\s*(\d+)\s*\|\s*([0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4})\s*\|/);
    if (m) out.push({ n: Number(m[1]), code: m[2] });
  }
  return out;
}

/** When and by whom the operator's file was generated, read back from its first paragraph. */
export function tableMeta(md) {
  const m = String(md).match(/^Generated (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) UTC(?: by (0x[0-9a-f]{40}))?\./m);
  return m ? { generatedAt: new Date(`${m[1]}T${m[2]}:00Z`), by: m[3] } : { generatedAt: null, by: undefined };
}

/** "#7", "7" or a code typed in full: the code, looked up in the table when given by number. */
export function resolveCodeArg(arg, table) {
  const n = String(arg ?? '').match(/^#?(\d{1,3})$/);
  if (n) {
    const row = table.find((r) => r.n === Number(n[1]));
    if (!row) throw new Error(`There is no code #${n[1]} in the table.`);
    return row.code;
  }
  const c = canonicalCode(String(arg ?? ''));
  if (!c) throw new Error('Give a code number from the table (#7) or a full code.');
  return c.match(/.{4}/g).join('-');
}
