#!/usr/bin/env node
/**
 * scripts/env-inventory.mjs
 *
 * Writes .env.example from the variables the code actually reads (process.env.NAME in app/,
 * lib/, components/, hooks/, context/, config/, middleware.ts, next.config.js). Every value is
 * empty. Each entry says where it is read; the curated ones below also say what they are for.
 *
 *   node scripts/env-inventory.mjs          # rewrite .env.example
 *   node scripts/env-inventory.mjs --check  # exit 1 if .env.example is out of date
 *
 * NEXT_PUBLIC_* values are compiled into the browser bundle: they are public by definition and
 * must never hold a secret.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const DIRS = ['app', 'lib', 'components', 'hooks', 'context', 'config'];
const FILES = ['middleware.ts', 'next.config.js'];
const SKIP = new Set(['node_modules', '.next', '.git', 'archive', 'legacy']);

/** Purpose of the variables an operator must get right. */
const PURPOSE = {
  NEXT_PUBLIC_AZTEC_NETWORK: 'Aztec network of this build: "alpha" (Aztec Alpha, Ethereum mainnet, real funds) or empty for the test network. Read at build time.',
  NEXT_PUBLIC_AZTEC_ALPHA_ENABLED: 'Must be "true" together with NEXT_PUBLIC_AZTEC_NETWORK=alpha, or the wallet refuses a node that settles on Ethereum mainnet.',
  NEXT_PUBLIC_AZTEC_L1_CHAIN_ID: 'L1 chain the build expects (1 on Alpha). Checked against the node.',
  NEXT_PUBLIC_AZTEC_NODE_URL: 'Aztec node JSON-RPC. Defaults to the pinned public node of the network.',
  NEXT_PUBLIC_AZTEC_EXPLORER: 'Explorer base URL for transaction links. No default on Alpha.',
  NEXT_PUBLIC_AZTEC_TOKENS: 'Private tokens the wallet lists. Must match deployments/aztec-mainnet.json (scripts/aztec/check-alpha-config.mjs).',
  NEXT_PUBLIC_AZTEC_AGREEMENT_CAPS: 'Per-token caps for payments and agreements on Alpha, in base units. A token without a cap is refused.',
  NEXT_PUBLIC_AZTEC_SPONSOR: 'Address of the LedgerSponsor contract. Empty: sponsored fees are off. Set only after the deployment is recorded.',
  NEXT_PUBLIC_AZTEC_L1_FROM_BLOCK: 'L1 block where Fee Juice claim recovery starts scanning.',
  NEXT_PUBLIC_ZK_MODE: 'disabled | testnet | mainnet | demo. "demo" runs local simulations and is refused in production and on Alpha.',
  AZTEC_VALUE_MODE: '"exits-only" stops new value without a deploy (read at every value action). Empty or "open": normal.',
  AZTEC_NODE_RELAY: '"off" disables the server relay to the Aztec node.',
  AZTEC_NODE_RELAY_UPSTREAMS: 'Comma-separated Aztec node URLs for the server relay.',
  AZTEC_SPONSOR_PER_WALLET: 'Sponsored transactions per wallet, for life (default 3).',
  AZTEC_SPONSOR_PER_DAY: 'Sponsored transactions per day for everyone (default 200).',
  DATABASE_URL: 'PostgreSQL connection string (pooled). Secret.',
  DATABASE_URL_UNPOOLED: 'Direct PostgreSQL connection for migrations. Secret.',
  REDIS_URL: 'Redis connection string (rate limits, sponsor vouchers, presence). Secret.',
  JWT_SECRET: 'Session signing secret. Secret; required in production.',
  JWT_EDDSA_PUBLIC_JWK: 'EdDSA public key (JWK) for session verification.',
  NEXT_PUBLIC_APP_URL: 'Public origin of the app, used for CSRF origin checks and links.',
  CLOUDFLARE_TURN_KEY_ID: 'Cloudflare TURN key ID for calls across networks. Secret.',
  CLOUDFLARE_TURN_API_TOKEN: 'Cloudflare TURN API token. Secret.',
};

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(name) && !/\.(test|spec)\./.test(name)) out.push(full);
  }
  return out;
}

const files = [...DIRS.flatMap((d) => walk(join(ROOT, d))), ...FILES.map((f) => join(ROOT, f)).filter(existsSync)];
const uses = new Map();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
    const rel = relative(ROOT, f).replace(/\\/g, '/');
    if (!uses.has(m[1])) uses.set(m[1], new Set());
    uses.get(m[1]).add(rel);
  }
}
for (const k of ['NODE_ENV', 'NEXT_RUNTIME', 'NEXT_PHASE', 'CI', 'VERCEL', 'VERCEL_ENV', 'PORT', 'HOSTNAME']) uses.delete(k);

const names = [...uses.keys()].sort();
const isPublic = (n) => n.startsWith('NEXT_PUBLIC_');
const secretLike = (n) => /(SECRET|PRIVATE|PASSWORD|TOKEN|_KEY$|_KEY_|DSN|DATABASE_URL|REDIS_URL|MNEMONIC|SEED)/.test(n);

function entry(n) {
  const where = [...uses.get(n)].sort();
  const lines = [];
  if (PURPOSE[n]) lines.push(`# ${PURPOSE[n]}`);
  else if (!isPublic(n) && secretLike(n)) lines.push('# Secret. Server only.');
  lines.push(`# Read in: ${where.slice(0, 3).join(', ')}${where.length > 3 ? ` (+${where.length - 3} more)` : ''}`);
  lines.push(`${n}=`);
  return lines.join('\n');
}

const header = `# .env.example: generated by scripts/env-inventory.mjs from the variables the code reads.
# Do not edit by hand; run \`node scripts/env-inventory.mjs\`. All values are empty on purpose.
#
# NEXT_PUBLIC_* variables are compiled into the browser bundle and are PUBLIC. Never put a
# secret in one. Server variables marked "Secret" are set only in the hosting provider.
`;
const out =
  header +
  '\n# ─── Aztec and private payments (operator-critical) ─────────────────────────\n\n' +
  names.filter((n) => /AZTEC|ZK_MODE/.test(n)).map(entry).join('\n\n') +
  '\n\n# ─── Public (browser) ───────────────────────────────────────────────────────\n\n' +
  names.filter((n) => isPublic(n) && !/AZTEC|ZK_MODE/.test(n)).map(entry).join('\n\n') +
  '\n\n# ─── Server only ────────────────────────────────────────────────────────────\n\n' +
  names.filter((n) => !isPublic(n) && !/AZTEC|ZK_MODE/.test(n)).map(entry).join('\n\n') +
  '\n';

const target = join(ROOT, '.env.example');
if (process.argv.includes('--check')) {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (current !== out) {
    console.error('.env.example is out of date: run node scripts/env-inventory.mjs');
    process.exit(1);
  }
  console.log(`.env.example up to date (${names.length} variables).`);
} else {
  writeFileSync(target, out);
  console.log(`.env.example written: ${names.length} variables.`);
}
