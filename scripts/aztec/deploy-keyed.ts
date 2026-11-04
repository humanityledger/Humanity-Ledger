/**
 * scripts/aztec/deploy-keyed.ts — master prompt task A.3.
 *
 * Deploys PrivateEscrow or PaymentStream with public keys derived from a fresh
 * secret, so that the contract's own token notes can be found and spent by the
 * parties' PXEs (see lib/aztec/keyed-deploy.ts for why and for custody).
 *
 *   AZTEC_NODE_URL=https://... CONTRACT=escrow TOKEN=0x... \
 *     node --conditions=browser --import ./scripts/aztec/register.mjs scripts/aztec/deploy-keyed.ts
 *
 * Test network only. The deployer account is a throwaway Schnorr account
 * paid by the sponsored FPC, as in scripts/aztec/e2e-testnet.mjs. The
 * contract secret is written to .aztec-keyed.local.json (gitignored) and
 * must be handed to the escrow/stream parties out of band; it is never
 * printed. The same deployment path is exercised on testnet by
 * scripts/aztec/e2e-escrow-testnet.mts.
 */
import fs from 'node:fs';
import { createAztecNodeClient } from '@aztec-labs/aztec.js/node';
import { Fr, Fq } from '@aztec-labs/aztec.js/fields';
import { AztecAddress } from '@aztec-labs/aztec.js/addresses';
import { Contract, DeployMethod, getContractInstanceFromInstantiationParams } from '@aztec-labs/aztec.js/contracts';
import { SponsoredFeePaymentMethod } from '@aztec-labs/aztec.js/fee';
import { NO_FROM } from '@aztec-labs/aztec.js/account';
import { SponsoredFPCContract } from '@aztec-labs/noir-contracts.js/SponsoredFPC';
import { openTmpStore } from '@aztec-labs/kv-store/deprecated/indexeddb';
import { EmbeddedWallet } from '@aztec-labs/wallets/embedded';
import { KEYED_ARTIFACT_PATHS, computeKeyedInstance, loadKeyedArtifact, type KeyedContract } from '../../lib/aztec/keyed-deploy';

const NODE_URL = process.env.AZTEC_NODE_URL;
const CONTRACT = (process.env.CONTRACT ?? 'escrow') as KeyedContract;
const TOKEN = process.env.TOKEN;
const OUT = '.aztec-keyed.local.json';

async function main() {
  if (!NODE_URL) throw new Error('AZTEC_NODE_URL is required');
  if (!TOKEN) throw new Error('TOKEN (token contract address) is required');
  if (!(CONTRACT in KEYED_ARTIFACT_PATHS)) throw new Error('CONTRACT must be escrow or streams');

  const artifact = loadKeyedArtifact(JSON.parse(fs.readFileSync(KEYED_ARTIFACT_PATHS[CONTRACT], 'utf8')));
  const token = AztecAddress.fromStringUnsafe(TOKEN);
  const secretKey = Fr.random();
  const salt = Fr.random();

  const node = createAztecNodeClient(NODE_URL, { maxBatchSize: 3 });
  const fpc = await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, { salt: new Fr(0) });
  const fee = { paymentMethod: new SponsoredFeePaymentMethod(fpc.address) };
  const wallet = await EmbeddedWallet.create(NODE_URL, {
    ephemeral: true,
    nodeClientOptions: { maxBatchSize: 3 },
    pxe: { store: await openTmpStore(true) },
    walletDb: { store: await openTmpStore(true) },
  });
  await wallet.registerContract(fpc, SponsoredFPCContract.artifact);

  const account = await wallet.createSchnorrAccount(Fr.random(), Fr.random(), Fq.random(), 'deployer');
  await (await account.getDeployMethod()).send({ from: NO_FROM, fee, wait: { timeout: 900 } });

  // Universal deployment (deployer zero), so the address depends only on the
  // artifact, constructor arguments, salt and keys.
  const expected = await computeKeyedInstance(artifact, { secretKey, salt, token });
  // aztec.js 6.0.0: keys, salt and universal deployment are instantiation
  // options of DeployMethod.create (there is no Contract.deployWithPublicKeys).
  const deployment = DeployMethod.create(
    wallet,
    { artifact, args: [token], postDeployCtor: (instance: any, w: any) => Contract.at(instance.address, artifact, w) },
    { salt, publicKeys: expected.publicKeys, universalDeploy: true },
  );
  const deployed: any = await deployment.send({ from: account.address, fee, wait: { timeout: 900 } } as any);
  const address = deployed.instance?.address ?? deployed.contract?.address;
  if (!address || !AztecAddress.fromStringUnsafe(address.toString()).equals(expected.instance.address)) {
    throw new Error('Deployed address does not match the keyed instance computed locally');
  }

  // Register the contract with its secret so this PXE can spend its notes.
  await wallet.registerContract(expected.instance, artifact, secretKey);

  fs.writeFileSync(
    OUT,
    JSON.stringify(
      { contract: CONTRACT, address: address.toString(), token: TOKEN, salt: salt.toString(), secretKey: secretKey.toString(), node: NODE_URL },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(`${CONTRACT} deployed with public keys at ${address.toString()}; secret written to ${OUT}`);
  await wallet.stop();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
