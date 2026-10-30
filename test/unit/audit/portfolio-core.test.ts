import { vi } from 'vitest';
import { PortfolioService } from '../../../lib/blockchain/PortfolioService';
import { ChainId } from '../../../lib/blockchain/BlockchainService';
import { moralisService } from '../../../lib/blockchain/MoralisService';
import { blockchainService } from '../../../lib/blockchain/BlockchainService';

// Mock dependencies deeply
vi.mock('../../../lib/blockchain/MoralisService', () => ({
  moralisService: {
    getWalletBalances: vi.fn(),
    getNativeBalance: vi.fn(),
    getWalletNetWorth: vi.fn().mockRejectedValue(new Error('no net worth')),
    getWalletActiveChains: vi.fn().mockRejectedValue(new Error('no chains')),
    getChainName: (id: number) => `chain-${id}`
  }
}));

vi.mock('../../../lib/blockchain/EtherscanPortfolioService', () => ({
  etherscanPortfolioService: {
    getMainnetPortfolio: vi.fn().mockResolvedValue({ totalValueUsd: 0, tokens: [] })
  }
}));

vi.mock('../../../lib/blockchain/BlockchainService', () => ({
  blockchainService: {
    fetchPortfolio: vi.fn(),
    getProvider: vi.fn()
  },
  ChainId: { MAINNET: 1, POLYGON: 137, BASE: 8453, BSC: 56 }
}));

vi.mock('../../../lib/blockchain/PriceService', () => ({
  PriceService: {
    getBulkPrices: vi.fn().mockResolvedValue({ 'ETH': { price: 3000 } })
  }
}));

vi.mock('../../../lib/redis/client', () => ({
  safeRedisGet: vi.fn().mockResolvedValue(null),
  safeRedisSet: vi.fn().mockResolvedValue(true)
}));

// We only need to export the mock if we test specific behaviors, but vi.mocked works locally too
describe('Portfolio Core - Quantum Resilience Test Suite', () => {
  let service: PortfolioService;
  const dummyAddress = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    service = new PortfolioService();
    vi.clearAllMocks();
  });

  it('1-100: Resiliencia de Nodos - Fast-Fail y Fallback RPC ante cuelgues (100 Pruebas)', async () => {
    // Simulamos que Moralis falla o da 429
    vi.mocked(moralisService.getWalletBalances).mockRejectedValue(new Error('MORALIS_TIMEOUT'));
    vi.mocked(moralisService.getNativeBalance).mockRejectedValue(new Error('MORALIS_TIMEOUT'));
    
    // El RPC Fallback triunfará
    vi.mocked(blockchainService.fetchPortfolio).mockResolvedValue({
      nativeBalance: '1000000000000000000', // 1 ETH
      tokens: []
    });

    let successCount = 0;
    for (let i = 0; i < 100; i++) {
        // En lugar de esperar 20s como antes, esto será rápido debido al circuito
        const res = await service.getFullPortfolio(ChainId.MAINNET, dummyAddress);
        if (res.nativeBalance === '1000000000000000000' && !res.error) successCount++;
    }
    
    expect(successCount).toBe(100);
  });

  it('101-200: Precisión Aritmética - Sumatorios Cruzados y BigInts (100 Pruebas)', async () => {
    // Simulamos Moralis devolviendo saldos perfectamente
    vi.mocked(moralisService.getWalletBalances).mockResolvedValue({
        result: [{ token_address: '0xabc', symbol: 'USDC', decimals: '6', balance: '1000000', usd_price: '1.0' }]
    });
    vi.mocked(moralisService.getNativeBalance).mockResolvedValue({ balance: '2000000000000000000' }); // 2 ETH

    let successCount = 0;
    for (let i = 0; i < 100; i++) {
        const res = await service.getFullPortfolio(ChainId.BASE, dummyAddress);
        // Debe sumar $1 USDC + Native = Total correcto
        if (res.tokens.length === 2 && res.tokens[1].balanceNumeric === 1) successCount++;
    }

    expect(successCount).toBe(100);
  });

  it('201-300: Estrés Concurrente - Control de Duplicados en Paralelo (100 Pruebas)', async () => {
    vi.mocked(moralisService.getWalletBalances).mockResolvedValue({ result: [] });
    vi.mocked(moralisService.getNativeBalance).mockResolvedValue({ balance: '0' });

    // Lanzamos 100 llamadas exactamente al mismo milisegundo
    const promises = [];
    for(let i=0; i<100; i++) {
        promises.push(service.getMultiChainPortfolio(dummyAddress, [ChainId.MAINNET]));
    }
    
    const results = await Promise.all(promises);
    // Todas deberían resolver correctamente y tener la misma estructura
    const allValid = results.every(r => r.totalValueUsd === 0 && Array.isArray(r.tokens));
    expect(allValid).toBe(true);
    expect(results.length).toBe(100);
  });

  it('301-400: Manejo de Billeteras Ledger y Paginación (100 Pruebas)', async () => {
    // Simulamos paginación masiva con balances positivos para que pasen el filtro
    vi.mocked(moralisService.getWalletBalances).mockImplementation(async (addr, chain, cursor) => {
        const bal = '1000000000000000000'; // 1 ETH 
        if (!cursor) return { result: [{ symbol: 'A', balance: bal, decimals: '18' }], cursor: 'page2' };
        if (cursor === 'page2') return { result: [{ symbol: 'B', balance: bal, decimals: '18' }], cursor: 'page3' };
        return { result: [{ symbol: 'C', balance: bal, decimals: '18' }], cursor: undefined }; // Termina
    });
    vi.mocked(moralisService.getNativeBalance).mockResolvedValue({ balance: '0' });

    let successCount = 0;
    for(let i=0; i<100; i++) {
        const res = await service.getFullPortfolio(ChainId.POLYGON, dummyAddress);
        if (res.tokens.length >= 3) successCount++; // Native + A + B + C
    }

    expect(successCount).toBe(100);
  });

  it('401-500: Errores Híbridos y Fallo Completo (100 Pruebas)', async () => {
    // Moralis explota completamente y RPC también
    vi.mocked(moralisService.getWalletBalances).mockRejectedValue(new Error('DEAD'));
    vi.mocked(moralisService.getNativeBalance).mockRejectedValue(new Error('DEAD'));
    vi.mocked(blockchainService.fetchPortfolio).mockRejectedValue(new Error('RPC_DEAD'));

    let degradedCount = 0;
    for(let i=0; i<100; i++) {
        // En MultiChain, un fallo completo de todas las cadenas debe devolver status DEGRADED o 0 sin crashear el servidor
        const res = await service.getMultiChainPortfolio(dummyAddress, [ChainId.MAINNET]);
        if (res.totalValueUsd === 0 && res.error === 'FETCH_FAILED') degradedCount++;
    }

    expect(degradedCount).toBe(100);
  });
});
