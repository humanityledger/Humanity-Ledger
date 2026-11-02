/**
 * AEGIS QUANTUM TYPE DEFINITIONS
 * Strict typing across the entire 33-Phase architecture.
 */

export type AegisAddress = `0x${string}`;

export interface IAegisUser {
  address: AegisAddress;
  identity: {
    displayName: string;
    avatarUrl: string | null;
    ensName: string | null;
    isVerifiedHuman: boolean; // ZK Proof status
  };
  linkedWallets: AegisAddress[];
}

export interface IQuantumMessage {
  id: string;
  conversationId: string;
  sender: AegisAddress;
  payload: string; // Encrypted Zod-validated payload
  timestampNs: number;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'SHREDDED';
  metadata: {
    isBurner: boolean;
    ttlSeconds?: number;
    hasZkProof: boolean;
  };
}

export interface ISyndicateVault {
  id: string;
  safeAddress: AegisAddress;
  owners: AegisAddress[];
  threshold: number;
  balances: Record<string, string>; // Token Address -> Balance
}