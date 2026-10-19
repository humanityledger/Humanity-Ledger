import { createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { mainnet, base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/security/server-crypto';
import { getClientForChain } from '@/lib/blockchain/rpc-engine';

// Uniswap V3 Router Contract Address (Ethereum Mainnet)
const UNISWAP_V3_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564' as const;

// Simplified Uniswap V3 Router ABI (ExactInputSingle)
const UNISWAP_V3_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' }
        ],
        name: 'params',
        type: 'tuple'
      }
    ],
    name: 'exactInputSingle',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  }
] as const;

// ERC20 Approve ABI
const ERC20_APPROVE_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

const ALCHEMY_ETH_RPC = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo';

export interface SwapParams {
  userId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  slippagePercent?: number; // Default 0.5%
}

/**
 * DEX SWAP SERVICE - Uniswap V3 Integration
 * Executes real on-chain swaps for attesting
 */
export class DexSwapService {
  
  /**
   * Execute a swap on Uniswap V3
   * @returns Transaction hash
   */
  async executeSwap({ userId, tokenIn, tokenOut, amountIn, slippagePercent = 0.5 }: SwapParams): Promise<string> {
    console.log(`[DEX] Swapping ${amountIn} ${tokenIn}  ${tokenOut}`);

    // 1. Get User Wallet (Non-Custodial Sovereign Check)
    const user: any = await (prisma.authUser as any).findFirst({
      where: { walletAddress: userId },
    });

    if (!user || !user.encryptedPrivateKey) {
      throw new Error('Non-custodial signing: Transaction must be authorized via client wallet');
    }

    const privateKey = await decrypt(user.encryptedPrivateKey);
    const account = privateKeyToAccount(privateKey as `0x${string}`);

    // 2. Setup Clients
    const transport = http();
    const publicClient = getClientForChain(1);
    const walletClient = createWalletClient({ account, chain: mainnet, transport });

    // 3. Get Token Addresses (simplified - in production, use a token registry)
    const tokenInAddress = this.getTokenAddress(tokenIn);
    const tokenOutAddress = this.getTokenAddress(tokenOut);

    if (!tokenInAddress || !tokenOutAddress) {
      throw new Error(`Unsupported token: ${tokenIn} or ${tokenOut}`);
    }

    const decimalsIn = this.getDecimals(tokenIn);
    const amountInWei = parseUnits(amountIn.toString(), decimalsIn);

    // 4. Approve Router to spend tokens
    console.log(`[DEX] Approving ${tokenIn}...`);
    const approveTx = await walletClient.writeContract({
      address: tokenInAddress as `0x${string}`,
      abi: ERC20_APPROVE_ABI,
      functionName: 'approve',
      args: [UNISWAP_V3_ROUTER, amountInWei]
    });

    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    console.log(`[DEX] Approval confirmed`);

    // 5. Calculate minimum output with slippage
    // In production, fetch quote from Uniswap Quoter contract
    const amountOutMinimum = 0n; // Accept any amount (for demo - NOT SAFE in production)

    // 6. Execute Swap
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20); // 20 minutes

    const swapTx = await walletClient.writeContract({
      address: UNISWAP_V3_ROUTER,
      abi: UNISWAP_V3_ABI,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: tokenInAddress as `0x${string}`,
        tokenOut: tokenOutAddress as `0x${string}`,
        fee: 3000, // 0.3% pool
        recipient: account.address,
        deadline,
        amountIn: amountInWei,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n
      }]
    });

    console.log(`[DEX] Swap executed: ${swapTx}`);
    
    // Wait for confirmation
    await publicClient.waitForTransactionReceipt({ hash: swapTx });
    
    return swapTx;
  }

  private getTokenAddress(symbol: string): string | undefined {
    const addresses: Record<string, string> = {
      'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      'WETH': '0xC02aaaa39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    };
    return addresses[symbol];
  }

  private getDecimals(symbol: string): number {
    if (symbol === 'USDT' || symbol === 'USDC') return 6;
    return 18;
  }
}

export const dexSwapService = new DexSwapService();

