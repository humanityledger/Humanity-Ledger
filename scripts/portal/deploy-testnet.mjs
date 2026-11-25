// scripts/portal/deploy-testnet.mjs
//
// Deploys the Humanity Ledger portal on the TEST networks only: HLPortal and the receiver factory
// on Sepolia, PortalToken (zkETH, wrapped by the portal) on the Aztec test network. This is
// docs/PORTAL.md §7.2: the run that has to pass before any mainnet decision. Mainnet is refused.
//
//   npx hardhat compile
//   node --import ./scripts/aztec/register.mjs scripts/portal/deploy-testnet.mjs deploy
//   # 2 days later (HLPortal.TIMELOCK; a relaxation is public and waits):
//   node --import ./scripts/aztec/register.mjs scripts/portal/deploy-testnet.mjs bind
//
// Environment:
//   SEPOLIA_RPC_URL        Sepolia JSON-RPC
//   PORTAL_DEPLOYER_KEY    0x… private key of a funded Sepolia account (test ETH only). It is the
//                          admin and the guardian of this test deployment.
//   AZTEC_NODE_URL         default https://aztec-testnet.drpc.org
// The Aztec account is the "admin" of scripts/aztec/setup-testnet.mjs (.aztec-testnet.local.json).
//
// State: .portal-testnet.local.json (git-ignored). Idempotent: a step already done is skipped.
// Output: the NEXT_PUBLIC_HL_PORTAL_* lines for .env.local / Railway (lib/portal/config.ts).

import fs from 'node:fs';
import path from 'node:path';
import { createPublicClient, createWalletClient, http, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { createAztecNodeClient } from '@aztec-labs/aztec.js/node';
import { Fr, Fq } from '@aztec-labs/aztec.js/fields';
import { EthAddress } from '@aztec-labs/aztec.js/addresses';
import { Contract, getContractInstanceFromInstantiationParams } from '@aztec-labs/aztec.js/contracts';
import { loadContractArtifact } from '@aztec-labs/aztec.js/abi';
import { SponsoredFeePaymentMethod } from '@aztec-labs/aztec.js/fee';
import { NO_FROM } from '@aztec-labs/aztec.js/account';
import { SponsoredFPCContract } from '@aztec-labs/noir-contracts.js/SponsoredFPC';
import { openTmpStore } from '@aztec-labs/kv-store/deprecated/indexeddb';

const ROOT = process.cwd();
const MODE = process.argv[2] || 'deploy';
const STATE_FILE = path.join(ROOT, '.portal-testnet.local.json');
const AZTEC_STATE = path.join(ROOT, '.aztec-testnet.local.json');
const NODE_URL = process.env.AZTEC_NODE_URL || 'https://aztec-testnet.drpc.org';
/** Canonical WETH on Sepolia. ETH deposits are wrapped into it by the portal. */
const WETH_SEPOLIA = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
/** Test caps, in wei: 0.001 minimum, 0.5 per deposit, 1 per sender per day, 20 per day. */
const CAPS = { minDeposit: 10n ** 15n, perDepositCap: 5n * 10n ** 17n, perSenderDailyCap: 10n ** 18n, globalDailyCap: 20n * 10n ** 18n };

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
const save = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
const artifact = (name, file = `contracts/portal/${name}.sol`) => JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts', file, `${name}.json`), 'utf8'));
const b32 = (aztecAddress) => '0x' + aztecAddress.replace(/^0x/, '').padStart(64, '0');

// ── Ethereum (Sepolia) ─────────────────────────────────────────────────────────────
const rpc = process.env.SEPOLIA_RPC_URL;
const key = process.env.PORTAL_DEPLOYER_KEY;
if (!rpc || !/^0x[0-9a-fA-F]{64}$/.test(key || '')) throw new Error('Set SEPOLIA_RPC_URL and PORTAL_DEPLOYER_KEY (a funded Sepolia test key).');
const account = privateKeyToAccount(key);
const pub = createPublicClient({ chain: sepolia, transport: http(rpc) });
const wal = createWalletClient({ chain: sepolia, transport: http(rpc), account });
if ((await pub.getChainId()) !== 11155111) throw new Error('Refusing to run: SEPOLIA_RPC_URL is not Sepolia.');

async function deployL1(name, args, file) {
  const a = artifact(name, file);
  const hash = await wal.deployContract({ abi: a.abi, bytecode: a.bytecode, args });
  const rc = await pub.waitForTransactionReceipt({ hash });
  if (rc.status !== 'success' || !rc.contractAddress) throw new Error(`${name} deployment failed (${hash}).`);
  log(`${name} deployed at ${rc.contractAddress}`);
  return getAddress(rc.contractAddress);
}
async function writeL1(address, abi, functionName, args) {
  const hash = await wal.writeContract({ address, abi, functionName, args });
  const rc = await pub.waitForTransactionReceipt({ hash });
  if (rc.status !== 'success') throw new Error(`${functionName} failed (${hash}).`);
  return hash;
}

// ── Aztec test network ─────────────────────────────────────────────────────────────
const node = createAztecNodeClient(NODE_URL, { maxBatchSize: 3 });
const info = await node.getNodeInfo();
if (Number(info.l1ChainId) !== 11155111) throw new Error(`Refusing to run: this Aztec node settles on chain ${info.l1ChainId}, not Sepolia.`);
const inbox = getAddress(info.l1ContractAddresses.inboxAddress.toString());
const outbox = getAddress(info.l1ContractAddresses.outboxAddress.toString());
const rollupVersion = BigInt(info.rollupVersion);
log('Aztec', info.nodeVersion, 'rollup version', rollupVersion, 'inbox', inbox, 'outbox', outbox);

const portalAbi = artifact('HLPortal').abi;

if (MODE === 'deploy') {
  state.network = { l1ChainId: 11155111, rollupVersion: rollupVersion.toString(), inbox, outbox, nodeUrl: NODE_URL };
  if (!state.portal) {
    state.deployBlock = (await pub.getBlockNumber()).toString();
    state.portal = await deployL1('HLPortal', [inbox, outbox, rollupVersion, WETH_SEPOLIA, account.address, account.address]);
    save();
  }
  if (!state.factory) {
    state.factory = await deployL1('HLReceiverFactory', [state.portal], 'contracts/portal/HLReceiver.sol');
    state.implementation = getAddress(
      await pub.readContract({ address: state.factory, abi: artifact('HLReceiverFactory', 'contracts/portal/HLReceiver.sol').abi, functionName: 'implementation' }),
    );
    save();
  }

  if (!state.l2Token) {
    // PortalToken has no admin: any account can deploy it. The setup-testnet admin is reused when
    // present; otherwise a throwaway account is made and deployed (sponsored fees).
    const az = fs.existsSync(AZTEC_STATE) ? JSON.parse(fs.readFileSync(AZTEC_STATE, 'utf8')) : {};
    if (!az.admin) {
      az.admin = { secret: Fr.random().toString(), salt: Fr.random().toString(), signingKey: Fq.random().toString(), fresh: true };
      state.aztecDeployer = az.admin;
      save();
    }
    const fpc = await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, { salt: new Fr(0) });
    const fee = { paymentMethod: new SponsoredFeePaymentMethod(fpc.address) };
    const { EmbeddedWallet } = await import('@aztec-labs/wallets/embedded');
    const wallet = await EmbeddedWallet.create(NODE_URL, {
      ephemeral: true,
      nodeClientOptions: { maxBatchSize: 3 },
      pxe: { store: await openTmpStore(true) },
      walletDb: { store: await openTmpStore(true) },
    });
    await wallet.registerContract(fpc, SponsoredFPCContract.artifact);
    const k = az.admin;
    const manager = await wallet.createSchnorrAccount(Fr.fromString(k.secret), Fr.fromString(k.salt), Fq.fromString(k.signingKey), 'admin');
    const meta = await wallet.getContractMetadata(manager.address);
    if (String(meta?.initializationStatus) !== 'INITIALIZED') {
      log('deploying the Aztec deployer account ...');
      await (await manager.getDeployMethod()).send({ from: NO_FROM, fee, wait: { timeout: 900 } });
    }
    const tokenArtifact = loadContractArtifact(JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts/aztec/portal_token/target/portal_token-PortalToken.json'), 'utf8')));
    log('deploying PortalToken (zkETH) on Aztec ...');
    const res = await Contract.deploy(wallet, tokenArtifact, [EthAddress.fromString(state.portal), 18]).send({ from: manager.address, fee, wait: { timeout: 900 } });
    const contract = res.contract ?? res;
    state.l2Token = contract.address.toString();
    save();
    log('PortalToken deployed at', state.l2Token);
    await wallet.stop();
  }

  if (!state.queuedAt) {
    await writeL1(state.portal, portalAbi, 'queueAsset', [WETH_SEPOLIA, { l2Token: b32(state.l2Token), ...CAPS, enabled: true }]);
    state.queuedAt = Date.now();
    save();
    log('WETH asset queued. Run "bind" after the 2-day timelock.');
  }
} else if (MODE === 'bind') {
  // A fresh checkout (the workflow) has no state file: the portal address comes from PORTAL_ADDRESS.
  if (!state.portal && /^0x[0-9a-fA-F]{40}$/.test(process.env.PORTAL_ADDRESS || '')) state.portal = getAddress(process.env.PORTAL_ADDRESS);
  if (!state.portal) throw new Error('Run "deploy" first, or set PORTAL_ADDRESS.');
  await writeL1(state.portal, portalAbi, 'executeAsset', [WETH_SEPOLIA]);
  state.boundAt = Date.now();
  save();
  log('WETH asset bound: deposits are open on the test deployment.');
} else {
  throw new Error(`Unknown mode "${MODE}": use deploy or bind.`);
}

// The wallet loads the PortalToken description from app/api/portal/artifact (built with the app).
const env = {
  NEXT_PUBLIC_HL_PORTAL: state.portal,
  NEXT_PUBLIC_HL_RECEIVER_FACTORY: state.factory,
  NEXT_PUBLIC_HL_RECEIVER_IMPLEMENTATION: state.implementation,
  NEXT_PUBLIC_HL_PORTAL_L1_CHAIN_ID: '11155111',
  NEXT_PUBLIC_HL_PORTAL_ASSETS: JSON.stringify([{ symbol: 'ETH', l1: WETH_SEPOLIA.toLowerCase(), l2: state.l2Token?.toLowerCase(), decimals: 18, native: true }]),
  NEXT_PUBLIC_HL_PORTAL_TOKEN_ARTIFACT: '/api/portal/artifact',
  NEXT_PUBLIC_HL_PORTAL_DEPLOY_BLOCK: state.deployBlock,
};
const out = ['# Portal on the test networks (lib/portal/config.ts). Not for Aztec Alpha or Ethereum.', ...Object.entries(env).filter(([, v]) => v).map(([k, v]) => `${k}='${v}'`)];
console.log('\n' + out.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '```\n' + out.join('\n') + '\n```\n');
process.exit(0);
