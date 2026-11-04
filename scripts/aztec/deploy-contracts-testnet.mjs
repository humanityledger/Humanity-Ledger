// scripts/aztec/deploy-contracts-testnet.mjs
//
// Deploys IdentityCredential (scope-isolated single-use claims) to Aztec
// testnet. PrivateEscrow and PaymentStream hold private balances and must be
// deployed with keys instead: see scripts/aztec/deploy-keyed.ts.
//
// Uses the admin account and sponsored FPC already configured in .aztec-testnet.local.json.

import fs from 'node:fs';
import path from 'node:path';
import { createAztecNodeClient } from '@aztec-labs/aztec.js/node';
import { Fr, Fq } from '@aztec-labs/aztec.js/fields';
import { AztecAddress } from '@aztec-labs/aztec.js/addresses';
import { Contract, getContractInstanceFromInstantiationParams } from '@aztec-labs/aztec.js/contracts';
import { loadContractArtifact } from '@aztec-labs/aztec.js/abi';
import { SponsoredFeePaymentMethod } from '@aztec-labs/aztec.js/fee';
import { SponsoredFPCContract } from '@aztec-labs/noir-contracts.js/SponsoredFPC';
import { openTmpStore } from '@aztec-labs/kv-store/deprecated/indexeddb';
import { EmbeddedWallet } from '@aztec-labs/wallets/embedded';

const ROOT = process.cwd();
const STATE_FILE = path.join(ROOT, '.aztec-testnet.local.json');
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
const NODE_URL = state.network.nodeUrl || 'https://aztec-testnet.drpc.org';
const RPC = { maxBatchSize: 3 };
const node = createAztecNodeClient(NODE_URL, RPC);

log('Connecting to Aztec node:', NODE_URL);
const info = await node.getNodeInfo();
log('Connected! Node version:', info.nodeVersion, 'L1 chain ID:', info.l1ChainId);

const fpc = await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, { salt: new Fr(0) });
const fee = { paymentMethod: new SponsoredFeePaymentMethod(fpc.address) };

const wallet = await EmbeddedWallet.create(NODE_URL, {
  ephemeral: true,
  nodeClientOptions: RPC,
  pxe: { store: await openTmpStore(true) },
  walletDb: { store: await openTmpStore(true) },
});
await wallet.registerContract(fpc, SponsoredFPCContract.artifact);

const adminKeys = state.admin;
const adminAccount = await wallet.createSchnorrAccount(
  Fr.fromString(adminKeys.secret),
  Fr.fromString(adminKeys.salt),
  Fq.fromString(adminKeys.signingKey),
  'admin'
);
const adminAddress = adminAccount.address;
log('Admin account address:', adminAddress.toString());

if (!state.nativeContracts) state.nativeContracts = {};


// -----------------------------------------------------------------------------
// 1. Deploy IdentityCredential
// -----------------------------------------------------------------------------
if (state.nativeContracts.IdentityCredential && (await node.getContract(AztecAddress.fromStringUnsafe(state.nativeContracts.IdentityCredential.address)))) {
  log('IdentityCredential already deployed at:', state.nativeContracts.IdentityCredential.address);
} else {
  log('Loading IdentityCredential artifact...');
  const idRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts/aztec/identity/target/identity_credential-IdentityCredential.json'), 'utf8'));
  const idArtifact = loadContractArtifact(idRaw);
  const initialRoot = new Fr(0x12345678n);
  const initialSanctionRoot = new Fr(0x87654321n);
  
  log('Deploying IdentityCredential with issuer = admin ...');
  const idDeploy = Contract.deploy(wallet, idArtifact, [initialRoot, initialSanctionRoot, adminAddress]);
  const idDeployed = await idDeploy.send({ from: adminAddress, fee, wait: { timeout: 900 } });
  const idAddress = (idDeployed.address ?? idDeployed.contract?.address).toString();
  log('IdentityCredential deployed at:', idAddress);
  
  state.nativeContracts.IdentityCredential = {
    address: idAddress,
    artifactName: 'IdentityCredential',
    initialRoot: initialRoot.toString(),
    initialSanctionRoot: initialSanctionRoot.toString(),
    issuer: adminAddress.toString(),
    deployedAt: new Date().toISOString()
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

// -----------------------------------------------------------------------------
// PrivateEscrow and PaymentStream are NOT deployed here.
//
// They hold private token balances: deposits become token notes owned by the
// contract itself. A contract deployed with Contract.deploy() has no public
// keys, so no PXE can ever nullify those notes and every deposit is locked.
// The instances this script deployed on 4 November 2026 had that problem and
// are marked "do-not-use" in deployments/aztec-testnet.json.
//
// Deploy them with keys, one instance per agreement, using
// scripts/aztec/deploy-keyed.ts (lib/aztec/keyed-deploy.ts explains custody).
// -----------------------------------------------------------------------------

log('IdentityCredential is deployed. Escrow and streams: use scripts/aztec/deploy-keyed.ts.');
await wallet.stop();
process.exit(0);
