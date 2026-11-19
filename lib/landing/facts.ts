/**
 * Figures read from the repository on the server, once per process, never typed by hand:
 * the number of test files and two library versions. Used by the phone landing
 * (components/landing/mobile); the desktop landing keeps its own copy in ImmersiveLanding.tsx,
 * which this change does not touch.
 */
import fs from 'node:fs';
import path from 'node:path';

let TESTS: number | null = null;
export function countTests(): number {
  if (TESTS !== null) return TESTS;
  let n = 0;
  const walk = (dir: string) => {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) walk(path.join(dir, e.name));
      else if (/\.test\.(ts|tsx)$/.test(e.name)) n++;
    }
  };
  walk(path.join(process.cwd(), 'test'));
  TESTS = n;
  return n;
}

let VERSIONS: { xmtp: string; aztecNr: string } | null = null;
export function versions(): { xmtp: string; aztecNr: string } {
  if (VERSIONS) return VERSIONS;
  const read = (p: string) => { try { return fs.readFileSync(path.join(process.cwd(), p), 'utf8'); } catch { return ''; } };
  const xmtp = (JSON.parse(read('package.json') || '{}').dependencies ?? {})['@xmtp/browser-sdk'] ?? '';
  const aztecNr = /aztec-nr", tag = "(v[\d.]+)"/.exec(read('contracts/aztec/escrow/Nargo.toml'))?.[1] ?? '';
  VERSIONS = { xmtp, aztecNr };
  return VERSIONS;
}
