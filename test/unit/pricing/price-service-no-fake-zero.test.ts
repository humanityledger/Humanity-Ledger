import { readFileSync } from 'node:fs';

/** F-09: a symbol without a price is absent from the result, never { price: 0 }. */
vi.mock('@/lib/priceHelper', () => ({
  STEEL_DOME_FALLBACKS: {} as Record<string, number>,
  getBulkPricesWithChange: vi.fn(async (symbols: string[]) =>
    Object.fromEntries(symbols.filter((s) => s === 'ETH').map((s) => [s, { price: 3000.5, change24h: 1.2 }])),
  ),
}));

describe('PriceService.getBulkPrices', () => {
  it('returns real quotes only; an unknown symbol is undefined, not 0', async () => {
    const { PriceService } = await import('@/lib/blockchain/PriceService');
    const prices = await PriceService.getBulkPrices([{ symbol: 'ETH' }, { symbol: 'NOPE' }]);
    expect(prices.ETH).toEqual({ price: 3000.5, change24h: 1.2 });
    expect(prices.NOPE).toBeUndefined();
    expect('NOPE' in prices).toBe(false);
  });

  it('a failing price source gives an empty result, not zeros', async () => {
    const helper = await import('@/lib/priceHelper');
    (helper.getBulkPricesWithChange as unknown as { mockRejectedValueOnce: (e: unknown) => void }).mockRejectedValueOnce(new Error('down'));
    const { PriceService } = await import('@/lib/blockchain/PriceService');
    const prices = await PriceService.getBulkPrices([{ symbol: 'ETH' }]);
    expect(prices).toEqual({});
  });

  it('no consumer replaces a missing price with an invented one', () => {
    for (const f of [
      'app/api/user/portfolio/route.ts',
      'lib/services/SearchAnalyticsService.ts',
      'lib/wallet/WalletAnalyticsService.ts',
      'app/api/premium/wallet-history/route.ts',
      'components/chat/NativeCryptoSendModal.tsx',
    ]) {
      const src = readFileSync(f, 'utf8').replace(/\/\*[^]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(src, f).not.toMatch(/\|\|\s*\{\s*price:\s*\d+\s*\}|\?\.price\s*\|\|\s*\d{3,}|:\s*2500\)|rate:\s*2500/);
    }
  });
});
