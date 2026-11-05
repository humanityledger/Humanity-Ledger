/**
 * Fee payment per network: no sponsored fee payer on Alpha mainnet, the
 * canonical one on testnet, and the network is read from the node.
 */
import { describe, it, expect } from 'vitest';
import { feeChoices, assertFeeChoice, feeNetworkFromL1ChainId, identifyNode, SPONSORED_FPC, LOCAL_L1_CHAIN_ID } from '@/lib/aztec/fees';
import { AZTEC_NETWORKS } from '@/lib/aztec/sequencer/networks';
import fs from 'node:fs';
import path from 'node:path';

describe('fee choices', () => {
  it('never offers a sponsored fee payer on Alpha mainnet', () => {
    const c = feeChoices('mainnet');
    expect(c.map((x) => x.kind)).toEqual(['fee-juice', 'fee-juice-claim']);
    expect(() => assertFeeChoice('mainnet', { kind: 'sponsored', fpc: SPONSORED_FPC.testnet! })).toThrow(/Fee Juice/);
    expect(() => assertFeeChoice('mainnet', { kind: 'fee-juice' })).not.toThrow();
  });

  it('offers the canonical sponsored fee payer on testnet, and only that address', () => {
    expect(feeChoices('testnet')[0]).toEqual({ kind: 'sponsored', fpc: SPONSORED_FPC.testnet });
    expect(() => assertFeeChoice('testnet', { kind: 'sponsored', fpc: SPONSORED_FPC.testnet!.toUpperCase().replace('0X', '0x') })).not.toThrow();
    expect(() => assertFeeChoice('testnet', { kind: 'sponsored', fpc: '0x' + '11'.repeat(32) })).toThrow();
  });

  it('uses the sponsored fee payer the local network reports, if any', () => {
    expect(feeChoices('local').map((x) => x.kind)).toEqual(['fee-juice', 'fee-juice-claim']);
    const fpc = '0x' + '22'.repeat(32);
    expect(feeChoices('local', fpc)[0]).toEqual({ kind: 'sponsored', fpc });
  });

  it('matches the sponsored fee payer in the testnet deployment record', () => {
    const record = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../deployments/aztec-testnet.json'), 'utf8'));
    expect(record.sponsoredFpc.toLowerCase()).toBe(SPONSORED_FPC.testnet!.toLowerCase());
  });
});

describe('identifyNode', () => {
  it('maps L1 chain IDs to networks', () => {
    expect(feeNetworkFromL1ChainId(1)).toBe('mainnet');
    expect(feeNetworkFromL1ChainId(11155111)).toBe('testnet');
    expect(feeNetworkFromL1ChainId(LOCAL_L1_CHAIN_ID)).toBe('local');
    expect(feeNetworkFromL1ChainId(10)).toBeUndefined();
  });

  it('reports no drift for a node that matches the pinned Alpha values', () => {
    const m = AZTEC_NETWORKS.mainnet;
    const id = identifyNode({ l1ChainId: 1, rollupVersion: m.rollupVersion, nodeVersion: m.nodeVersion, l1ContractAddresses: { rollupAddress: m.l1.rollup } });
    expect(id).toEqual({ network: 'mainnet', drift: [] });
  });

  it('reports drift when the node runs another rollup or version', () => {
    const id = identifyNode({ l1ChainId: '11155111', rollupVersion: 1n, nodeVersion: '7.0.0' });
    expect(id.network).toBe('testnet');
    expect(id.drift.map((d) => d.field).sort()).toEqual(['nodeVersion', 'rollupVersion']);
  });
});
