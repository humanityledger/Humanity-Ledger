/**
 * lib/db/migration-inspect.js (CommonJS: used by scripts/railway-pre-deploy.js and by tests).
 *
 * Decides what to do with a Prisma migration that failed, from what its SQL does and what the
 * database already has. Replaces a rule that knew two table names and otherwise DELETED the failed
 * record, so a failed migration was re-applied, failed again (42P07, relation already exists) and
 * blocked every later migration on every deploy (P3018, 13 Nov 2026 logs). Migrations that a
 * baseline replaces are not inspected here: they are listed in prisma/superseded-migrations.json.
 *
 *   every effect of the migration is already in place  →  'applied'      (migrate resolve --applied)
 *   none of them is                                    →  'rolled-back'  (migrate resolve --rolled-back, re-applied)
 *   some exist, some do not, or SQL we cannot verify   →  'manual'       (fail closed, nothing is changed)
 */

const IDENT = '"([^"]+)"';

/**
 * Splits SQL on top level semicolons, keeping dollar quoted bodies (DO $$ … $$) and single quoted
 * strings whole. Line comments are removed first.
 */
function splitStatements(sql) {
  const src = String(sql).replace(/--[^\n]*/g, '');
  const out = [];
  let cur = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "'") {
      const j = src.indexOf("'", i + 1);
      const k = j === -1 ? src.length : j + 1;
      cur += src.slice(i, k);
      i = k;
    } else if (ch === '$') {
      const tag = /^\$[A-Za-z_]*\$/.exec(src.slice(i));
      if (tag) {
        const j = src.indexOf(tag[0], i + tag[0].length);
        const k = j === -1 ? src.length : j + tag[0].length;
        cur += src.slice(i, k);
        i = k;
      } else {
        cur += ch;
        i++;
      }
    } else if (ch === ';') {
      out.push(cur);
      cur = '';
      i++;
    } else {
      cur += ch;
      i++;
    }
  }
  out.push(cur);
  return out.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/**
 * Statements inside a `DO $$ BEGIN IF NOT EXISTS (…) THEN <stmt>; END IF; END $$` guard.
 * Only that guard shape is understood; anything else in the block stays unverifiable.
 */
function guardedBody(doStatement) {
  const m = /^DO \$([A-Za-z_]*)\$ (.*) \$\1\$$/i.exec(doStatement);
  if (!m) return null;
  const inner = [];
  for (let frag of splitStatements(m[2])) {
    frag = frag.replace(/^BEGIN\s+/i, '');
    frag = frag.replace(/^(?:END IF\s+)+/i, '');
    if (/^END(?: IF)?$/i.test(frag)) continue;
    const guard = /^IF NOT EXISTS \(.*?\) THEN (.*)$/i.exec(frag);
    if (guard) frag = guard[1];
    else if (/^IF\b/i.test(frag)) return null;
    inner.push(frag);
  }
  return inner;
}

/**
 * What a migration does to the schema, by kind. Statements outside these kinds are reported as
 * unverifiable, which always leads to 'manual' (fail closed).
 */
function extractObjects(sql) {
  const tables = new Set();
  const indexes = new Set();
  const columns = []; // { table, column }
  const constraints = []; // { table, name }
  const types = new Set();
  const droppedColumns = []; // { table, column }
  const droppedIndexes = new Set();
  const unverifiable = [];

  const visit = (st) => {
    let m;
    if (/^DO \$/i.test(st)) {
      const inner = guardedBody(st);
      if (inner === null) unverifiable.push(st.slice(0, 160));
      else inner.forEach(visit);
    } else if (/^CREATE SCHEMA IF NOT EXISTS "public"$/i.test(st)) {
      // the public schema always exists: no effect to check
    } else if ((m = new RegExp(`^CREATE TABLE (?:IF NOT EXISTS )?(?:"public"\\.)?${IDENT}`, 'i').exec(st))) {
      tables.add(m[1]);
    } else if ((m = new RegExp(`^CREATE (?:UNIQUE )?INDEX (?:IF NOT EXISTS )?${IDENT}`, 'i').exec(st))) {
      indexes.add(m[1]);
    } else if ((m = new RegExp(`^CREATE TYPE (?:"public"\\.)?${IDENT} AS ENUM`, 'i').exec(st))) {
      types.add(m[1]);
    } else if ((m = new RegExp(`^DROP INDEX (?:IF EXISTS )?(?:"public"\\.)?${IDENT}$`, 'i').exec(st))) {
      droppedIndexes.add(m[1]);
    } else if ((m = new RegExp(`^ALTER TABLE (?:IF EXISTS )?(?:"public"\\.)?${IDENT} (.*)$`, 'i').exec(st))) {
      const table = m[1];
      const parts = m[2].split(/,\s*(?=(?:ADD|DROP) )/i);
      let all = true;
      for (const p of parts) {
        let c;
        if ((c = new RegExp(`^ADD COLUMN (?:IF NOT EXISTS )?${IDENT}`, 'i').exec(p))) columns.push({ table, column: c[1] });
        else if ((c = new RegExp(`^ADD CONSTRAINT ${IDENT}`, 'i').exec(p))) constraints.push({ table, name: c[1] });
        else if ((c = new RegExp(`^DROP COLUMN (?:IF EXISTS )?${IDENT}$`, 'i').exec(p))) droppedColumns.push({ table, column: c[1] });
        else all = false;
      }
      if (!all) unverifiable.push(st.slice(0, 160));
    } else {
      unverifiable.push(st.slice(0, 160));
    }
  };
  splitStatements(sql).forEach(visit);

  return {
    tables: [...tables],
    indexes: [...indexes],
    columns,
    constraints,
    types: [...types],
    droppedColumns,
    droppedIndexes: [...droppedIndexes],
    unverifiable,
  };
}

/**
 * existing: { tables: Set, indexes: Set, columns: Set('Table.column'), constraints: Set, types: Set }
 * Returns { action, present, missing, reason }.
 */
function decide(objects, existing) {
  const present = [];
  const missing = [];
  const check = (label, ok) => (ok ? present : missing).push(label);
  for (const t of objects.tables) check(`table ${t}`, existing.tables.has(t));
  for (const i of objects.indexes) check(`index ${i}`, existing.indexes.has(i));
  for (const c of objects.columns) check(`column ${c.table}.${c.column}`, existing.columns.has(`${c.table}.${c.column}`));
  for (const c of objects.constraints) check(`constraint ${c.name}`, existing.constraints.has(c.name));
  for (const t of objects.types) check(`type ${t}`, existing.types.has(t));
  // A drop has taken effect when the object is gone.
  for (const c of objects.droppedColumns || []) check(`dropped column ${c.table}.${c.column}`, !existing.columns.has(`${c.table}.${c.column}`));
  for (const i of objects.droppedIndexes || []) check(`dropped index ${i}`, !existing.indexes.has(i));

  const total = present.length + missing.length;
  if (objects.unverifiable.length > 0) {
    return { action: 'manual', present, missing, reason: `the migration has statements that cannot be checked: ${objects.unverifiable.slice(0, 3).join(' | ')}` };
  }
  if (total === 0) return { action: 'manual', present, missing, reason: 'the migration creates nothing that can be checked' };
  if (missing.length === 0) return { action: 'applied', present, missing, reason: `all ${total} objects it creates already exist` };
  if (present.length === 0) return { action: 'rolled-back', present, missing, reason: `none of the ${total} objects it creates exists` };
  return { action: 'manual', present, missing, reason: `partly applied: ${present.length} of ${total} objects exist` };
}

module.exports = { splitStatements, extractObjects, decide };
