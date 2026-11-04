import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory Redis: the test checks AnalyticsService's cache logic, not a
// Redis server, so it must not depend on one being reachable from CI.
const store = vi.hoisted(() => new Map<string, string>());
vi.mock('../lib/redis/client', () => ({
    redisClient: {
        get: vi.fn(async (k: string) => store.get(k) ?? null),
        set: vi.fn(async (k: string, v: string) => {
            store.set(k, v);
            return 'OK';
        }),
    },
}));

// ethers.Contract is called with `new`, so the mock implementation must be a
// constructible function (vitest >= 4 rejects arrow functions here).
const contractCtor = vi.hoisted(() =>
    vi.fn(function (this: Record<string, unknown>) {
        this.symbol = vi.fn().mockResolvedValue('USDC');
        this.decimals = vi.fn().mockResolvedValue(6);
        this.name = vi.fn().mockResolvedValue('USD Coin');
    }),
);
vi.mock('ethers', async () => {
    const actual = await vi.importActual<typeof import('ethers')>('ethers');
    return { ...actual, ethers: { ...actual.ethers, Contract: contractCtor } };
});

import { analyticsService } from '../lib/blockchain/AnalyticsService';
import { ChainId } from '../lib/blockchain/BlockchainService';

describe('AnalyticsService CU-Shield Verification', () => {
    const TEST_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

    beforeEach(() => {
        store.clear();
        contractCtor.mockClear();
    });

    it('fetches token metadata once over RPC and serves the second read from the cache', async () => {
        const meta1 = await analyticsService.getTokenMetadata(ChainId.MAINNET, USDC);
        expect(meta1).toEqual({ symbol: 'USDC', decimals: 6, name: 'USD Coin' });
        expect(contractCtor).toHaveBeenCalledTimes(1);
        expect(store.get(`token_meta:${ChainId.MAINNET}:${USDC.toLowerCase()}`)).toBeDefined();

        const meta2 = await analyticsService.getTokenMetadata(ChainId.MAINNET, USDC);
        expect(meta2).toEqual(meta1);
        // No second RPC contract instance: the cache answered.
        expect(contractCtor).toHaveBeenCalledTimes(1);
    });

    it('detects wash-trading cycles in memory', () => {
        const now = new Date().toISOString();
        const history = [
            { from_address: TEST_ADDRESS, to_address: '0xTarget1', value: '1.5', block_timestamp: now },
            { from_address: '0xTarget1', to_address: TEST_ADDRESS, value: '1.45', block_timestamp: now },
            { from_address: TEST_ADDRESS, to_address: '0xTarget1', value: '1.5', block_timestamp: now },
            { from_address: '0xTarget1', to_address: TEST_ADDRESS, value: '1.45', block_timestamp: now },
        ];
        const metrics = (analyticsService as any).detectWashAttesting(TEST_ADDRESS, history);
        expect(metrics.score).toBeGreaterThan(0);
        expect(metrics.patterns).toContain('High volume cycling detected');
    });

    it.todo('retries RPC calls that return HTTP 429 with exponential backoff');
});
