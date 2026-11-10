// Prints how the installed Aztec SDK handles a store encryption key and custom stores,
// so CI can show whether lib/aztec/wallet/store.ts really encrypts. Read-only.
import fs from 'node:fs';
import path from 'node:path';

function pkgDir(name) {
  // Exports maps hide package.json; resolve from the project's node_modules instead.
  const d = path.join(process.cwd(), 'node_modules', ...name.split('/'));
  if (!fs.existsSync(path.join(d, 'package.json'))) throw new Error(`${name} is not installed`);
  return d;
}
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules') walk(p, out);
    else if (/\.(js|d\.ts)$/.test(e.name)) out.push(p);
  }
  return out;
}
function show(label, dir, patterns, ctx = 25) {
  console.log(`\n===== ${label} (${dir})`);
  let hits = 0;
  for (const f of walk(dir)) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((l, i) => {
      if (patterns.some((re) => re.test(l)) && hits < 12) {
        hits++;
        console.log(`--- ${path.relative(dir, f)}:${i + 1}`);
        console.log(lines.slice(Math.max(0, i - 2), i + ctx).join('\n'));
      }
    });
  }
  if (!hits) console.log('(no match)');
  return hits;
}
const kv = pkgDir('@aztec-labs/kv-store');
console.log('kv-store version', JSON.parse(fs.readFileSync(path.join(kv, 'package.json'), 'utf8')).version);
show('AztecSQLiteOPFSStore.open', kv, [/static\s+(async\s+)?open\s*\(/]);
show('encryption in kv-store', kv, [/PRAGMA\s+key|encryption|encrypt|cipher|sqlcipher/i], 8);
const w = pkgDir('@aztec-labs/wallets');
console.log('wallets version', JSON.parse(fs.readFileSync(path.join(w, 'package.json'), 'utf8')).version);
show('EmbeddedWallet.create', w, [/static\s+(async\s+)?create\s*\(/], 45);
show('custom store options', w, [/walletDb|pxe\?\.\s*store|options\.pxe|\.store\b/], 6);
