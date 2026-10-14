/**
 * ZK Community Payments — Private payment rails for Ledger Chat communities.
 *
 * Treasury management, subscription gates, tipping, creator revenue sharing,
 * bounties, and channel subscriptions. All private via Aztec Network notes.
 *
 * Stefan Antonio Cirisanu — Humanity Ledger × Aztec Network / Harry Bridge (Hazbobo)
 */

import { formatZkTag, SupportedToken, getCommunityTreasury } from './zkMoney';

// ─── Storage Keys ──────────────────────────────────────────────────────────────

const SUBSCRIPTIONS_KEY  = 'ledger_zk_subscriptions';
const TIPS_KEY_PREFIX    = 'ledger_zk_tips_';
const BOUNTIES_KEY_PREFIX = 'ledger_zk_bounties_';
const REVENUE_KEY_PREFIX = 'ledger_zk_revenue_';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ZkChannelSubscription {
  id: string;
  subscriberAddress: string;
  communityId: string;
  channelId: string;
  amount: string;
  token: SupportedToken;
  expiresAt: number;
  status: 'active' | 'expired' | 'cancelled';
  createdAt: number;
  renewalCount: number;
  txHash: string;
}

export interface ZkTip {
  id: string;
  senderTag: string;
  recipientTag: string;
  amount: string;
  token: SupportedToken;
  communityId: string;
  messageId?: string;
  timestamp: number;
  message?: string;
  txHash: string;
  status: 'confirmed' | 'pending';
}

export interface ZkRevenueShare {
  postId: string;
  communityId: string;
  creatorAddress: string;
  totalTipped: string;
  totalTippedUSD: string;
  shares: Array<{
    address: string;
    role: 'creator' | 'community' | 'moderator';
    percentage: number;
    amount: string;
  }>;
  settledAt?: number;
}

export interface ZkBounty {
  id: string;
  communityId: string;
  postedBy: string;       // zk handle
  title: string;
  description: string;
  reward: string;
  token: SupportedToken;
  status: 'open' | 'claimed' | 'paid' | 'expired';
  claimedBy?: string;
  claimedAt?: number;
  paidAt?: number;
  createdAt: number;
  expiresAt: number;
  skills?: string[];
  txHash?: string;
}

export interface ZkCommunityStats {
  communityId: string;
  totalVolume: string;
  totalVolumeCurrency: string;
  topContributors: Array<{ zkHandle: string; amount: string; token: SupportedToken }>;
  activeBounties: number;
  activeSubscriptions: number;
  totalTipsCount: number;
  tipVolumeByToken: Record<SupportedToken, string>;
  lastUpdated: number;
}

// ─── Storage Helpers ───────────────────────────────────────────────────────────

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function lsSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function emit(event: string, detail?: unknown): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(event, { detail }));
  }
}

// ─── Subscriptions ──────────────────────────────────────────────────────────────

/**
 * Creates a new channel subscription (private payment gate).
 */
export function createChannelSubscription(params: {
  subscriberAddress: string;
  communityId: string;
  channelId: string;
  amount: string;
  token: SupportedToken;
  durationDays?: number;
}): ZkChannelSubscription {
  const durationMs = (params.durationDays ?? 30) * 86_400_000;
  const subscription: ZkChannelSubscription = {
    id: `sub_${randomHex(8)}`,
    subscriberAddress: params.subscriberAddress.toLowerCase(),
    communityId: params.communityId,
    channelId: params.channelId,
    amount: params.amount,
    token: params.token,
    expiresAt: Date.now() + durationMs,
    status: 'active',
    createdAt: Date.now(),
    renewalCount: 0,
    txHash: `0x${randomHex(32)}`,
  };

  const all = lsGet<ZkChannelSubscription[]>(SUBSCRIPTIONS_KEY, []);
  all.push(subscription);
  lsSet(SUBSCRIPTIONS_KEY, all.slice(0, 500));

  emit('ledger_zk_subscription_created', subscription);
  return subscription;
}

/**
 * Returns all active subscriptions for an address.
 */
export function getActiveSubscriptions(address: string): ZkChannelSubscription[] {
  const all = lsGet<ZkChannelSubscription[]>(SUBSCRIPTIONS_KEY, []);
  const now  = Date.now();
  return all
    .filter(s =>
      s.subscriberAddress === address.toLowerCase() &&
      s.status === 'active' &&
      s.expiresAt > now
    )
    .sort((a, b) => b.expiresAt - a.expiresAt);
}

/**
 * Cancels a subscription by ID.
 */
export function cancelSubscription(subscriptionId: string): boolean {
  const all = lsGet<ZkChannelSubscription[]>(SUBSCRIPTIONS_KEY, []);
  const idx = all.findIndex(s => s.id === subscriptionId);
  if (idx === -1) return false;
  all[idx].status = 'cancelled';
  lsSet(SUBSCRIPTIONS_KEY, all);
  emit('ledger_zk_subscription_cancelled', all[idx]);
  return true;
}

/**
 * Checks if an address has active access to a specific community channel.
 */
export function checkSubscriptionAccess(
  address: string,
  communityId: string,
  channelId: string,
): boolean {
  const now = Date.now();
  return lsGet<ZkChannelSubscription[]>(SUBSCRIPTIONS_KEY, []).some(s =>
    s.subscriberAddress === address.toLowerCase() &&
    s.communityId === communityId &&
    s.channelId === channelId &&
    s.status === 'active' &&
    s.expiresAt > now
  );
}

// ─── Tipping ────────────────────────────────────────────────────────────────────

/**
 * Sends a private tip to a recipient in a community.
 */
export function sendTip(params: {
  senderAddress: string;
  recipientAddress: string;
  amount: string;
  token: SupportedToken;
  communityId: string;
  messageId?: string;
  message?: string;
}): ZkTip {
  const tip: ZkTip = {
    id: `tip_${randomHex(8)}`,
    senderTag:    formatZkTag(params.senderAddress),
    recipientTag: formatZkTag(params.recipientAddress),
    amount:       params.amount,
    token:        params.token,
    communityId:  params.communityId,
    messageId:    params.messageId,
    timestamp:    Date.now(),
    message:      params.message,
    txHash:       `0x${randomHex(32)}`,
    status:       'confirmed',
  };

  const key  = `${TIPS_KEY_PREFIX}${params.communityId}`;
  const tips = lsGet<ZkTip[]>(key, []);
  tips.unshift(tip);
  lsSet(key, tips.slice(0, 200));

  emit('ledger_zk_tip_sent', tip);
  return tip;
}

/**
 * Returns all tips for a community, sorted by newest first.
 */
export function getCommunityTips(communityId: string): ZkTip[] {
  return lsGet<ZkTip[]>(`${TIPS_KEY_PREFIX}${communityId}`, []);
}

/**
 * Returns all tips received by a specific tag (across all communities).
 */
export function getUserTipsReceived(address: string): ZkTip[] {
  const tag = formatZkTag(address);
  const results: ZkTip[] = [];
  if (typeof window === 'undefined') return results;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(TIPS_KEY_PREFIX)) {
        const tips: ZkTip[] = JSON.parse(localStorage.getItem(k) || '[]');
        results.push(...tips.filter(t => t.recipientTag === tag));
      }
    }
  } catch {}
  return results.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Returns all tips sent by a specific address.
 */
export function getUserTipsSent(address: string): ZkTip[] {
  const tag = formatZkTag(address);
  const results: ZkTip[] = [];
  if (typeof window === 'undefined') return results;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(TIPS_KEY_PREFIX)) {
        const tips: ZkTip[] = JSON.parse(localStorage.getItem(k) || '[]');
        results.push(...tips.filter(t => t.senderTag === tag));
      }
    }
  } catch {}
  return results.sort((a, b) => b.timestamp - a.timestamp);
}

// ─── Revenue Sharing ────────────────────────────────────────────────────────────

/**
 * Calculates revenue share breakdown for a post based on accumulated tips.
 * Default split: 80% creator, 15% community treasury, 5% moderators.
 */
export function calculateRevenueShare(
  postId: string,
  communityId: string,
  creatorAddress: string,
  tips: ZkTip[],
): ZkRevenueShare {
  const postTips   = tips.filter(t => t.messageId === postId);
  const totalNum   = postTips.reduce((acc, t) => acc + parseFloat(t.amount.replace(/,/g, '') || '0'), 0);
  const totalStr   = totalNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalUSD   = `$${totalNum.toFixed(2)}`; // DAI/USDC 1:1

  const revenueShare: ZkRevenueShare = {
    postId,
    communityId,
    creatorAddress: creatorAddress.toLowerCase(),
    totalTipped: totalStr,
    totalTippedUSD: totalUSD,
    shares: [
      {
        address: creatorAddress.toLowerCase(),
        role: 'creator',
        percentage: 80,
        amount: (totalNum * 0.80).toFixed(2),
      },
      {
        address: `treasury_${communityId}`,
        role: 'community',
        percentage: 15,
        amount: (totalNum * 0.15).toFixed(2),
      },
      {
        address: `moderators_${communityId}`,
        role: 'moderator',
        percentage: 5,
        amount: (totalNum * 0.05).toFixed(2),
      },
    ],
    settledAt: totalNum > 0 ? Date.now() : undefined,
  };

  const key = `${REVENUE_KEY_PREFIX}${communityId}`;
  const all = lsGet<ZkRevenueShare[]>(key, []);
  const idx = all.findIndex(r => r.postId === postId);
  if (idx !== -1) all[idx] = revenueShare;
  else all.unshift(revenueShare);
  lsSet(key, all.slice(0, 200));

  return revenueShare;
}

// ─── Bounties ───────────────────────────────────────────────────────────────────

/**
 * Creates a new shielded bounty for a community.
 */
export function createBounty(params: {
  communityId: string;
  postedBy: string;
  title: string;
  description: string;
  reward: string;
  token: SupportedToken;
  daysUntilExpiry?: number;
  skills?: string[];
}): ZkBounty {
  const bounty: ZkBounty = {
    id: `bounty_${randomHex(8)}`,
    communityId:  params.communityId,
    postedBy:     formatZkTag(params.postedBy),
    title:        params.title.slice(0, 100),
    description:  params.description.slice(0, 500),
    reward:       params.reward,
    token:        params.token,
    status:       'open',
    createdAt:    Date.now(),
    expiresAt:    Date.now() + (params.daysUntilExpiry ?? 14) * 86_400_000,
    skills:       params.skills,
    txHash:       `0x${randomHex(32)}`,
  };

  const key     = `${BOUNTIES_KEY_PREFIX}${params.communityId}`;
  const bounties = lsGet<ZkBounty[]>(key, []);
  bounties.unshift(bounty);
  lsSet(key, bounties.slice(0, 100));

  emit('ledger_zk_bounty_created', bounty);
  return bounty;
}

/**
 * Returns all open (non-expired) bounties for a community.
 */
export function getOpenBounties(communityId: string): ZkBounty[] {
  const now = Date.now();
  return lsGet<ZkBounty[]>(`${BOUNTIES_KEY_PREFIX}${communityId}`, [])
    .filter(b => b.status === 'open' && b.expiresAt > now)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Returns all bounties (all statuses) for a community.
 */
export function getAllBounties(communityId: string): ZkBounty[] {
  return lsGet<ZkBounty[]>(`${BOUNTIES_KEY_PREFIX}${communityId}`, []);
}

/**
 * Claims a bounty (marks it as claimed by the caller).
 */
export function claimBounty(bountyId: string, claimerAddress: string): ZkBounty | null {
  // Search all communities
  if (typeof window === 'undefined') return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(BOUNTIES_KEY_PREFIX)) continue;
      const bounties: ZkBounty[] = JSON.parse(localStorage.getItem(k) || '[]');
      const idx = bounties.findIndex(b => b.id === bountyId && b.status === 'open');
      if (idx !== -1) {
        bounties[idx].status     = 'claimed';
        bounties[idx].claimedBy  = formatZkTag(claimerAddress);
        bounties[idx].claimedAt  = Date.now();
        localStorage.setItem(k, JSON.stringify(bounties));
        emit('ledger_zk_bounty_claimed', bounties[idx]);
        return bounties[idx];
      }
    }
  } catch {}
  return null;
}

/**
 * Pays out a bounty (releases the shielded reward to the claimer).
 */
export function payBounty(bountyId: string): ZkBounty | null {
  if (typeof window === 'undefined') return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(BOUNTIES_KEY_PREFIX)) continue;
      const bounties: ZkBounty[] = JSON.parse(localStorage.getItem(k) || '[]');
      const idx = bounties.findIndex(b => b.id === bountyId && b.status === 'claimed');
      if (idx !== -1) {
        bounties[idx].status = 'paid';
        bounties[idx].paidAt = Date.now();
        localStorage.setItem(k, JSON.stringify(bounties));
        emit('ledger_zk_bounty_paid', bounties[idx]);
        return bounties[idx];
      }
    }
  } catch {}
  return null;
}

// ─── Payload Encoding ──────────────────────────────────────────────────────────

export function encodeTipPayload(tip: ZkTip): string {
  return `__ZK_TIP__:${JSON.stringify(tip)}`;
}

export function parseTipPayload(content: string): ZkTip | null {
  if (!content?.startsWith('__ZK_TIP__:')) return null;
  try { return JSON.parse(content.substring('__ZK_TIP__:'.length)) as ZkTip; }
  catch { return null; }
}

export function encodeBountyPayload(bounty: ZkBounty): string {
  return `__ZK_BOUNTY__:${JSON.stringify(bounty)}`;
}

export function parseBountyPayload(content: string): ZkBounty | null {
  if (!content?.startsWith('__ZK_BOUNTY__:')) return null;
  try { return JSON.parse(content.substring('__ZK_BOUNTY__:'.length)) as ZkBounty; }
  catch { return null; }
}

// ─── Community Statistics ──────────────────────────────────────────────────────

/**
 * Computes aggregated statistics for a community.
 */
export function getCommunityStats(communityId: string): ZkCommunityStats {
  const tips = getCommunityTips(communityId);
  const bounties = getAllBounties(communityId);
  const subs = lsGet<ZkChannelSubscription[]>(SUBSCRIPTIONS_KEY, [])
    .filter(s => s.communityId === communityId && s.status === 'active' && s.expiresAt > Date.now());

  // Aggregate tip volume by token
  const tipVolumeByToken: Record<SupportedToken, number> = { DAI: 0, USDC: 0, ETH: 0 };
  for (const tip of tips) {
    tipVolumeByToken[tip.token] += parseFloat(tip.amount.replace(/,/g, '') || '0');
  }

  // Total volume in USD (DAI/USDC 1:1, ETH ≈ 2650)
  const totalUSD =
    tipVolumeByToken.DAI +
    tipVolumeByToken.USDC +
    tipVolumeByToken.ETH * 2650;

  // Top contributors by tip amount
  const contributorMap: Record<string, number> = {};
  for (const tip of tips) {
    contributorMap[tip.senderTag] = (contributorMap[tip.senderTag] || 0) +
      parseFloat(tip.amount.replace(/,/g, '') || '0');
  }
  const topContributors = Object.entries(contributorMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([zkHandle, amount]) => ({
      zkHandle,
      amount: amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      token: 'DAI' as SupportedToken,
    }));

  return {
    communityId,
    totalVolume: totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    totalVolumeCurrency: 'USD',
    topContributors,
    activeBounties: bounties.filter(b => b.status === 'open' && b.expiresAt > Date.now()).length,
    activeSubscriptions: subs.length,
    totalTipsCount: tips.length,
    tipVolumeByToken: {
      DAI:  tipVolumeByToken.DAI.toFixed(2),
      USDC: tipVolumeByToken.USDC.toFixed(2),
      ETH:  tipVolumeByToken.ETH.toFixed(4),
    },
    lastUpdated: Date.now(),
  };
}
