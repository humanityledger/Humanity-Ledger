import { createPublicClient, http, parseAbi, isAddress } from 'viem';
import { mainnet, base, polygon } from 'viem/chains';

export type TokenGateType = 'ERC20' | 'ERC721' | 'ERC1155';

export interface TokenGateConfig {
  contractAddress: string;
  gateType: TokenGateType;
  chainId: number;
  minAmount?: string;
  tokenId?: string;
  name?: string;
}

export interface GateVerificationResult {
  eligible: boolean;
  actualBalance: string;
  requiredBalance: string;
  symbol?: string;
  error?: string;
}

const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
]);

const ERC721_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function name() view returns (string)'
]);

const ERC1155_ABI = parseAbi([
  'function balanceOf(address account, uint256 id) view returns (uint256)'
]);

function getClientForChain(chainId: number) {
  switch (chainId) {
    case 8453:
      return createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });
    case 137:
      return createPublicClient({ chain: polygon, transport: http('https://polygon-rpc.com') });
    case 1:
    default:
      return createPublicClient({ chain: mainnet, transport: http('https://eth.llamarpc.com') });
  }
}

/**
 * Verifies on-chain eligibility for token-gated communities or channels.
 */
export async function verifyTokenGate(
  walletAddress: string,
  config: TokenGateConfig
): Promise<GateVerificationResult> {
  if (!isAddress(walletAddress) || !isAddress(config.contractAddress)) {
    return {
      eligible: false,
      actualBalance: '0',
      requiredBalance: config.minAmount || '1',
      error: 'Security guard: Invalid Ethereum address format'
    };
  }

  try {
    const client = getClientForChain(config.chainId || 1);
    const target = walletAddress as `0x${string}`;
    const contract = config.contractAddress as `0x${string}`;

    if (config.gateType === 'ERC20') {
      const [balance, decimals, symbol] = await Promise.all([
        client.readContract({
          address: contract,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [target]
        }),
        client.readContract({
          address: contract,
          abi: ERC20_ABI,
          functionName: 'decimals'
        }).catch(() => 18),
        client.readContract({
          address: contract,
          abi: ERC20_ABI,
          functionName: 'symbol'
        }).catch(() => 'TOKEN')
      ]);

      const divisor = BigInt(10 ** Number(decimals));
      const humanBalance = (Number(balance) / Number(divisor)).toFixed(4);
      const minRequired = config.minAmount ? parseFloat(config.minAmount) : 1;
      const eligible = parseFloat(humanBalance) >= minRequired;

      return {
        eligible,
        actualBalance: humanBalance,
        requiredBalance: minRequired.toString(),
        symbol
      };
    }

    if (config.gateType === 'ERC721') {
      const balance = await client.readContract({
        address: contract,
        abi: ERC721_ABI,
        functionName: 'balanceOf',
        args: [target]
      });

      const eligible = Number(balance) > 0;
      return {
        eligible,
        actualBalance: balance.toString(),
        requiredBalance: '1',
        symbol: 'NFT'
      };
    }

    if (config.gateType === 'ERC1155') {
      const tokenId = BigInt(config.tokenId || '0');
      const balance = await client.readContract({
        address: contract,
        abi: ERC1155_ABI,
        functionName: 'balanceOf',
        args: [target, tokenId]
      });

      const eligible = Number(balance) > 0;
      return {
        eligible,
        actualBalance: balance.toString(),
        requiredBalance: '1',
        symbol: 'ERC1155'
      };
    }

    return { eligible: false, actualBalance: '0', requiredBalance: '0', error: 'Unsupported gate type' };
  } catch (err: any) {
    console.error('[TokenGateEngine] Verification error:', err);
    return {
      eligible: false,
      actualBalance: '0',
      requiredBalance: config.minAmount || '1',
      error: err?.message || 'Verification failed'
    };
  }
}
