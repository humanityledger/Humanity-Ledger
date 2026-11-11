/**
 * lib/db/url.js — one place that reads DATABASE_URL / DATABASE_URL_UNPOOLED (CommonJS, so the
 * Railway pre-deploy script and the app share it).
 *
 * Production ran all day on 11 November 2026 with a DATABASE_URL Prisma refused ("the URL must start
 * with the protocol postgresql://"): contacts, user search, profiles, presence and communities all
 * answered empty. The usual causes are paste errors in the Railway variable: surrounding quotes, the
 * key pasted into the value ("DATABASE_URL=postgresql://..."), spaces or a line break. Those are
 * repaired here. Anything else (an unresolved ${{Service.VAR}} reference, another scheme) is left
 * as is and described, without the password, by describeDatabaseUrl().
 */
'use strict';

function normalizeDatabaseUrl(raw) {
  if (typeof raw !== 'string') return raw;
  let v = raw.trim();
  // "DATABASE_URL=postgresql://…" or "DATABASE_URL_UNPOOLED=…" pasted as the value.
  v = v.replace(/^(?:export\s+)?DATABASE_URL(?:_UNPOOLED)?\s*=\s*/i, '');
  // Surrounding quotes, possibly more than one pair.
  for (let i = 0; i < 3; i++) {
    const m = /^(['"`])([\s\S]*)\1$/.exec(v);
    if (!m) break;
    v = m[2].trim();
  }
  return v;
}

/** What is wrong with the value, in words safe to log (never the password). */
function describeDatabaseUrl(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, problem: 'not set' };
  const v = normalizeDatabaseUrl(raw);
  const repaired = v !== raw;
  if (/\$\{\{/.test(v)) return { ok: false, repaired, problem: 'unresolved Railway reference (${{Service.VAR}}): the service or variable name does not exist' };
  const scheme = (/^([a-z][a-z0-9+.-]*):\/\//i.exec(v) || [])[1];
  if (!scheme) return { ok: false, repaired, problem: `no scheme (starts with ${JSON.stringify(v.slice(0, 1))})` };
  if (!/^postgres(ql)?$/i.test(scheme)) return { ok: false, repaired, problem: `scheme "${scheme}" (Prisma needs postgresql://)` };
  let host = '';
  try {
    host = new URL(v).hostname;
  } catch {
    return { ok: false, repaired, problem: 'not a valid URL after the scheme' };
  }
  return { ok: true, repaired, host };
}

module.exports = { normalizeDatabaseUrl, describeDatabaseUrl };
