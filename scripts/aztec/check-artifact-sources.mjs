// Fails when a committed Aztec contract artifact was not compiled from the source in this tree.
// Needs no toolchain: `aztec compile` embeds every source file in the artifact's file_map, so the
// embedded text of contracts/aztec/<crate>/src/*.nr is compared with the file on disk. (That the
// bytecode follows from that source is the job of the "Aztec contracts" workflow, which recompiles.)
//
// A source that is deliberately ahead of its artifact must be listed in
// deployments/aztec-pending-recompile.json with the sha256 of the source file. The pin makes the
// divergence explicit and reviewed: any further edit to the source fails until the pin is updated,
// a stale pin (artifact caught up) fails, and while a crate is pending no instance of it may be
// recorded in deployments/aztec-mainnet.json: the app ships the artifact, never the newer source.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const base = path.join(root, 'contracts', 'aztec');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const readJson = (p, fallback) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback);

const pending = readJson(path.join(root, 'deployments', 'aztec-pending-recompile.json'), { pending: [] }).pending ?? [];
const mainnet = readJson(path.join(root, 'deployments', 'aztec-mainnet.json'), { contracts: [] });
const errors = [];
const seenPending = new Set();

for (const crate of fs.readdirSync(base).sort()) {
  const dir = path.join(base, crate);
  if (!fs.existsSync(path.join(dir, 'Nargo.toml'))) continue;
  const target = path.join(dir, 'target');
  const artifacts = fs.existsSync(target) ? fs.readdirSync(target).filter((f) => f.endsWith('.json')) : [];
  if (artifacts.length === 0) { errors.push(`${crate}: no compiled artifact committed`); continue; }
  for (const file of artifacts) {
    const artifact = JSON.parse(fs.readFileSync(path.join(target, file), 'utf8'));
    const marker = `contracts/aztec/${crate}/src/`;
    const own = Object.values(artifact.file_map ?? {}).filter((f) => f.path.includes(marker));
    if (own.length === 0) { errors.push(`${crate}/${file}: the artifact embeds none of this crate's sources`); continue; }
    for (const f of own) {
      const rel = `${crate}/src/${f.path.split(marker)[1]}`;
      const disk = path.join(base, rel);
      if (!fs.existsSync(disk)) { errors.push(`${rel}: compiled into ${file} but missing from the tree`); continue; }
      const source = fs.readFileSync(disk, 'utf8');
      const pin = pending.find((p) => p.source === `contracts/aztec/${rel}`);
      if (source === f.source) {
        if (pin) errors.push(`${rel}: listed in aztec-pending-recompile.json but the artifact already matches. Remove the entry.`);
        console.log(`ok       ${rel} == ${file}`);
        continue;
      }
      if (!pin) { errors.push(`${rel}: differs from the source compiled into ${file}. Recompile (workflow "Aztec contracts") or record it in aztec-pending-recompile.json.`); continue; }
      seenPending.add(pin.source);
      if (pin.sha256 !== sha(source)) { errors.push(`${rel}: changed since it was recorded as pending (sha256 ${sha(source)}). Review and update the pin.`); continue; }
      if (!pin.reason || !pin.contract) { errors.push(`${rel}: pending entry needs "contract" and "reason".`); continue; }
      const onMainnet = (mainnet.contracts ?? []).filter((c) => String(c.name ?? '').startsWith(pin.contract));
      if (onMainnet.length) { errors.push(`${rel}: ${pin.contract} is recorded on mainnet while its source is ahead of the artifact.`); continue; }
      console.log(`PENDING  ${rel} is ahead of ${file} (${pin.reason})`);
    }
  }
}
for (const p of pending) if (!seenPending.has(p.source)) errors.push(`aztec-pending-recompile.json: ${p.source} does not correspond to a diverging source.`);

if (errors.length) {
  for (const e of errors) console.error(`FAIL     ${e}`);
  process.exit(1);
}
