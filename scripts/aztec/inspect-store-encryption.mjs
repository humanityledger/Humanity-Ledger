// Fails CI if the installed Aztec SDK stops honouring what lib/aztec/wallet/store.ts relies on:
// a 32-byte encryptionKey on AztecSQLiteOPFSStore.open (sqlite3mc page encryption), the custom
// PXE store (pxe.store -> createPXE options.store), the custom wallet DB store (walletDb.store),
// and listStores/deleteStore for wipes. Read-only; prints what it checked.
import fs from 'node:fs';
import path from 'node:path';

const nm = (...p) => path.join(process.cwd(), 'node_modules', '@aztec-labs', ...p);
const read = (...p) => {
  const f = nm(...p);
  if (!fs.existsSync(f)) throw new Error(`missing ${path.relative(process.cwd(), f)}`);
  return fs.readFileSync(f, 'utf8');
};
const version = (pkg) => JSON.parse(read(pkg, 'package.json')).version;

const checks = [
  ['kv-store: open(log, name, ephemeral, poolDirectory, encryptionKey)', () => /static async open\(log, name, ephemeral = false, poolDirectory, encryptionKey\)/.test(read('kv-store', 'dest', 'sqlite-opfs', 'store.js'))],
  ['kv-store: rejects keys that are not 32 bytes', () => /encryptionKey\.length !== 32/.test(read('kv-store', 'dest', 'sqlite-opfs', 'store.js'))],
  ['kv-store: sqlite3mc decrypt_failed error exists', () => /decrypt_failed/.test(read('kv-store', 'dest', 'sqlite-opfs', 'errors.js'))],
  ['kv-store: key is passed to the worker', () => /encryptionKey/.test(read('kv-store', 'dest', 'sqlite-opfs', 'worker.js'))],
  ['kv-store: listStores and deleteStore exported', () => {
    const idx = read('kv-store', 'dest', 'sqlite-opfs', 'index.js');
    const all = idx + fs.readdirSync(nm('kv-store', 'dest', 'sqlite-opfs')).filter((f) => f.endsWith('.js')).map((f) => read('kv-store', 'dest', 'sqlite-opfs', f)).join('\n');
    return /listStores/.test(all) && /deleteStore/.test(all) && /export \*|listStores/.test(idx);
  }],
  ['wallets: splitPxeOptions forwards pxe.store', () => /const \{[^}]*\bstore\b[^}]*\} = pxe;[\s\S]{0,300}creation: \{[\s\S]{0,200}\bstore,/.test(read('wallets', 'dest', 'embedded', 'embedded_wallet.js'))],
  ['wallets: browser create uses options.walletDb?.store', () => /options\.walletDb\?\.store/.test(read('wallets', 'dest', 'embedded', 'entrypoints', 'browser.js'))],
  ['pxe: createPXE uses options.store before the default store (bundle)', () => /const store = options\.store \?\?/.test(read('pxe', 'dest', 'entrypoints', 'client', 'bundle', 'utils.js'))],
  ['pxe: createPXE uses options.store before the default store (lazy)', () => /const store = options\.store \?\?/.test(read('pxe', 'dest', 'entrypoints', 'client', 'lazy', 'utils.js'))],
];

console.log(`kv-store ${version('kv-store')} · wallets ${version('wallets')} · pxe ${version('pxe')}`);
let failed = 0;
for (const [name, fn] of checks) {
  let ok = false;
  try { ok = fn(); } catch (e) { console.log(`   ${e.message}`); }
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failed++;
}
if (failed) {
  console.log(`\n${failed} check(s) failed: the wallet stores may no longer be encrypted with this SDK. Do not ship.`);
  process.exit(1);
}
