// scripts/aztec/e2e-testnet.mjs
//
// End-to-end check of the private payments wallet against the Aztec test
// network, using exactly the contract calls lib/aztec/wallet/client.ts makes:
//
//   faucet -> shield -> private send A to B -> B discovers it -> B unshields
//
//   node --conditions=browser --import ./scripts/aztec/register.mjs scripts/aztec/e2e-testnet.mjs
//
// Two throwaway accounts are created for each run. Test network only.

import fs from 'node:fs';
import { createAztecNodeClient, waitForTx } from '@aztec-labs/aztec.js/node';
import { Fr, Fq } from '@aztec-labs/aztec.js/fields';
import { AztecAddress } from '@aztec-labs/aztec.js/addresses';
import { getContractInstanceFromInstantiationParams, NO_WAIT } from '@aztec-labs/aztec.js/contracts';
import { SponsoredFeePaymentMethod } from '@aztec-labs/aztec.js/fee';
import { NO_FROM } from '@aztec-labs/aztec.js/account';
import { SponsoredFPCContract } from '@aztec-labs/noir-contracts.js/SponsoredFPC';
import { TokenContract } from '@aztec-labs/noir-contracts.js/Token';
import { openTmpStore } from '@aztec-labs/kv-store/deprecated/indexeddb';
import { EmbeddedWallet } from '@aztec-labs/wallets/embedded';

const state = JSON.parse(fs.readFileSync('.aztec-testnet.local.json', 'utf8'));
const NODE_URL = state.network.nodeUrl;
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
let failures = 0;
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
  if (!ok) failures++;
};
const unwrap = (r) => {
  const v = r && typeof r === 'object' && 'result' in r ? r.result : r;
  return BigInt(typeof v === 'object' && v && 'toBigInt' in v ? v.toBigInt() : v);
};

// The public drpc endpoint refuses JSON-RPC batches larger than 3.
const RPC = { maxBatchSize: 3 };
const node = createAztecNodeClient(NODE_URL, RPC);
const fpc = await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, { salt: new Fr(0) });
const fee = { paymentMethod: new SponsoredFeePaymentMethod(fpc.address) };
const usdc = state.tokens.USDC;

async function newWallet() {
  const w = await EmbeddedWallet.create(NODE_URL, {
    ephemeral: true,
    nodeClientOptions: RPC,
    pxe: { store: await openTmpStore(true) },
    walletDb: { store: await openTmpStore(true) },
  });
  await w.registerContract(fpc, SponsoredFPCContract.artifact);
  const inst = await node.getContract(AztecAddress.fromStringUnsafe(usdc.address));
  await w.registerContract(inst, TokenContract.artifact);
  return w;
}

async function newAccount(w, alias) {
  const m = await w.createSchnorrAccount(Fr.random(), Fr.random(), Fq.random(), alias);
  const d = await m.getDeployMethod();
  await d.send({ from: NO_FROM, fee, wait: { timeout: 900 } });
  log(`${alias} deployed ${m.address}`);
  return m.address;
}

async function sendAndWait(interaction, from) {
  const sent = await interaction.send({ from, fee, wait: NO_WAIT });
  const receipt = await waitForTx(node, sent.txHash, { timeout: 900, interval: 2 });
  return { txHash: sent.txHash.toString(), block: Number(receipt.blockNumber) };
}

const wa = await newWallet();
const wb = await newWallet();
const a = await newAccount(wa, 'alice');
const b = await newAccount(wb, 'bob');
const tokA = TokenContract.at(AztecAddress.fromStringUnsafe(usdc.address), wa);
const tokB = TokenContract.at(AztecAddress.fromStringUnsafe(usdc.address), wb);

// Faucet: alice's wallet holds the published faucet key and mints to alice.
const fm = await wa.createSchnorrAccount(Fr.fromString(state.faucet.secret), Fr.fromString(state.faucet.salt), Fq.fromString(state.faucet.signingKey), 'faucet');
const r1 = await sendAndWait(tokA.methods.mint_to_public(a, 100_000_000n), fm.address);
log('faucet mint', r1.txHash, 'block', r1.block);
check('faucet credits the public balance', unwrap(await tokA.methods.balance_of_public(a).simulate({ from: a })) === 100_000_000n);

const r2 = await sendAndWait(tokA.methods.transfer_to_private(a, 60_000_000n), a);
log('shield', r2.txHash);
check('shield moves funds to private', unwrap(await tokA.methods.balance_of_private(a).simulate({ from: a })) === 60_000_000n);
check('shield reduces the public balance', unwrap(await tokA.methods.balance_of_public(a).simulate({ from: a })) === 40_000_000n);

const r3 = await sendAndWait(tokA.methods.transfer(b, 25_000_000n), a);
log('private send', r3.txHash);
check('sender private balance after send', unwrap(await tokA.methods.balance_of_private(a).simulate({ from: a })) === 35_000_000n);

const bBefore = unwrap(await tokB.methods.balance_of_private(b).simulate({ from: b }));
check('recipient sees the payment without registering the sender', bBefore === 25_000_000n, `saw ${bBefore}`);
if (bBefore !== 25_000_000n) {
  await wb.registerSender(a, 'alice');
  const bAfter = unwrap(await tokB.methods.balance_of_private(b).simulate({ from: b }));
  check('recipient sees the payment after registering the sender', bAfter === 25_000_000n, `saw ${bAfter}`);
}

const evA = await wa.getPrivateEvents(TokenContract.events.Transfer, { contractAddress: AztecAddress.fromStringUnsafe(usdc.address), scopes: [a] });
const evB = await wb.getPrivateEvents(TokenContract.events.Transfer, { contractAddress: AztecAddress.fromStringUnsafe(usdc.address), scopes: [b] });
log('events A', evA.map((e) => `${e.event.from}->${e.event.to}:${e.event.amount} @${e.metadata?.blockNumber} ${e.metadata?.txHash}`));
log('events B', evB.map((e) => `${e.event.from}->${e.event.to}:${e.event.amount} @${e.metadata?.blockNumber}`));
// The Token contract delivers the Transfer event to the recipient only, so a
// sender's own history comes from the record its device keeps when it sends
// (lib/aztec/wallet/history.ts). That is expected, not a failure.
log(`sender received ${evA.length} Transfer events for its own payment (expected 0)`);
check('recipient history shows the payment', evB.some((e) => String(e.event.from).toLowerCase() === a.toString().toLowerCase()));
check('events carry the block number', evB.every((e) => Number(e.metadata?.l2BlockNumber) > 0));

const r4 = await sendAndWait(tokB.methods.transfer_to_public(b, b, 10_000_000n, 0), b);
log('unshield', r4.txHash);
check('unshield moves funds to public', unwrap(await tokB.methods.balance_of_public(b).simulate({ from: b })) === 10_000_000n);
check('unshield reduces the private balance', unwrap(await tokB.methods.balance_of_private(b).simulate({ from: b })) === 15_000_000n);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
await wa.stop();
await wb.stop();
process.exit(failures ? 1 : 0);
