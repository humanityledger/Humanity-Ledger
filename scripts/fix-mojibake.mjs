// Repairs text that was saved after being decoded as Windows-1252 (UTF-8 bytes
// read as cp1252, once or twice). Only lines that change into valid UTF-8 are
// touched. Usage: node scripts/fix-mojibake.mjs <file>... [--write]
import fs from 'node:fs';

const CP1252 = { 0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f };
const MOJI = /[Â-ô][\u0080-¿ŒœŠšŸŽžƒˆ˜–—‘-„†-•…‰‹›€™]/;

function unmojibake(s) {
  const bytes = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c < 0x100) bytes.push(c);
    else if (CP1252[c] !== undefined) bytes.push(CP1252[c]);
    else return null; // not a cp1252 rendering
  }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes)); } catch { return null; }
}

/** Fix the mojibake runs inside a line (non-Latin-1 text around them stays). */
function fixLine(line) {
  let out = line;
  for (let pass = 0; pass < 3 && MOJI.test(out); pass++) {
    const next = out.replace(/[\u0080-ÿŒœŠšŸŽžƒˆ˜–—‘-„†-•…‰‹›€™]+/g, run => {
      if (!MOJI.test(run)) return run;
      return unmojibake(run) ?? run;
    });
    if (next === out) break;
    out = next;
  }
  return out;
}

const write = process.argv.includes('--write');
for (const f of process.argv.slice(2).filter(a => !a.startsWith('--'))) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  let changed = 0;
  const fixed = lines.map(l => { const n = fixLine(l); if (n !== l) changed++; return n; });
  console.log(`${f}: ${changed} lines`);
  if (!write) {
    lines.forEach((l, i) => { if (fixed[i] !== l) console.log(`  ${i + 1}: ${fixed[i].trim().slice(0, 120)}`); });
  } else if (changed) {
    fs.writeFileSync(f, fixed.join('\n'), 'utf8');
  }
}
