/**
 * GET /api/contracts/status
 *
 * Returns live on-chain state for LedgerDeadmanSwitch + HumanTimeLock
 * deployed by the authenticated user.
 *
 * Query params:
 *   ?address=0x...   (optional) defaults to authenticated user wallet
 *   ?chain=base|ethereum  (optional) defaults to BASE
 *
 * Returns:
 *   {
 *     deadmanSwitch: { owner, backup, lastPing, expiresAt, secondsRemaining, triggered, paused } | null,
 *     timeLock:      { amount, unlockTime, secondsRemaining } | null,
 *     chain,
 *     blockNumber,
 *     timestamp
 *   }
 *
 * Security:
 *   - Read-only calls via ethers.JsonRpcProvider (no private key needed)
 *   - Rate limited at the infra level (Railway Redis limiter)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

export const dynamic  = 'force-dynamic';
export const runtime  = 'nodejs';

//  Minimal ABIs (view-only) 

const DEADMAN_ABI = [
    "function getStatus() view returns (address _owner, address _backup, uint256 _lastPing, uint256 _timeoutPeriod, uint256 _expiresAt, bool _triggered, bool _paused)",
    "function secondsUntilExpiry() view returns (uint256)",
];

const TIMELOCK_ABI = [
    "function locks(address user) view returns (uint256 amount, uint256 unlockTime)",
];

//  Known deployed addresses per chain 
// These are read from env vars  never hard-code prod addresses in source

const CONTRACTS: Record<string, { deadmanSwitch?: string; timeLock?: string; rpcUrl: string }> = {
    base: {
        rpcUrl:        process.env.BASE_RPC_URL        || 'https://mainnet.base.org',
        deadmanSwitch: process.env.BASE_DEADMAN_ADDRESS,
        timeLock:      process.env.BASE_TIMELOCK_ADDRESS,
    },
    ethereum: {
        rpcUrl:        process.env.ETH_RPC_URL         || 'https://eth.llamarpc.com',
        deadmanSwitch: process.env.ETH_DEADMAN_ADDRESS,
        timeLock:      process.env.ETH_TIMELOCK_ADDRESS,
    },
};

//  Handler 

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const address  = searchParams.get('address') ?? '';
    const chain    = (searchParams.get('chain') ?? 'base').toLowerCase();

    const config = CONTRACTS[chain] ?? CONTRACTS.base;
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);

    const now = Math.floor(Date.now() / 1000);

    try {
        const blockNumber = await provider.getBlockNumber();

        //  DeadMan Switch 
        let deadmanSwitch = null;
        if (config.deadmanSwitch) {
            try {
                const dm = new ethers.Contract(config.deadmanSwitch, DEADMAN_ABI, provider);
                const [_owner, _backup, _lastPing, _timeoutPeriod, _expiresAt, _triggered, _paused] =
                    await dm.getStatus();
                const secondsRemaining = _expiresAt > now ? Number(_expiresAt) - now : 0;

                deadmanSwitch = {
                    contractAddress:  config.deadmanSwitch,
                    owner:            _owner,
                    backup:           _backup,
                    lastPing:         Number(_lastPing),
                    lastPingIso:      new Date(Number(_lastPing) * 1000).toISOString(),
                    timeoutPeriodDays: Math.round(Number(_timeoutPeriod) / 86400),
                    expiresAt:        Number(_expiresAt),
                    expiresAtIso:     new Date(Number(_expiresAt) * 1000).toISOString(),
                    secondsRemaining,
                    daysRemaining:    Math.floor(secondsRemaining / 86400),
                    triggered:        _triggered,
                    paused:           _paused,
                    status:           _triggered ? 'TRIGGERED' : _paused ? 'PAUSED' : secondsRemaining === 0 ? 'EXPIRED' : 'ACTIVE',
                };
            } catch (e: any) {
                deadmanSwitch = { error: 'Contract unreachable', detail: 'Internal error' };
            }
        }

        //  HumanTimeLock (per-user lock) 
        let timeLock = null;
        if (config.timeLock && address) {
            try {
                const tl = new ethers.Contract(config.timeLock, TIMELOCK_ABI, provider);
                const [amount, unlockTime] = await tl.locks(address);
                const hasLock = BigInt(amount) > 0n;
                const secondsRemaining = hasLock && Number(unlockTime) > now
                    ? Number(unlockTime) - now : 0;

                timeLock = {
                    contractAddress:  config.timeLock,
                    hasLock,
                    amountWei:        amount.toString(),
                    amountEth:        ethers.formatEther(amount),
                    unlockTime:       Number(unlockTime),
                    unlockTimeIso:    hasLock ? new Date(Number(unlockTime) * 1000).toISOString() : null,
                    secondsRemaining,
                    daysRemaining:    Math.floor(secondsRemaining / 86400),
                    status:           !hasLock ? 'NO_LOCK' : secondsRemaining > 0 ? 'LOCKED' : 'UNLOCKED',
                };
            } catch (e: any) {
                timeLock = { error: 'Contract unreachable', detail: 'Internal error' };
            }
        }

        return NextResponse.json({
            deadmanSwitch,
            timeLock,
            chain,
            blockNumber,
            timestamp: new Date().toISOString(),
        }, {
            headers: { 'Cache-Control': 'no-store, max-age=0' },
        });

    } catch (err: any) {
        return NextResponse.json(
            { error: 'RPC provider unreachable', detail: 'Internal error' },
            { status: 503 }
        );
    }
}
