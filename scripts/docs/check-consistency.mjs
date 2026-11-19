// scripts/docs/check-consistency.mjs: the words Ledger Chat must never use, read from docs/GLOSSARY.md
// (the JSON block under "Términos prohibidos"), checked across app/, components/, lib/ and docs/.
// Historical records, prompts and unsigned legal drafts are kept as written and are skipped.
//   node scripts/docs/check-consistency.mjs        (prints file:line for each finding, exit 1 if any)
import fs from 'node:fs';
import path from 'node:path';

export const ROOTS = ['app', 'components', 'lib', 'docs'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.md', '.mdx']);

/** The rules: { term, pattern, flags, allow?, only? } from the glossary's JSON block. */
export function readRules(glossaryPath = 'docs/GLOSSARY.md') {
  const src = fs.readFileSync(glossaryPath, 'utf8');
  const at = src.indexOf('<!-- forbidden-terms:start -->');
  const end = src.indexOf('<!-- forbidden-terms:end -->');
  if (at < 0 || end < 0) throw new Error('docs/GLOSSARY.md has no forbidden-terms block');
  const block = src.slice(at, end);
  const json = block.slice(block.indexOf('```json') + 7, block.lastIndexOf('```'));
  const data = JSON.parse(json);
  return { rules: data.rules, skip: data.skip };
}

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXTENSIONS.has(path.extname(e.name))) out.push(p.split(path.sep).join('/'));
  }
}

export function findViolations({ rules, skip }, roots = ROOTS) {
  const files = [];
  for (const r of roots) walk(r, files);
  const compiled = rules.map((r) => ({
    ...r,
    re: new RegExp(r.pattern, r.flags ?? 'i'),
    allowRe: r.allow ? new RegExp(r.allow, 'i') : null,
  }));
  const found = [];
  for (const f of files) {
    if (skip.some((s) => f === s || f.startsWith(s))) continue;
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    for (const r of compiled) {
      if (r.only && !r.only.some((o) => f.startsWith(o))) continue;
      lines.forEach((line, i) => {
        if (r.re.test(line) && !(r.allowRe && r.allowRe.test(line))) found.push({ file: f, line: i + 1, term: r.term, text: line.trim().slice(0, 140) });
      });
    }
  }
  return found;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const v = findViolations(readRules());
  for (const x of v) console.log(`${x.file}:${x.line} [${x.term}] ${x.text}`);
  console.log(v.length ? `FAIL: ${v.length} finding(s)` : 'PASS: no forbidden term outside its allowed use');
  process.exit(v.length ? 1 : 0);
}
