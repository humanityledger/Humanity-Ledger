/**
 * Deploys contracts/ZKVerificationKeyRegistry.sol with the v1 VK hashes pinned
 * in lib/aztec/verifier.ts (task R-19).
 *
 * Usage:
 *   VK_REGISTRY_OWNER=0x... VK_REGISTRY_DELAY_SECONDS=172800 \
 *     npx hardhat run scripts/zk/deploy-vk-registry.ts --network <network>
 *
 * The owner should be a multisig. After deployment, set
 * ZK_VK_REGISTRY_ADDRESS and ZK_VK_REGISTRY_RPC_URL so that
 * `assertVKIntegrityOnChain` (lib/aztec/verifier.ts) reads this registry.
 * Nothing has been deployed with this script yet.
 */
import { ethers, network } from 'hardhat';

// Must equal PINNED_VK_SHA256 in lib/aztec/verifier.ts; test/zk/vk-registry-onchain.test.ts
// and test/ZKVerificationKeyRegistry.test.ts use the same values.
const PINNED_V1: Record<string, string> = {
  escrow: '0x4e3cc4c8ce03607dcb2b98bd50c0d31084300634ee8f70f4674919682eb915c2',
  identity: '0xcd02d2407de202d61e1a03c360633a9b0cdd8fe4b4d67b007cce108990632194',
  streams: '0xa79000bf70441f02ce5ec092f15771e93dfc3d990977a33de9991795bc374346',
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const owner = process.env.VK_REGISTRY_OWNER || deployer.address;
  const delay = BigInt(process.env.VK_REGISTRY_DELAY_SECONDS || String(2 * 24 * 3600));
  if (!ethers.isAddress(owner)) throw new Error('VK_REGISTRY_OWNER is not a valid address');

  const names = Object.keys(PINNED_V1);
  const ids = names.map((c) => ethers.id(`hl.${c}.v1`));
  const hashes = names.map((c) => PINNED_V1[c]);

  const Factory = await ethers.getContractFactory('ZKVerificationKeyRegistry');
  const registry = await Factory.deploy(owner, delay, ids, hashes);
  await registry.waitForDeployment();
  const address = await registry.getAddress();

  for (let i = 0; i < names.length; i++) {
    if (!(await registry.isAccepted(ids[i], hashes[i]))) {
      throw new Error(`Registry does not accept the pinned ${names[i]} VK after deployment`);
    }
  }

  console.log(`ZKVerificationKeyRegistry on ${network.name}: ${address}`);
  console.log(`owner ${owner}, timelock ${delay}s, circuits ${names.join(', ')}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
