// scripts/aztec/setup-testnet.mjs
//
// One-time operator setup for the private payments wallet on the Aztec TEST
// network. Run it from the repository root:
//
//   node --import ./scripts/aztec/register.mjs scripts/aztec/setup-testnet.mjs
//
// What it does, idempotently:
//   1. Creates (or reloads) two Aztec accounts:
//        admin   controls the three test tokens. Its secret stays in
//                .aztec-testnet.local.json, which is git-ignored. Keep it.
//        faucet  may only mint. Its secret is deliberately published to the
//                browser as NEXT_PUBLIC_AZTEC_FAUCET so anyone can mint test
//                tokens. That is what a test-network faucet is; the tokens
//                have no value.
//   2. Deploys both accounts, paying fees with Aztec's sponsored fee contract.
//   3. Deploys zkUSDC, zkDAI and zkETH (Aztec's standard Token contract) and
//      makes the faucet a minter on each.
//   4. Writes the public configuration into .env.local.
//
// Nothing here can touch real funds: the Aztec test network has no value.

import fs from 'node:fs';
import path from 'node:path';
import { createAztecNodeClient } from '@aztec-labs/aztec.js/node';
import { Fr, Fq } from '@aztec-labs/aztec.js/fields';
import { AztecAddress } from '@aztec-labs/aztec.js/addresses';
import { getContractInstanceFromInstantiationParams } from '@aztec-labs/aztec.js/contracts';
import { SponsoredFeePaymentMethod } from '@aztec-labs/aztec.js/fee';
import { NO_FROM } from '@aztec-labs/aztec.js/account';
import { SponsoredFPCContract } from '@aztec-labs/noir-contracts.js/SponsoredFPC';
import { TokenContract } from '@aztec-labs/noir-contracts.js/Token';
import { openTmpStore } from '@aztec-labs/kv-store/deprecated/indexeddb';

const ROOT = process.cwd();
const NODE_URL = process.env.AZTEC_NODE_URL || 'https://aztec-testnet.drpc.org';
const STATE_FILE = path.join(ROOT, '.aztec-testnet.local.json');
const ENV_FILE = path.join(ROOT, '.env.local');

const TOKENS = [
  { key: 'USDC', name: 'zkUSDC (test)', symbol: 'zkUSDC', decimals: 6 },
  { key: 'DAI', name: 'zkDAI (test)', symbol: 'zkDAI', decimals: 18 },
  { key: 'ETH', name: 'zkETH (test)', symbol: 'zkETH', decimals: 18 },
];

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
}
function keysFor(state, name) {
  if (!state[name]) {
    state[name] = { secret: Fr.random().toString(), salt: Fr.random().toString(), signingKey: Fq.random().toString() };
    saveState(state);
  }
  const k = state[name];
  return { secret: Fr.fromString(k.secret), salt: Fr.fromString(k.salt), signingKey: Fq.fromString(k.signingKey) };
}

// The public drpc endpoint refuses JSON-RPC batches larger than 3.
const RPC = { maxBatchSize: 3 };
const node = createAztecNodeClient(NODE_URL, RPC);
const info = await node.getNodeInfo();
log('Aztec node', info.nodeVersion, 'on L1 chain', info.l1ChainId);
if (Number(info.l1ChainId) === 1) {
  throw new Error('Refusing to run: this node settles on Ethereum mainnet. This script is for the test network only.');
}

const fpc = await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, { salt: new Fr(0) });
if (!(await node.getContract(fpc.address))) throw new Error(`Sponsored FPC ${fpc.address} is not deployed on this network.`);
const paymentMethod = new SponsoredFeePaymentMethod(fpc.address);
const fee = { paymentMethod };

const { EmbeddedWallet } = await import('@aztec-labs/wallets/embedded');
const wallet = await EmbeddedWallet.create(NODE_URL, {
  ephemeral: true,
  nodeClientOptions: RPC,
  pxe: { store: await openTmpStore(true) },
  walletDb: { store: await openTmpStore(true) },
});
await wallet.registerContract(fpc, SponsoredFPCContract.artifact);

const state = loadState();
state.network = { nodeUrl: NODE_URL, l1ChainId: Number(info.l1ChainId), rollupVersion: Number(info.rollupVersion) };

async function ensureAccount(name) {
  const k = keysFor(state, name);
  const manager = await wallet.createSchnorrAccount(k.secret, k.salt, k.signingKey, name);
  const address = manager.address;
  const meta = await wallet.getContractMetadata(address);
  const deployed = String(meta?.initializationStatus) === 'INITIALIZED';
  if (!deployed) {
    log(`deploying ${name} account ${address} ...`);
    const deploy = await manager.getDeployMethod();
    await deploy.send({ from: NO_FROM, fee, wait: { timeout: 900 } });
    log(`${name} account deployed`);
  } else {
    log(`${name} account ${address} already deployed`);
  }
  state[name].address = address.toString();
  saveState(state);
  return address;
}

const admin = await ensureAccount('admin');
const faucet = await ensureAccount('faucet');

state.tokens = state.tokens || {};
for (const t of TOKENS) {
  const known = state.tokens[t.key];
  let token;
  if (known && (await node.getContract(AztecAddress.fromStringUnsafe(known.address)))) {
    const instance = await node.getContract(AztecAddress.fromStringUnsafe(known.address));
    await wallet.registerContract(instance, TokenContract.artifact);
    token = TokenContract.at(instance.address, wallet);
    log(`${t.symbol} already deployed at ${known.address}`);
  } else {
    log(`deploying ${t.symbol} ...`);
    const res = await TokenContract.deploy(wallet, admin, t.name, t.symbol, t.decimals).send({ from: admin, fee, wait: { timeout: 900 } });
    token = res.contract;
    state.tokens[t.key] = { address: token.address.toString(), symbol: t.symbol, decimals: t.decimals };
    saveState(state);
    log(`${t.symbol} deployed at ${token.address}`);
  }
  const isMinter = (await token.methods.is_minter(faucet).simulate({ from: admin })).result;
  if (!isMinter) {
    log(`making the faucet a minter of ${t.symbol} ...`);
    await token.methods.set_minter(faucet, true).send({ from: admin, fee, wait: { timeout: 900 } });
  }
  log(`${t.symbol}: faucet is minter`);
}

// ---------------------------------------------------------------------------
// Public configuration for the browser
// ---------------------------------------------------------------------------
const publicTokens = Object.fromEntries(TOKENS.map((t) => [t.key, state.tokens[t.key]]));
const faucetPublic = {
  address: state.faucet.address,
  secret: state.faucet.secret,
  salt: state.faucet.salt,
  signingKey: state.faucet.signingKey,
};
const lines = {
  NEXT_PUBLIC_AZTEC_NODE_URL: NODE_URL,
  NEXT_PUBLIC_AZTEC_L1_CHAIN_ID: String(info.l1ChainId),
  NEXT_PUBLIC_AZTEC_SPONSORED_FPC: fpc.address.toString(),
  NEXT_PUBLIC_AZTEC_TOKENS: JSON.stringify(publicTokens),
  NEXT_PUBLIC_AZTEC_FAUCET: JSON.stringify(faucetPublic),
};

let env = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
for (const [k, v] of Object.entries(lines)) {
  const line = `${k}='${v}'`;
  const re = new RegExp(`^${k}=.*$`, 'm');
  env = re.test(env) ? env.replace(re, line) : `${env.replace(/\s*$/, '')}\n${line}\n`;
}
fs.writeFileSync(ENV_FILE, env);
log('wrote the public Aztec configuration to .env.local');
log('admin secret kept in .aztec-testnet.local.json (git-ignored). Back it up: it controls the test tokens.');

await wallet.stop();
process.exit(0);
