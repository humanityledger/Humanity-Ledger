/**
 * J-026: Synthetic Test Data Factories
 * Generates synthetic test fixtures without depending on production data.
 */
import crypto from 'crypto';

export interface SyntheticUser {
  id: string;
  walletAddress: string;
  email: string;
  displayName: string;
  createdAt: Date;
}

export function buildSyntheticUser(overrides: Partial<SyntheticUser> = {}): SyntheticUser {
  const randomHex = crypto.randomBytes(20).toString('hex');
  const walletAddress = `0x${randomHex}`.toLowerCase();

  return {
    id: `usr_${crypto.randomUUID()}`,
    walletAddress,
    email: `test_${randomHex.slice(0, 8)}@humanity.test`,
    displayName: `Sovereign Human ${randomHex.slice(0, 4)}`,
    createdAt: new Date(),
    ...overrides,
  };
}

export interface SyntheticCommunity {
  id: string;
  slug: string;
  name: string;
  isPrivate: boolean;
  ownerAddress: string;
}

export function buildSyntheticCommunity(overrides: Partial<SyntheticCommunity> = {}): SyntheticCommunity {
  const id = `comm_${crypto.randomUUID()}`;
  return {
    id,
    slug: `community-${id.slice(5, 12)}`,
    name: 'Decentralized Research Guild',
    isPrivate: false,
    ownerAddress: buildSyntheticUser().walletAddress,
    ...overrides,
  };
}
