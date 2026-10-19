"use client";

/**
 * useDeadmanSwitch  Full on-chain hook for SystemDeadmanSwitch.
 *
 * Reads live state directly from Polygon via wagmi/viem public client.
 * Writes (ping, proposeBackup, confirmBackup, setToimeout, pause, trigger)
 * are sent as real wallet transactions  no simulation, no mocks.
 */

import { useCallback, useEffect, useState }       from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { getContract, parseUnits, type Address }  from "viem";
import { polygon, polygonAmoy }                    from "viem/chains";

//  CONTRACT CONFIG 
// These are populated by the deployment script via lib/blockchain/abi/*.json.
// Swap the address once you go to mainnet.

let deploymentData: { address: string; abi: any[] } | null = null;
try {
  deploymentData = require("@/lib/blockchain/abi/SystemDeadmanSwitch.json");
} catch {
  /* Not yet deployed */
}

export const DEADMAN_CONTRACT_ADDRESS = (
  deploymentData?.address ?? process.env.NEXT_PUBLIC_DEADMAN_CONTRACT_ADDRESS ?? ""
) as Address;

export const DEADMAN_ABI = deploymentData?.abi ?? [
  // Minimal inline ABI for pre-deployment dev  full ABI replaces this after deploy
  { name: "ping",              type: "function", stateMutability: "nonpayable", inputs: [],                     outputs: [] },
  { name: "proposeBackupWallet", type: "function", stateMutability: "nonpayable", inputs: [{ name: "newBackup", type: "address" }], outputs: [] },
  { name: "confirmBackupWallet", type: "function", stateMutability: "nonpayable", inputs: [],                  outputs: [] },
  { name: "setTimeout",        type: "function", stateMutability: "nonpayable", inputs: [{ name: "newTimeoutDays", type: "uint256" }], outputs: [] },
  { name: "pause",             type: "function", stateMutability: "nonpayable", inputs: [],                     outputs: [] },
  { name: "unpause",           type: "function", stateMutability: "nonpayable", inputs: [],                     outputs: [] },
  { name: "triggerInheritance", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "erc20Tokens",     type: "address[]" },
      { name: "erc721Contracts", type: "address[]" },
      { name: "erc721TokenIds",  type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    name: "getStatus", type: "function", stateMutability: "view", inputs: [],
    outputs: [
      { name: "_owner",         type: "address" },
      { name: "_backup",        type: "address" },
      { name: "_lastPing",      type: "uint256" },
      { name: "_timeoutPeriod", type: "uint256" },
      { name: "_expiresAt",     type: "uint256" },
      { name: "_triggered",     type: "bool"    },
      { name: "_paused",        type: "bool"    },
    ],
  },
  { name: "secondsUntilExpiry", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "pendingBackupWallet", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "pendingBackupTime",   type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  // Events
  { name: "Ping",                 type: "event", inputs: [{ name: "owner", type: "address", indexed: true }, { name: "timestamp", type: "uint256" }] },
  { name: "InheritanceTriggered", type: "event", inputs: [{ name: "owner", type: "address", indexed: true }, { name: "backupWallet", type: "address", indexed: true }, { name: "timestamp", type: "uint256" }] },
  { name: "BackupWalletProposed", type: "event", inputs: [{ name: "proposed", type: "address", indexed: true }, { name: "effectiveAt", type: "uint256" }] },
];

//  TYPES 

export interface DeadmanStatus {
  owner:         Address;
  backup:        Address;
  lastPing:      bigint;      // unix seconds
  timeoutPeriod: bigint;      // seconds
  expiresAt:     bigint;      // unix seconds
  triggered:     boolean;
  paused:        boolean;
  secondsLeft:   bigint;
  pendingBackup: Address;
  pendingBackupTime: bigint;
  // derived
  daysLeft:      number;
  percentLeft:   number;      // 0100 for the progress arc
  isExpired:     boolean;
  isDangerous:   boolean;     // < 10 days left
}

export interface DeadmanHookReturn {
  status:          DeadmanStatus | null;
  isLoading:       boolean;
  error:           string | null;
  contractAddress: Address;
  refetch:         () => Promise<void>;

  // Write actions  all return the tx hash on success
  sendPing:               () => Promise<string>;
  proposeBackup:          (newBackup: Address) => Promise<string>;
  confirmBackup:          () => Promise<string>;
  updateTimeout:          (days: number) => Promise<string>;
  pauseContract:          () => Promise<string>;
  unpauseContract:        () => Promise<string>;
  triggerInheritance:     (erc20s: Address[], erc721s: Address[], tokenIds: bigint[]) => Promise<string>;
}

//  HOOK 

export function useDeadmanSwitch(): DeadmanHookReturn {
  const { address, chain }     = useAccount();
  const publicClient           = usePublicClient({ chainId: polygonAmoy.id });
  const { data: walletClient } = useWalletClient({ chainId: polygonAmoy.id });

  const [status,    setStatus]    = useState<DeadmanStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const contractAddress = DEADMAN_CONTRACT_ADDRESS;

  //  READ 

  const fetchStatus = useCallback(async () => {
    if (!publicClient || !contractAddress) { setIsLoading(false); return; }

    try {
      setIsLoading(true);
      setError(null);

      const contract = getContract({ address: contractAddress, abi: DEADMAN_ABI, client: publicClient });

      const [rawStatus, secondsLeft, pendingBackup, pendingBackupTime] = await Promise.all([
        contract.read.getStatus([])             as unknown as Promise<any>,
        contract.read.secondsUntilExpiry([])    as unknown as Promise<bigint>,
        contract.read.pendingBackupWallet([])   as unknown as Promise<Address>,
        contract.read.pendingBackupTime([])     as unknown as Promise<bigint>,
      ]);

      const [ownerAddr, backupAddr, lastPing, timeoutPeriod, expiresAt, triggered, paused] = rawStatus;

      const daysLeft    = Number(secondsLeft) / 86_400;
      const isExpired   = secondsLeft === 0n;
      const percentLeft = timeoutPeriod > 0n
        ? Math.max(0, Math.min(100, Math.round((Number(secondsLeft) / Number(timeoutPeriod)) * 100)))
        : 0;

      setStatus({
        owner: ownerAddr,
        backup: backupAddr,
        lastPing,
        timeoutPeriod,
        expiresAt,
        triggered,
        paused,
        secondsLeft,
        pendingBackup,
        pendingBackupTime,
        daysLeft,
        percentLeft,
        isExpired,
        isDangerous: daysLeft < 10 && !isExpired,
      });
    } catch (e: any) {
      setError(e?.message ?? "Contract read failed");
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, contractAddress]);

  // Poll every 30 s
  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 30_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  //  WRITE HELPERS 

  const writeContract = useCallback(async (
    functionName: string,
    args: readonly unknown[] = []
  ): Promise<string> => {
    if (!walletClient)      throw new Error("Wallet not connected");
    if (!address)           throw new Error("No account found");
    if (!contractAddress)   throw new Error("Contract not deployed yet. Run the deployment script first.");

    const hash = await walletClient.writeContract({
      address: contractAddress,
      abi: DEADMAN_ABI,
      functionName,
      args,
      chain: polygonAmoy,
      account: address,
    });

    // Wait for confirmation then refresh state
    if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
    await fetchStatus();

    return hash;
  }, [walletClient, address, contractAddress, publicClient, fetchStatus]);

  //  PUBLIC WRITE API 

  const sendPing            = () => writeContract("ping");
  const proposeBackup       = (b: Address) => writeContract("proposeBackupWallet", [b]);
  const confirmBackup       = () => writeContract("confirmBackupWallet");
  const updateTimeout       = (d: number) => writeContract("setTimeout", [BigInt(d)]);
  const pauseContract       = () => writeContract("pause");
  const unpauseContract     = () => writeContract("unpause");
  const triggerInheritance  = (erc20s: Address[], erc721s: Address[], tokenIds: bigint[]) =>
    writeContract("triggerInheritance", [erc20s, erc721s, tokenIds]);

  return {
    status,
    isLoading,
    error,
    contractAddress,
    refetch:            fetchStatus,
    sendPing,
    proposeBackup,
    confirmBackup,
    updateTimeout,
    pauseContract,
    unpauseContract,
    triggerInheritance,
  };
}
