import { NextRequest, NextResponse } from 'next/server';
import { runQuery } from '@/lib/neo4j';
import { ethers } from 'ethers';
import { prisma } from '@/lib/prisma';
import { RpcRelayerManager } from '@/lib/blockchain/rpc-relayer';

export const dynamic = 'force-dynamic';

const SAFE_PREFIXES = ['MATCH', 'OPTIONAL MATCH', 'CALL', 'RETURN', 'WITH', 'UNWIND'];

function isSafeQuery(cypher: string): boolean {
    const upper = cypher.trim().toUpperCase();
    const start = upper.split(/\s/)[0];
    return SAFE_PREFIXES.includes(start) && 
        !upper.includes('CREATE') &&
        !upper.includes('DELETE') &&
        !upper.includes('MERGE') &&
        !upper.includes('SET') &&
        !upper.includes('REMOVE') &&
        !upper.includes('DROP');
}

function serializeRecord(record: any) {
    const obj: Record<string, any> = {};
    for (const key of record.keys) {
        const val = record.get(key);
        if (val && typeof val === 'object' && val.properties) {
            obj[key] = { ...val.properties, _labels: val.labels || [], _type: val.type };
        } else if (val && typeof val.toNumber === 'function') {
            obj[key] = val.toNumber();
        } else {
            obj[key] = val;
        }
    }
    return obj;
}

//  ZERO-MOCK ON-CHAIN FALLBACK RESOLVER 
async function resolveOnChainEntity(q: string) {
    const rpcUrl = RpcRelayerManager.getRpcUrl('ETH', 'RPC') || 'https://cloudflare-eth.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const results: any[] = [];

    // 1. Check if query is an Ethereum address
    if (ethers.isAddress(q)) {
        try {
            const code = await provider.getCode(q);
            const isContract = code !== '0x';
            
            // Fetch balance
            const balanceWei = await provider.getBalance(q);
            const balanceEth = parseFloat(ethers.formatEther(balanceWei));

            results.push({
                node: {
                    address: q,
                    name: isContract ? 'Smart Contract' : 'EOA Wallet',
                    balance: balanceEth.toFixed(4) + ' ETH',
                    isContract,
                    _labels: isContract ? ['Contract', 'Wallet'] : ['Wallet']
                },
                label: isContract ? 'Contract' : 'Wallet'
            });
        } catch (e) {
            console.error('[Graph Fallback] Address resolution failed', e);
        }
    }

    // 2. Check if query is an ENS name
    if (q.endsWith('.eth')) {
        try {
            const address = await provider.resolveName(q);
            if (address) {
                const balanceWei = await provider.getBalance(address);
                results.push({
                    node: {
                        name: q,
                        address: address,
                        balance: parseFloat(ethers.formatEther(balanceWei)).toFixed(4) + ' ETH',
                        _labels: ['Wallet', 'ENS']
                    },
                    label: 'ENS Identity'
                });
            }
        } catch (e) {
            console.error('[Graph Fallback] ENS resolution failed', e);
        }
    }

    // 3. Fallback: Search Prisma database for Users / Topics matching the query
    try {
        const users = await (prisma as any).user.findMany({
            where: q.startsWith('0x') 
                ? { walletAddress: { contains: q, mode: 'insensitive' } }
                : {
                    OR: [
                        { displayName: { contains: q, mode: 'insensitive' } },
                        { walletAddress: { contains: q, mode: 'insensitive' } }
                    ]
                },
            take: 3
        });

        users.forEach((u: any) => {
            if (!results.find(r => r.node.address === u.walletAddress)) {
                results.push({
                    node: {
                        name: u.displayName || 'Unknown System',
                        address: u.walletAddress,
                        description: u.bio || 'Platform User',
                        _labels: ['Person', 'User']
                    },
                    label: 'Person'
                });
            }
        });
    } catch (e) {
        console.error('[Graph Fallback] Prisma resolution failed', e);
    }

    return results;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim();
    const type = searchParams.get('type') || 'all'; 
    
    if (!q || q.length < 2) {
        return NextResponse.json({ error: 'Query too short (min 2 chars)' }, { status: 400 });
    }

    try {
        const cypher = type === 'wallet'
            ? `MATCH (w:Wallet) WHERE toLower(w.address) CONTAINS toLower($q) RETURN w LIMIT 10`
            : type === 'token'
            ? `MATCH (t:Token) WHERE toLower(t.symbol) CONTAINS toLower($q) OR toLower(t.name) CONTAINS toLower($q) RETURN t LIMIT 10`
            : type === 'person'
            ? `MATCH (p:Person) WHERE toLower(p.name) CONTAINS toLower($q) OR toLower(p.slug) CONTAINS toLower($q) RETURN p LIMIT 10`
            : `
                CALL {
                    MATCH (n:Person) WHERE toLower(n.name) CONTAINS toLower($q) RETURN n AS node, 'Person' AS label LIMIT 5
                    UNION
                    MATCH (n:Token) WHERE toLower(n.symbol) CONTAINS toLower($q) RETURN n AS node, 'Token' AS label LIMIT 5
                    UNION
                    MATCH (n:Wallet) WHERE toLower(n.address) CONTAINS toLower($q) RETURN n AS node, 'Wallet' AS label LIMIT 5
                    UNION
                    MATCH (n:Company) WHERE toLower(n.name) CONTAINS toLower($q) RETURN n AS node, 'Company' AS label LIMIT 5
                }
                RETURN node, label
                LIMIT 20
            `;

        const result = await runQuery(cypher, { q });
        const records = result.records.map(serializeRecord);
        
        // If Neo4j works but returns empty, try the on-chain fallback to guarantee data
        if (records.length === 0) {
            const fallbackData = await resolveOnChainEntity(q);
            return NextResponse.json({ ok: true, count: fallbackData.length, data: fallbackData });
        }
        
        return NextResponse.json({ ok: true, count: records.length, data: records });

    } catch (e: any) {
        console.warn('[Graph] Neo4j query failed, triggering ZERO-MOCK Fallback:', e.message);
        const fallbackData = await resolveOnChainEntity(q);
        return NextResponse.json({ ok: true, data: fallbackData, count: fallbackData.length });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { cypher, params = {} } = body;

        if (!cypher || typeof cypher !== 'string') {
            return NextResponse.json({ error: 'cypher field required' }, { status: 400 });
        }

        if (!isSafeQuery(cypher)) {
            return NextResponse.json({ 
                error: 'Only read-only MATCH queries are allowed via this endpoint'
            }, { status: 403 });
        }

        const result = await runQuery(cypher, params);
        const records = result.records.map(serializeRecord);
        
        return NextResponse.json({ 
            ok: true, 
            count: records.length, 
            data: records
        });

    } catch (e: any) {
        console.warn('[Graph] Cypher execution failed:', e.message);
        return NextResponse.json({ ok: false, data: [], error: 'Internal Server Error', code: 'NEO4J_OFFLINE' }, { status: 200 });
    }
}
