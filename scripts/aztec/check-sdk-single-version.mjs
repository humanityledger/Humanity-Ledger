// One Aztec SDK in what ships: @aztec-labs/* at the pinned release. Fails when
//  - package.json depends on any @aztec/* package other than @aztec/bb.js (own circuits, not shipped),
//  - shipped code imports an @aztec/* specifier that next.config.js does not alias to @aztec-labs/*
//    (webpack would otherwise take it from whatever @aztec/* is installed),
//  - an alias points at a file the installed @aztec-labs release does not have,
//  - (after install) node_modules still holds an @aztec/* SDK package.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ALLOWED = new Set(['@aztec/bb.js']);
const errors = [];
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const pin = pkg.dependencies?.['@aztec-labs/aztec.js'];

for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  for (const [name, range] of Object.entries(pkg[field] ?? {})) {
    if (name.startsWith('@aztec/') && !ALLOWED.has(name)) errors.push(`package.json ${field}: ${name}@${range} (only @aztec-labs/* may provide the SDK)`);
    if (name.startsWith('@aztec-labs/') && range !== pin) errors.push(`package.json ${field}: ${name}@${range} differs from @aztec-labs/aztec.js@${pin}`);
  }
}
if (!/^\d+\.\d+\.\d+$/.test(pin ?? '')) errors.push(`@aztec-labs/aztec.js must be pinned to an exact release, found "${pin}"`);

const config = fs.readFileSync(path.join(root, 'next.config.js'), 'utf8');
const roots = Object.fromEntries([...config.matchAll(/const (\w+)\s*=\s*path\.resolve\(__dirname, '(node_modules\/@aztec-labs\/[^']+)'\)/g)].map((m) => [m[1], m[2]]));
const aliases = new Map(
  [...config.matchAll(/'(@aztec\/[^']+)':\s*path\.join\((\w+)((?:,\s*'[^']+')+)\)/g)].map((m) => [
    m[1],
    roots[m[2]] && path.join(roots[m[2]], ...[...m[3].matchAll(/'([^']+)'/g)].map((x) => x[1])),
  ]),
);

const SPEC = /(?:from\s*|import\(\s*|require\(\s*)['"](@aztec\/[^'"]+)['"]/g;
const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); }
    else if (/\.(tsx?|jsx?|mjs|mts)$/.test(e.name)) out.push(p);
  }
  return out;
};
for (const top of ['app', 'components', 'lib', 'hooks', 'context', 'config', 'scripts']) {
  for (const file of walk(path.join(root, top))) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(SPEC)) {
      const spec = m[1];
      if ([...ALLOWED].some((a) => spec === a || spec.startsWith(`${a}/`))) continue;
      const rel = path.relative(root, file);
      if (top === 'scripts') errors.push(`${rel}: imports ${spec}; scripts run in Node without aliases, use @aztec-labs/*`);
      else if (!aliases.has(spec)) errors.push(`${rel}: imports ${spec}, which next.config.js does not alias to @aztec-labs/*`);
    }
  }
}

const nm = path.join(root, 'node_modules');
if (fs.existsSync(path.join(nm, '@aztec-labs'))) {
  for (const [spec, target] of aliases) {
    if (!target) { errors.push(`alias ${spec}: root not recognised`); continue; }
    if (!fs.existsSync(path.join(root, target))) {
      const dir = path.dirname(path.join(root, target));
      errors.push(`alias ${spec} -> ${target} does not exist. Files there: ${fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.js')).join(' ') : '(no such directory)'}`);
    }
  }
  const legacy = fs.existsSync(path.join(nm, '@aztec')) ? fs.readdirSync(path.join(nm, '@aztec')).map((d) => `@aztec/${d}`).filter((d) => !ALLOWED.has(d)) : [];
  if (legacy.length) errors.push(`node_modules still has ${legacy.join(', ')}: something depends on the old scope (npm ls <name>)`);
  console.log(`@aztec-labs/aztec.js ${JSON.parse(fs.readFileSync(path.join(nm, '@aztec-labs/aztec.js/package.json'), 'utf8')).version} installed, ${aliases.size} aliases checked`);
} else {
  console.log(`node_modules not installed: alias targets not checked (${aliases.size} aliases parsed)`);
}

if (errors.length) { for (const e of errors) console.error(`FAIL ${e}`); process.exit(1); }
console.log('ok   single Aztec SDK');
