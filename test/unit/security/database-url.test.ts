/**
 * DATABASE_URL paste errors no longer take the whole database offline (11 November 2026: contacts,
 * search, profiles, presence and communities answered empty all day). lib/db/url.js.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
const { normalizeDatabaseUrl, describeDatabaseUrl } = require('../../../lib/db/url.js');

const GOOD = 'postgresql://user:secret@pgbouncer.railway.internal:6432/railway';

describe('DATABASE_URL', () => {
  it('repairs quotes, the key pasted into the value, spaces and line breaks', () => {
    for (const v of [`"${GOOD}"`, `'${GOOD}'`, `DATABASE_URL=${GOOD}`, `DATABASE_URL="${GOOD}"`, ` ${GOOD}\n`, `export DATABASE_URL=${GOOD}`]) {
      expect(normalizeDatabaseUrl(v)).toBe(GOOD);
      expect(describeDatabaseUrl(v)).toEqual({ ok: true, repaired: true, host: 'pgbouncer.railway.internal' });
    }
    expect(describeDatabaseUrl(GOOD)).toEqual({ ok: true, repaired: false, host: 'pgbouncer.railway.internal' });
  });

  it('says what is wrong otherwise, never with the password', () => {
    const cases: [string, RegExp][] = [
      ['${{Postgress.DATABASE_URL}}', /unresolved Railway reference/],
      ['mysql://u:secret@h/db', /scheme "mysql"/],
      ['secret@h/db', /no scheme/],
      ['', /not set/],
    ];
    for (const [v, re] of cases) {
      const d = describeDatabaseUrl(v);
      expect(d.ok).toBe(false);
      expect(d.problem).toMatch(re);
      expect(JSON.stringify(d)).not.toContain('secret');
    }
  });

  it('is used by the app and by the pre-deploy migrations', () => {
    const root = path.resolve(__dirname, '../../..');
    expect(fs.readFileSync(path.join(root, 'lib/prisma.ts'), 'utf8')).toMatch(/const rawUrl = normalizeDatabaseUrl\(process\.env\.DATABASE_URL\);/);
    const pre = fs.readFileSync(path.join(root, 'scripts/railway-pre-deploy.js'), 'utf8');
    expect(pre).toMatch(/for \(const key of \['DATABASE_URL', 'DATABASE_URL_UNPOOLED'\]\)/);
    expect(pre).toMatch(/process\.env\[key\] = normalizeDatabaseUrl\(raw\);/);
  });
});
