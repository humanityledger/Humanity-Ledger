import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { splitStatements, extractObjects, decide } = require('../../../lib/db/migration-inspect.js');

const root = process.cwd();
const sqlOf = (name: string) => fs.readFileSync(path.join(root, 'prisma/migrations', name, 'migration.sql'), 'utf8');

type Objects = ReturnType<typeof extractObjects>;

/** A database in which every effect of `o` is (or is not) in place. */
function schemaFor(o: Objects, present: boolean) {
  const s = { tables: new Set<string>(), indexes: new Set<string>(), columns: new Set<string>(), constraints: new Set<string>(), types: new Set<string>() };
  if (present) {
    o.tables.forEach((t: string) => s.tables.add(t));
    o.indexes.forEach((i: string) => s.indexes.add(i));
    o.columns.forEach((c: { table: string; column: string }) => s.columns.add(`${c.table}.${c.column}`));
    o.constraints.forEach((c: { name: string }) => s.constraints.add(c.name));
    o.types.forEach((t: string) => s.types.add(t));
  } else {
    o.droppedColumns.forEach((c: { table: string; column: string }) => s.columns.add(`${c.table}.${c.column}`));
    o.droppedIndexes.forEach((i: string) => s.indexes.add(i));
  }
  return s;
}

describe('migration inspector (P3018 loop, 13 Nov 2026)', () => {
  const INIT = '20260128062035_init_railway_production';

  it('marks a migration as applied when everything it creates already exists', () => {
    const o = extractObjects(sqlOf(INIT));
    expect(o.unverifiable).toEqual([]);
    expect(o.tables).toContain('User');
    const v = decide(o, schemaFor(o, true));
    expect(v.action).toBe('applied');
  });

  it('marks it rolled back when nothing exists, so it is applied again', () => {
    const o = extractObjects(sqlOf(INIT));
    expect(decide(o, schemaFor(o, false)).action).toBe('rolled-back');
  });

  it('fails closed on a partly applied migration and names what is missing', () => {
    const o = extractObjects(sqlOf(INIT));
    const s = schemaFor(o, true);
    s.tables.delete(o.tables[0]);
    const v = decide(o, s);
    expect(v.action).toBe('manual');
    expect(v.missing).toContain(`table ${o.tables[0]}`);
  });

  it('reads guarded DO $$ blocks as the statements they guard', () => {
    const o = extractObjects(sqlOf('20260205120000_add_watched_wallet_columns'));
    expect(o.unverifiable).toEqual([]);
    expect(o.columns.map((c: { column: string }) => c.column)).toContain('lastValue');
  });

  it('keeps dollar quoted bodies whole when splitting', () => {
    const parts = splitStatements('CREATE TABLE "A" (x int); DO $$ BEGIN IF NOT EXISTS (SELECT 1) THEN ALTER TABLE "A" ADD COLUMN "y" int; END IF; END $$; SELECT 1');
    expect(parts).toHaveLength(3);
    expect(parts[1].startsWith('DO $$')).toBe(true);
  });

  it('treats a drop as done when the object is gone', () => {
    const o = extractObjects(sqlOf('20261019150000_remove_encrypted_mnemonic_and_wallet_salt'));
    expect(o.unverifiable).toEqual([]);
    expect(decide(o, schemaFor(o, true)).action).toBe('applied');
  });

  it('never auto resolves a migration with seed data or unknown SQL', () => {
    const o = extractObjects(sqlOf('20260708000000_add_quest_social_airdrop_tables'));
    expect(decide(o, schemaFor(o, true)).action).toBe('manual');
    expect(decide(extractObjects('UPDATE "User" SET x = 1'), schemaFor(extractObjects(''), true)).action).toBe('manual');
  });

  it('every migration in the repo is classified without throwing', () => {
    for (const name of fs.readdirSync(path.join(root, 'prisma/migrations'))) {
      const f = path.join(root, 'prisma/migrations', name, 'migration.sql');
      if (!fs.existsSync(f)) continue;
      expect(() => extractObjects(fs.readFileSync(f, 'utf8'))).not.toThrow();
    }
  });
});

describe('superseded migrations', () => {
  const list = JSON.parse(fs.readFileSync(path.join(root, 'prisma/superseded-migrations.json'), 'utf8')).migrations;
  it('records init_railway_production as superseded by 0_init, pinned to its reviewed hash', () => {
    const m = list.find((x: { name: string }) => x.name === '20260128062035_init_railway_production');
    expect(m.supersededBy).toBe('0_init');
    const hash = require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root, 'prisma/migrations', m.name, 'migration.sql'))).digest('hex');
    expect(hash).toBe(m.sha256);
  });
  it('every entry names migrations that exist', () => {
    for (const m of list) {
      expect(fs.existsSync(path.join(root, 'prisma/migrations', m.name, 'migration.sql'))).toBe(true);
      expect(fs.existsSync(path.join(root, 'prisma/migrations', m.supersededBy, 'migration.sql'))).toBe(true);
    }
  });
});

describe('pre-deploy wiring', () => {
  const pre = fs.readFileSync(path.join(root, 'scripts/railway-pre-deploy.js'), 'utf8');
  const start = fs.readFileSync(path.join(root, 'start.sh'), 'utf8');

  it('never deletes migration records and never hard codes a resolve', () => {
    expect(pre).not.toMatch(/DELETE FROM\s+"_prisma_migrations"/i);
    expect(pre).not.toContain('--applied 2026');
    expect(pre).not.toContain('accept-data-loss --');
    expect(pre).toContain("require('../lib/db/migration-inspect.js')");
  });

  it('does not boot the app when migrations fail', () => {
    expect(start).not.toMatch(/railway-pre-deploy\.js \|\| true/);
    expect(start).toMatch(/railway-pre-deploy\.js \|\| exit 1/);
  });
});
