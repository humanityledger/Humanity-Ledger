// scripts/aztec/deploy-contracts-testnet.mjs
//
// Deploys the three native Aztec v6.0.0 contracts to Aztec Testnet:
//   1. IdentityCredential (Identity claims with scope-isolated single-use nullifiers)
//   2. PrivateEscrow (Shielded multi-asset peer-to-peer conditional lockups)
//   3. PaymentStream (Real-time confidential micro-streaming)
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

const usdcAddress = AztecAddress.fromStringUnsafe(state.tokens.USDC.address);
log('Using zkUSDC for Escrow & Streams:', usdcAddress.toString());

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
// 2. Deploy PrivateEscrow
// -----------------------------------------------------------------------------
if (state.nativeContracts.PrivateEscrow && (await node.getContract(AztecAddress.fromStringUnsafe(state.nativeContracts.PrivateEscrow.address)))) {
  log('PrivateEscrow already deployed at:', state.nativeContracts.PrivateEscrow.address);
} else {
  log('Loading PrivateEscrow artifact...');
  const escrowRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts/aztec/escrow/target/private_escrow-PrivateEscrow.json'), 'utf8'));
  const escrowArtifact = loadContractArtifact(escrowRaw);
  
  log('Deploying PrivateEscrow bound to zkUSDC ...');
  const escrowDeploy = Contract.deploy(wallet, escrowArtifact, [usdcAddress]);
  const escrowDeployed = await escrowDeploy.send({ from: adminAddress, fee, wait: { timeout: 900 } });
  const escrowAddress = (escrowDeployed.address ?? escrowDeployed.contract?.address).toString();
  log('PrivateEscrow deployed at:', escrowAddress);
  
  state.nativeContracts.PrivateEscrow = {
    address: escrowAddress,
    artifactName: 'PrivateEscrow',
    token: usdcAddress.toString(),
    deployedAt: new Date().toISOString()
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

// -----------------------------------------------------------------------------
// 3. Deploy PaymentStream
// -----------------------------------------------------------------------------
if (state.nativeContracts.PaymentStream && (await node.getContract(AztecAddress.fromStringUnsafe(state.nativeContracts.PaymentStream.address)))) {
  log('PaymentStream already deployed at:', state.nativeContracts.PaymentStream.address);
} else {
  log('Loading PaymentStream artifact...');
  const streamRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts/aztec/streams/target/payment_stream-PaymentStream.json'), 'utf8'));
  const streamArtifact = loadContractArtifact(streamRaw);
  
  log('Deploying PaymentStream bound to zkUSDC ...');
  const streamDeploy = Contract.deploy(wallet, streamArtifact, [usdcAddress]);
  const streamDeployed = await streamDeploy.send({ from: adminAddress, fee, wait: { timeout: 900 } });
  const streamAddress = (streamDeployed.address ?? streamDeployed.contract?.address).toString();
  log('PaymentStream deployed at:', streamAddress);
  
  state.nativeContracts.PaymentStream = {
    address: streamAddress,
    artifactName: 'PaymentStream',
    token: usdcAddress.toString(),
    deployedAt: new Date().toISOString()
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

log('All 3 Aztec Native Contracts successfully verified and stored!');
await wallet.stop();
process.exit(0);
