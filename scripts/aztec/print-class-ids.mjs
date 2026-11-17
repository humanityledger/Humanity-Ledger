#!/usr/bin/env node
/**
 * scripts/aztec/print-class-ids.mjs — read-only.
 *
 * Prints the contract class id of each committed Aztec artifact, computed the same way as
 * test/unit/aztec/deployments-registry.test.ts: loadContractArtifact, then
 * getContractClassFromArtifact. No node, no wallet, no network, nothing is sent anywhere.
 *
 *   node scripts/aztec/print-class-ids.mjs contracts/aztec/escrow/target/private_escrow-PrivateEscrow.json ...
 *
 * With no arguments it prints every contracts/aztec/<crate>/target/*.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadContractArtifact } from '@aztec-labs/aztec.js/abi';
import { getContractClassFromArtifact } from '@aztec-labs/stdlib/contract';

const root = process.cwd();
let files = process.argv.slice(2);
if (files.length === 0) {
  const base = path.join(root, 'contracts/aztec');
  for (const crate of fs.readdirSync(base)) {
    const t = path.join(base, crate, 'target');
    if (!fs.existsSync(t)) continue;
    for (const f of fs.readdirSync(t)) if (f.endsWith('.json')) files.push(path.relative(root, path.join(t, f)));
  }
}

for (const rel of files.sort()) {
  const raw = fs.readFileSync(path.join(root, rel));
  const artifact = loadContractArtifact(JSON.parse(raw.toString('utf8')));
  const cls = await getContractClassFromArtifact(artifact);
  const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  console.log(JSON.stringify({ artifact: rel, classId: cls.id.toString(), sha256 }));
}
