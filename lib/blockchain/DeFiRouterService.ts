import { ChainId } from './BlockchainService';
import { getUsdcAddress } from '@/config/tokens';
import { parseUnits } from 'viem';

export interface RouteResponse {
    tx: {
        to: string;
        data: string;
        value: string;
        chainId: number;
    };
    gas: number;
    expectedOutput: string;
}

/**
 * Universal DeFi Router Service  powered by the Li.Fi API.
 *
 * Li.Fi is a cross-chain swap & bridge aggregator that also handles
 * vault deposits via its /quote endpoint. It is completely free to
 * use with no account or API key required. The optional `x-lifi-api-key`
 * header only increases rate limits and is not needed for production
 * at normal user volumes.
 *
 * API docs: https://docs.li.fi/
 */
export class DeFiRouterService {

    private readonly LIFI_QUOTE_URL = 'https://li.quest/v1/quote';

    /**
     * Map DeFiLlama chain names to EVM chain IDs.
     */
    public resolveChainId(chainName: string): number {
        const MAP: Record<string, number> = {
            'Ethereum': 1,
            'Arbitrum': 42161,
            'Base': 8453,
            'Optimism': 10,
            'Polygon': 137,
            'BSC': 56,
            'Avalanche': 43114,
            'Fantom': 250,
        };
        return MAP[chainName] || 1;
    }

    /**
     * Builds the on-chain deposit calldata for USDC  Vault using Li.Fi.
     *
     * @param chainName   Chain name as returned by DeFiLlama (e.g. "Ethereum")
     * @param vaultAddress The vault/pool contract address from DeFiLlama
     * @param amountHuman  Amount in human-readable form (e.g. "100" for 100 USDC)
     * @param userAddress  The wallet address that will execute the transaction
     */
    public async buildDepositTransaction(
        chainName: string,
        vaultAddress: string,
        amountHuman: string,
        userAddress: string
    ): Promise<RouteResponse> {
        try {
            const chainId = this.resolveChainId(chainName);

            // USDC is the universal input token for DeFiLlama stable vaults.
            const usdcAddress = getUsdcAddress(chainId as ChainId)
                ?? '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // Mainnet USDC fallback

            // USDC uses 6 decimals.
            const amountWei = parseUnits(amountHuman, 6).toString();

            // Li.Fi /quote parameters
            const params = new URLSearchParams({
                fromChain:    chainId.toString(),
                toChain:      chainId.toString(),   // Same-chain vault deposit
                fromToken:    usdcAddress,
                toToken:      vaultAddress,          // Vault receipt token = output
                fromAmount:   amountWei,
                fromAddress:  userAddress,
                toAddress:    userAddress,
                slippage:     '0.03',                // 3% max slippage
                integrator:   'ledgerchat',           // Identifies this dApp to Li.Fi
                order:        'RECOMMENDED',
            });

            console.log(`[DeFiRouter] Requesting Li.Fi quote  ${this.LIFI_QUOTE_URL}?${params}`);

            const response = await fetch(`${this.LIFI_QUOTE_URL}?${params}`, {
                headers: {
                    'Accept': 'application/json',
                    // No API key required. Add x-lifi-api-key here if rate limits
                    // become a concern at scale.
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Li.Fi API Error (${response.status}): ${errorText}`);
            }

            const data = await response.json();

            // Li.Fi returns transactionRequest for direct on-chain execution.
            const txRequest = data.transactionRequest;
            if (!txRequest) {
                throw new Error('Li.Fi returned a valid route but no transactionRequest. The vault token may not be supported.');
            }

            return {
                tx: {
                    to:      txRequest.to,
                    data:    txRequest.data,
                    value:   txRequest.value ?? '0x0',
                    chainId,
                },
                gas:            parseInt(txRequest.gasLimit ?? '0', 16),
                expectedOutput: data.estimate?.toAmount ?? '0',
            };

        } catch (error: any) {
            console.error('[DeFiRouterService] Deposit Tx construction failed:', error.message);
            throw new Error(`Execution Engine Error: ${error.message}`);
        }
    }
}

export const defiRouterService = new DeFiRouterService();
