/**
 * deployments/aztec-testnet.json is the record we point reviewers to. These
 * checks run offline on every CI run:
 *
 *   - for each contract that tracks the current artifact, the recorded class
 *     ID is the one computed from the committed artifact, so the source in
 *     this repository is the code that was deployed (older instances keep the
 *     class they were deployed with; the live test confirms it on the node);
 *   - a contract that holds private token balances is never marked active
 *     unless it was deployed with public keys (see lib/aztec/keyed-deploy.ts:
 *     without keys its token notes can never be spent).
 *
 * The live counterpart, which asks the testnet node, is
 * test/live/aztec-deployments.live.test.ts.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadContractArtifact } from '@aztec-labs/aztec.js/abi';

const root = path.resolve(__dirname, '../../..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'deployments/aztec-testnet.json'), 'utf8'));

interface Entry {
  name: string;
  address: string;
  classId: string;
  artifact: string;
  holdsPrivateBalance: boolean;
  keyed: boolean;
  status: 'active' | 'reference' | 'do-not-use' | 'settled';
  tracksCurrentArtifact: boolean;
}

async function classIdOf(artifactPath: string): Promise<string> {
  const { getContractClassFromArtifact } = await import('@aztec-labs/stdlib/contract');
  const artifact = loadContractArtifact(JSON.parse(fs.readFileSync(path.join(root, artifactPath), 'utf8')));
  const cls = await getContractClassFromArtifact(artifact);
  return cls.id.toString();
}

describe('deployments/aztec-testnet.json', () => {
  const entries = registry.contracts as Entry[];

  it('lists each contract once, with a 32-byte address and class ID', () => {
    const names = entries.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
    for (const e of entries) {
      expect(e.address).toMatch(/^0x[0-9a-f]{64}$/);
      expect(e.classId).toMatch(/^0x[0-9a-f]{64}$/);
    }
  });

  it('never marks a token-holding contract active unless it is keyed', () => {
    for (const e of entries) {
      if (e.holdsPrivateBalance && e.status === 'active') expect(e.keyed, e.name).toBe(true);
    }
  });

  it('at least one entry is checked against the current artifacts', () => {
    const current = entries.filter((e) => e.tracksCurrentArtifact);
    expect(current.length).toBeGreaterThan(0);
  });

  for (const e of entries.filter((x) => x.tracksCurrentArtifact)) {
    it(`${e.name}: the recorded class ID is the one computed from the committed artifact`, async () => {
      expect(await classIdOf(e.artifact)).toBe(e.classId);
    });
  }
});

// deployments/aztec-mainnet.json: the same rules, plus the network values
// pinned in lib/aztec/sequencer/networks.ts. Empty until something is deployed.
describe('deployments/aztec-mainnet.json', () => {
  const mainnet = JSON.parse(fs.readFileSync(path.join(root, 'deployments/aztec-mainnet.json'), 'utf8'));
  const entries = mainnet.contracts as Entry[];

  it('names the pinned Alpha network and no sponsored fee payer', async () => {
    const { AZTEC_NETWORKS } = await import('@/lib/aztec/sequencer/networks');
    expect(mainnet.network.l1ChainId).toBe(1);
    expect(mainnet.network.rollupVersion).toBe(AZTEC_NETWORKS.mainnet.rollupVersion);
    expect(mainnet.network.nodeUrl).toBe(AZTEC_NETWORKS.mainnet.publicNodeRpc);
    expect(mainnet.sponsoredFpc).toBeNull();
  });

  it('records every instance with its transaction and block, keyed when it holds tokens', () => {
    for (const e of entries as Array<Entry & { deployTx?: string; deployBlock?: number }>) {
      expect(e.address).toMatch(/^0x[0-9a-f]{64}$/);
      expect(e.classId).toMatch(/^0x[0-9a-f]{64}$/);
      expect(e.deployTx, e.name).toMatch(/^0x[0-9a-f]{64}$/);
      expect(Number.isInteger(e.deployBlock), e.name).toBe(true);
      if (e.holdsPrivateBalance) expect(e.keyed, e.name).toBe(true);
    }
  });

  for (const e of entries.filter((x) => x.tracksCurrentArtifact)) {
    it(`${e.name}: the recorded class ID is the one computed from the committed artifact`, async () => {
      expect(await classIdOf(e.artifact)).toBe(e.classId);
    });
  }
});

// deployments/aztec-mainnet.json, tokens: the private tokens the wallet may list
// on Alpha. The live preflight confirms each one on the node; these checks are
// the offline half (shape, naming, and the class of the trusted Token artifact).
describe('deployments/aztec-mainnet.json tokens', () => {
  const mainnet = JSON.parse(fs.readFileSync(path.join(root, 'deployments/aztec-mainnet.json'), 'utf8'));
  const tokens = (mainnet.tokens ?? []) as Array<{
    key: string; symbol: string; name: string; decimals: number; address: string; admin: string;
    artifact: string; classId: string | null; deployTx: string; deployBlock: number; status: string;
  }>;
  const HEX32 = /^0x[0-9a-f]{64}$/;
  // Symbols of real assets: an operator token on mainnet must never look like one of them.
  const RESERVED = ['USDC', 'USDT', 'DAI', 'ETH', 'WETH', 'BTC', 'WBTC', 'LUSD', 'EURC', 'AZTEC'];

  it('records each token once, in a wallet slot, with 32-byte addresses and its deploy transaction', async () => {
    const { TOKEN_ORDER } = await import('@/lib/aztec/wallet/config');
    expect(new Set(tokens.map((t) => t.key)).size).toBe(tokens.length);
    expect(new Set(tokens.map((t) => t.address)).size).toBe(tokens.length);
    for (const t of tokens) {
      expect(TOKEN_ORDER, t.symbol).toContain(t.key);
      expect(t.address, t.symbol).toMatch(HEX32);
      expect(t.admin, t.symbol).toMatch(HEX32);
      expect(t.deployTx, t.symbol).toMatch(HEX32);
      // 0 = not yet confirmed; the preflight prints the real block, which is then recorded.
      expect(Number.isInteger(t.deployBlock) && t.deployBlock >= 0, t.symbol).toBe(true);
      if (t.deployBlock === 0) expect(t.status, t.symbol).toBe('pending-preflight');
      expect(Number.isInteger(t.decimals) && t.decimals >= 0 && t.decimals <= 36, t.symbol).toBe(true);
    }
  });

  it('never names an operator token like a real asset', () => {
    for (const t of tokens) {
      expect(t.symbol.trim().length, t.key).toBeGreaterThan(0);
      expect(RESERVED, t.symbol).not.toContain(t.symbol.toUpperCase());
      // The Token contract stores the name as a 31-byte compressed string.
      expect(new TextEncoder().encode(t.name).length, t.symbol).toBeLessThanOrEqual(31);
    }
  });

  it('a recorded class ID is the class of the trusted Token artifact (token-check.ts)', async () => {
    const { getContractClassFromArtifact } = await import('@aztec-labs/stdlib/contract');
    const { TokenContractArtifact } = (await import('@aztec-labs/noir-contracts.js/Token')) as any;
    const trusted = (await getContractClassFromArtifact(TokenContractArtifact)).id.toString();
    console.log(`trusted Token class (noir-contracts.js 6.0.0): ${trusted}`);
    for (const t of tokens) {
      expect(t.artifact, t.symbol).toBe('@aztec-labs/noir-contracts.js/Token');
      if (t.classId !== null) expect(t.classId, t.symbol).toBe(trusted);
      else expect(t.status, t.symbol).toBe('pending-preflight');
    }
  });
});
