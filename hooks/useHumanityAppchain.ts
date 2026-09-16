import { useContractRead, useContractWrite, useAccount } from 'wagmi';
import { parseAbi } from 'viem';

/**
 * CORE ABI for the Humanity Appchain
 * This connects the Next.js UI directly to the newly created Ethereum L2 Contracts
 * bypassing the old PostgreSQL Prisma database completely.
 */
const CORE_ABI = parseAbi([
  'function getSystemConfiguration() view returns (address, address, address, address, address)',
  'function identityRegistry() view returns (address)',
  'function paymaster() view returns (address)',
]);

const IDENTITY_ABI = parseAbi([
  'function registerIdentity(string _displayName, string _avatarUrl, string _bio, bytes32 _worldId) external',
  'function pingActivity() external',
]);

const CHAT_ABI = parseAbi([
  'function createRoom(bytes32 _roomId, string _name, string _encryptedKey) external',
  'function joinRoom(bytes32 _roomId) external',
  'function sendMessage(bytes32 _roomId, string _encryptedContent) external',
]);

// This address will be set once the core is deployed to the Humanity Appchain (L2)
const CORE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CORE_CONTRACT as `0x${string}`;

/**
 * Hook to interact with the Humanity Full On-Chain Ecosystem
 */
export function useHumanityAppchain() {
  const { address, isConnected } = useAccount();

  // 1. Fetch all App Addresses
  const { data: systemConfig } = useContractRead({
    address: CORE_CONTRACT_ADDRESS,
    abi: CORE_ABI,
    functionName: 'getSystemConfiguration',
  });

  // 2. Identity Registration (Replaces /api/auth/register)
  const { writeAsync: registerIdentity } = useContractWrite({
    address: systemConfig?.[0], // Identity Registry Address
    abi: IDENTITY_ABI,
    functionName: 'registerIdentity',
  });

  // 3. Decentralized Chat (Replaces WebSockets)
  const { writeAsync: sendOnChainMessage } = useContractWrite({
    address: systemConfig?.[2], // Ledger Chat Address
    abi: CHAT_ABI,
    functionName: 'sendMessage',
  });

  return {
    isReady: !!systemConfig,
    systemConfig,
    registerIdentity,
    sendOnChainMessage,
    // Add logic here to wrap transactions in ERC-4337 UserOps using the Paymaster
  };
}
