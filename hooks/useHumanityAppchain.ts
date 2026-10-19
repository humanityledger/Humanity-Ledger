import { useReadContract, useWriteContract, useAccount } from 'wagmi';
import { parseAbi } from 'viem';

/**
 * CORE ABI for the Humanity Appchain
 * This connects the Next.js UI directly to the newly created Ethereum L2 Contracts
 * bypassing the old PostgreSQL Prisma database completely.
 */
const CORE_ABI = parseAbi([
  // Phase 1 + 3 + 4 Omni-Signature
  'function getSystemConfiguration() view returns (address, address, address, address, address, address, address, address, address, address)',
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

const ACADEMY_ABI = parseAbi([
  'function submitLesson(bytes32 _courseId, bytes32 _lessonId, string _ipfsProof) external',
]);

const VAULT_ABI = parseAbi([
  'function pingHeartbeat() external',
]);

// This address will be set once the core is deployed to the Humanity Appchain (L2)
const CORE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CORE_CONTRACT as `0x${string}`;

/**
 * Hook to interact with the Humanity Full On-Chain Ecosystem
 */
export function useHumanityAppchain() {
  const { address, isConnected } = useAccount();

  // 1. Fetch all App Addresses
  const { data: systemConfig } = useReadContract({
    address: CORE_CONTRACT_ADDRESS,
    abi: CORE_ABI,
    functionName: 'getSystemConfiguration',
  });

  const { writeContractAsync } = useWriteContract();

  // 2. Identity Registration
  const registerIdentity = async (args: any) => {
    const registryAddr = (systemConfig as any)?.[0];
    if (!registryAddr) return;
    return writeContractAsync({
      address: registryAddr as `0x${string}`,
      abi: IDENTITY_ABI,
      functionName: 'registerIdentity',
      args,
    });
  };

  // 3. Decentralized Chat
  const sendOnChainMessage = async (args: any) => {
    const chatAddr = (systemConfig as any)?.[2];
    if (!chatAddr) return;
    return writeContractAsync({
      address: chatAddr as `0x${string}`,
      abi: CHAT_ABI,
      functionName: 'sendMessage',
      args,
    });
  };

  // 4. Academy Submissions
  const submitLesson = async (args: any) => {
    const academyAddr = (systemConfig as any)?.[6];
    if (!academyAddr) return;
    return writeContractAsync({
      address: academyAddr as `0x${string}`,
      abi: ACADEMY_ABI,
      functionName: 'submitLesson',
      args,
    });
  };

  // 5. Vault Heartbeat
  const pingVaultHeartbeat = async () => {
    const vaultAddr = (systemConfig as any)?.[7];
    if (!vaultAddr) return;
    return writeContractAsync({
      address: vaultAddr as `0x${string}`,
      abi: VAULT_ABI,
      functionName: 'pingHeartbeat',
    });
  };

  return {
    isReady: !!systemConfig || !CORE_CONTRACT_ADDRESS,
    systemConfig,
    registerIdentity,
    sendOnChainMessage,
    submitLesson,
    pingVaultHeartbeat
  };
}
