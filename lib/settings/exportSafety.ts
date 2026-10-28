// What "Export my data" may write to a file. The export is a plain JSON file
// that people email, upload and leave in Downloads, so it must never carry
// keys or credentials: the XMTP database key, session tokens, PINs and vault
// material stay on the device.

const SECRET_TOKENS = new Set([
  'key', 'keys', 'secret', 'secrets', 'session', 'sessions', 'token', 'tokens',
  'pin', 'vault', 'seed', 'mnemonic', 'private', 'privkey', 'password', 'passcode',
  'handshake', 'auth', 'jwt', 'sig', 'signature', 'cookie', 'credential', 'credentials',
  'nonce', 'entropy',
]);
const SECRET_FRAGMENTS = ['secret', 'mnemonic', 'password', 'privkey', 'privatekey', 'apikey', 'dbkey'];

export function isExportSafeKey(key: string): boolean {
  if (!key.startsWith('ledger_')) return false;
  const rest = key.slice('ledger_'.length).toLowerCase();
  const tokens = rest.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.some(t => SECRET_TOKENS.has(t))) return false;
  const squashed = rest.replace(/[^a-z0-9]/g, '');
  if (SECRET_FRAGMENTS.some(f => squashed.includes(f))) return false;
  return true;
}

type StorageLike = Pick<Storage, 'length' | 'key' | 'getItem'>;

export function exportableLocalStorage(storage?: StorageLike): Record<string, string> {
  const s: StorageLike | undefined = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  const out: Record<string, string> = {};
  if (!s) return out;
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (!k || !isExportSafeKey(k)) continue;
    out[k] = s.getItem(k) ?? '';
  }
  return out;
}
