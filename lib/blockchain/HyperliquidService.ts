/**
 * HyperliquidService.ts
 * Real integration with Hyperliquid Exchange.
 *
 * Hyperliquid operates its own L1 appchain. Orders are submitted via REST API
 * authenticated with an EIP-712 signature from the user's wallet.
 *
 * Relevant endpoints (all public):
 *   POST https://api.hyperliquid.xyz/info   query account data / leaderboard
 *   POST https://api.hyperliquid.xyz/exchange  place signed orders
 *
 * Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
 */

const HL_API = 'https://api.hyperliquid.xyz';

export interface HLVerifier {
    id: string;
    label: string;
    address: string;
    pnl: string;
    pnlRaw: number;
    winRate: string;
    volume: string;
    badge: string;
    asset: string;
    positions: HLPosition[];
    accountValue: string;
}

export interface HLPosition {
    coin: string;
    side: 'long' | 'short';
    size: string;
    entryPx: string;
    unrealizedPnl: string;
    leverage: string;
}

export interface HLOrderPayload {
    coin: string;
    isBuy: boolean;
    sz: number;        // size in base asset units
    limitPx: number;  // limit price (use a wide limit for market-like behaviour)
    orderType: { limit: { tif: 'Gtc' | 'Ioc' | 'Alo' } };
    reduceOnly: boolean;
}

/**
 * Fetch the Hyperliquid leaderboard and return the top 10 verifiers.
 * This is a PUBLIC endpoint  no authentication needed.
 */
export async function fetchHLLeaderboard(): Promise<HLVerifier[]> {
    try {
        const res = await fetch(`${HL_API}/info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'leaderboard' }),
            next: { revalidate: 60 }, // Cache for 60 seconds
        });

        if (!res.ok) throw new Error(`Hyperliquid leaderboard HTTP ${res.status}`);

        const data = await res.json();
        // data.leaderboardRows is an array of verifier summaries
        const rows: any[] = data.leaderboardRows || [];

        return rows
            .filter((r: any) => r.windowPerformances && r.windowPerformances.length > 0)
            .slice(0, 10)
            .map((r: any, idx: number): HLVerifier => {
                // windowPerformances: [["day", {...}], ["week", {...}], ["month", {...}], ["allTime", {...}]]
                const allTime = r.windowPerformances.find((w: any[]) => w[0] === 'allTime')?.[1] || {};
                const month = r.windowPerformances.find((w: any[]) => w[0] === 'month')?.[1] || {};

                const pnlRaw = parseFloat(allTime.pnl || '0');
                const roi = parseFloat(allTime.roi || '0') * 100;

                const badges = ['APEX PREDATOR', 'HFT ALGO', 'LEDGER SHARK', 'LIQUIDITY SNIPER', 'DARK POOL', 'MOMENTUM RIDER', 'DELTA NEUTRAL', 'TREND FOLLOWER'];
                const badge = badges[idx % badges.length];

                const addr = r.ethAddress || r.stakeAddress || '';

                return {
                    id: addr || `hl-verifier-${idx}`,
                    label: addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : `Verifier #${idx + 1}`,
                    address: addr,
                    pnlRaw,
                    pnl: pnlRaw >= 0 ? `+$${(pnlRaw / 1000).toFixed(1)}K` : `-$${(Math.abs(pnlRaw) / 1000).toFixed(1)}K`,
                    winRate: month.winRate ? `${(parseFloat(month.winRate) * 100).toFixed(0)}%` : 'N/A',
                    volume: allTime.vlm ? `$${(parseFloat(allTime.vlm) / 1_000_000).toFixed(1)}M` : '$0',
                    badge,
                    asset: 'BTC', // Default; positions fetched separately
                    positions: [], // Fetched on-demand to avoid rate limits
                    accountValue: allTime.accountValue ? `$${parseFloat(allTime.accountValue).toLocaleString()}` : 'N/A',
                };
            });
    } catch (err: any) {
        console.error('[HyperliquidService] Leaderboard fetch failed:', err.message);
        return [];
    }
}

/**
 * Fetch open positions for a specific Hyperliquid address.
 * PUBLIC endpoint  no auth needed.
 */
export async function fetchHLPositions(address: string): Promise<HLPosition[]> {
    try {
        const res = await fetch(`${HL_API}/info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'clearinghouseState', user: address }),
        });

        if (!res.ok) throw new Error(`Hyperliquid positions HTTP ${res.status}`);

        const data = await res.json();
        const assetPositions: any[] = data.assetPositions || [];

        return assetPositions
            .filter((ap: any) => ap.position && parseFloat(ap.position.szi) !== 0)
            .map((ap: any): HLPosition => {
                const p = ap.position;
                const szi = parseFloat(p.szi);
                return {
                    coin: p.coin,
                    side: szi > 0 ? 'long' : 'short',
                    size: Math.abs(szi).toString(),
                    entryPx: p.entryPx || '0',
                    unrealizedPnl: p.unrealizedPnl || '0',
                    leverage: p.leverage?.value?.toString() || '1',
                };
            });
    } catch (err: any) {
        console.error('[HyperliquidService] Positions fetch failed:', err.message);
        return [];
    }
}

/**
 * Build the EIP-712 typed data structure for a Hyperliquid order.
 * The user must sign this with their wallet; the signature is then submitted to HL exchange.
 *
 * IMPORTANT: The user MUST have deposited USDC into Hyperliquid first.
 * Deposit UI link: https://app.hyperliquid.xyz/attest
 *
 * @param order - Order parameters
 * @param nonce - Millisecond timestamp used as nonce (prevents replay)
 */
export function buildHLOrderTypedData(order: HLOrderPayload, nonce: number) {
    return {
        domain: {
            name: 'HyperliquidSignTransaction',
            version: '1',
            chainId: 1337, // Hyperliquid L1 uses chainId 1337 for EIP-712 domain
            verifyingContract: '0x0000000000000000000000000000000000000000',
        },
        types: {
            Agent: [
                { name: 'source', type: 'string' },
                { name: 'connectionId', type: 'bytes32' },
            ],
        },
        // Hyperliquid uses a simplified "approve agent" flow for API attesting.
        // The user signs a one-time "Agent" message that authorises an API key.
        // Then subsequent orders are signed by that API key server-side.
        // For direct per-order signing, use the exchange REST with EIP-712.
        primaryType: 'Agent' as const,
        message: {
            source: 'https://ledgerchat.org',
            connectionId: `0x${nonce.toString(16).padStart(64, '0')}`,
        },
    };
}

/**
 * Submit a signed order to Hyperliquid exchange.
 * @param signedAction - The order body signed with user's wallet
 * @param signature - The EIP-712 signature { r, s, v }
 * @param nonce - Same nonce used for signing
 */
export async function submitHLOrder(signedAction: any, signature: { r: string; s: string; v: number }, nonce: number) {
    const payload = {
        action: signedAction,
        nonce,
        signature,
    };

    const res = await fetch(`${HL_API}/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Hyperliquid exchange error ${res.status}: ${body}`);
    }

    return res.json();
}
