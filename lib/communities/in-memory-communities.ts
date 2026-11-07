// lib/communities/in-memory-communities.ts
// Resilient in-memory communities registry for standalone / zero-DB production

import crypto from 'crypto';

export interface InMemoryChannel {
  id: string;
  communityId: string;
  name: string;
  description: string;
  isPaid: boolean;
  price?: number | null;
  currency?: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface InMemoryMember {
  communityId: string;
  walletAddress: string;
  role: 'ADMIN' | 'MODERATOR' | 'MEMBER';
  joinedAt: string;
}

export interface InMemoryCommunity {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  ownerAddress: string;
  joinCode: string;
  slug: string;
  membersCount: number;
  channelsCount: number;
  channels: InMemoryChannel[];
  members: InMemoryMember[];
  createdAt: string;
  updatedAt: string;
}

// Module-level persistent registry
const globalCommunities: InMemoryCommunity[] = [
  {
    id: 'comm_default_general',
    name: 'Humanity Ledger Global',
    description: 'The global sovereign community for all Humanity Ledger participants.',
    isPrivate: false,
    ownerAddress: '0x0000000000000000000000000000000000000000',
    joinCode: 'HL-GLOBAL',
    slug: 'HL-GLOBAL',
    membersCount: 4280,
    channelsCount: 2,
    channels: [
      {
        id: 'chan_global_0',
        communityId: 'comm_default_general',
        name: 'general',
        description: 'General discussion',
        isPaid: false,
        position: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'chan_global_1',
        communityId: 'comm_default_general',
        name: 'announcements',
        description: 'Network-wide announcements',
        isPaid: false,
        position: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    members: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function createInMemoryCommunity(data: {
  name: string;
  description: string;
  isPrivate: boolean;
  ownerAddress: string;
}): InMemoryCommunity {
  const id = `comm_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const joinCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  const ownerLower = data.ownerAddress.toLowerCase();

  const channels: InMemoryChannel[] = [
    {
      id: `chan_${Date.now()}_0`,
      communityId: id,
      name: 'general',
      description: 'General discussion',
      isPaid: false,
      position: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: `chan_${Date.now()}_1`,
      communityId: id,
      name: 'announcements',
      description: 'Server announcements',
      isPaid: false,
      position: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const members: InMemoryMember[] = [
    {
      communityId: id,
      walletAddress: ownerLower,
      role: 'ADMIN',
      joinedAt: new Date().toISOString(),
    },
  ];

  const comm: InMemoryCommunity = {
    id,
    name: data.name.trim(),
    description: (data.description || '').trim(),
    isPrivate: data.isPrivate,
    ownerAddress: ownerLower,
    joinCode,
    slug: joinCode,
    membersCount: 1,
    channelsCount: 2,
    channels,
    members,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  globalCommunities.unshift(comm);
  return comm;
}

export function listInMemoryCommunities(options: {
  walletAddress?: string;
  isDiscover?: boolean;
  search?: string;
}): InMemoryCommunity[] {
  const { walletAddress, isDiscover, search } = options;
  const userLower = (walletAddress || '').toLowerCase();

  return globalCommunities.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (isDiscover) {
      return !c.isPrivate;
    }
    if (userLower) {
      return c.ownerAddress === userLower || c.members.some((m) => m.walletAddress === userLower);
    }
    return !c.isPrivate;
  });
}

export function getInMemoryCommunityBySlugOrId(idOrSlug: string): InMemoryCommunity | null {
  const target = idOrSlug.toLowerCase();
  return (
    globalCommunities.find(
      (c) => c.id.toLowerCase() === target || c.slug.toLowerCase() === target || c.joinCode.toLowerCase() === target
    ) || null
  );
}

export function joinInMemoryCommunity(
  communityIdOrSlug: string,
  walletAddress: string,
  role: 'MEMBER' | 'ADMIN' = 'MEMBER'
): boolean {
  const comm = getInMemoryCommunityBySlugOrId(communityIdOrSlug);
  if (!comm) return false;
  const userLower = walletAddress.toLowerCase();
  if (!comm.members.some((m) => m.walletAddress === userLower)) {
    comm.members.push({
      communityId: comm.id,
      walletAddress: userLower,
      role,
      joinedAt: new Date().toISOString(),
    });
    comm.membersCount = comm.members.length;
  }
  return true;
}
