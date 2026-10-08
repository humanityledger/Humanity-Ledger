import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DOMAINS = [
    'capital.xyz', 'ventures.eth', 'grid.fund', 'global.institution',
    'alpha.org', 'system.io', 'blackbox.fi', 'core.attestations',
    'genesis.block', 'omega.capital'
];

const JOB_TITLES = [
    'Senior MEV Arbitrageur', 'Head of ZK-Rollup Research', 'Principal Smart Contract Auditor',
    'Quantitative DeFi Analyst', 'Director of On-Chain Liquidity', 'Chief Cryptographer',
    'Algorithmic Attesting Lead', 'EVM Architecture Specialist', 'Tokenomics Engineer',
    'Sovereign Portfolio Manager'
];

const TOPIC_TEMPLATES = [
    {
        title: "Mandate: {Action} {Target} via {Method}",
        content: `### Executive Briefing
We are currently seeking to {Action} {Target} within the upcoming quarter. 
Our primary strategy involves {Method}, targeting high-yield opportunities while maintaining strict risk-adjusted parameters.

### Technical Requirements
- Execution layer: {Chain}
- Minimum liquidity: {Amount}M USD equivalent
- Maximum slippage tolerance: 0.{Slippage}%
- Security audit requirement: Tier-1 Firms Only (e.g. Trail of Bits, OpenZeppelin)

### Cryptographic Proof of intent
The associated capital has been time-locked in a 2-of-3 multisig structure. Interested counterparties must verify their reputation on-chain before initiating DMs.

Please submit cryptographic proposals below.
[SECURE_DOC:Mandate_Brief_v{Version}.pdf|ipfs://Qm{Hash}]`
    },
    {
        title: "Analytics Alert: Anomalous {Metric} detected on {Chain}",
        content: `### Phenomenon Observation
Our automated heuristic engines have flagged significant anomalies regarding {Metric} across the {Chain} ecosystem over the last 48 hours.

### Analysis & Trajectory
1. Capital flows indicate a systemic rotation from primary layers to {Target}.
2. Dark pool activity suggests accumulation by 3 major system wallets.
3. Network congestion metrics correlate with these hidden spikes.

### Sovereign Strategy
We are deploying a {Method} approach to front-run this transition. We invite other tier-1 researchers to cross-verify our findings.

[SIGNATURE:0x{Signature}]`
    },
    {
        title: "Request for Proposal (RFP): {Target} Infrastructure",
        content: `### Context
As part of our Q4 expansion into {Chain}, we are issuing this RFP to construct a proprietary {Target}. 

### Key Objectives
- Must support {Method} natively.
- Latency threshold strictly sub-50ms.
- Full compatibility with existing ZK-proof verification circuits.

### Budget & Terms
Initial allocation is structured as a milestone-based tranches. Total capital committed exceeds 500 ETH.

Respondents must reply with a signed architectural overview.`
    }
];

const ACTIONS = ['Acquire', 'Liquidate', 'Audit', 'Deploy', 'Hedge'];
const TARGETS = ['Zero Knowledge Provers', 'L2 Sequencer Nodes', 'Dark Pool Liquidity', 'Algorithmic Stablecoin Yields', 'Cross-chain Bridges'];
const METHODS = ['flash-loan arbitrage', 'stat-arb neural models', 'multisig governance execution', 'optimistic rollups', 'MPC threshold signatures'];
const CHAINS = ['Ethereum Mainnet', 'Solana', 'Arbitrum One', 'Base', 'Optimism'];
const METRICS = ['Gas consumption', 'Mempool latency', 'TVL migration', 'MEV extraction rates', 'Smart contract deployments'];

function generateRandomString(length: number, chars: string = 'abcdef0123456789') {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function getRandomItem(arr: any[]) {
    return arr[Math.floor(Math.random() * arr.length)];
}

export async function GET() {
    try {
        console.log('️ Initiating System Database Grid...');
        
        const results: Record<string, number> = {
            categories: 0, users: 0, topics: 0, posts: 0,
        };

        // Delete existing records to prevent foreign key violations and reset cleanly
        await prisma.forumNotification.deleteMany({});
        await prisma.forumLike.deleteMany({});
        await prisma.forumPost.deleteMany({});
        await prisma.forumTopic.deleteMany({});
        await prisma.forumCategory.deleteMany({});

        // 1. Create 5 Sovereign Categories
        const categoriesData = [
            { slug: 'sovereign-grid', name: 'Sovereign Grid', description: 'Core strategic discussions and macroeconomic allocation.', color: '#4F46E5', orderIndex: 1 },
            { slug: 'live-feed', name: 'Active Feed', description: 'Real-time analytics and network anomalies.', color: '#10B981', orderIndex: 2 },
            { slug: 'recent-profiles', name: 'Recent Profiles', description: 'New verified entities and sovereign nodes.', color: '#F59E0B', orderIndex: 3 },
            { slug: 'pending-review', name: 'Pending Review', description: 'Proposals, audits, and smart contract verification queues.', color: '#EF4444', orderIndex: 4 },
            { slug: 'highest-yield', name: 'Highest Yield', description: 'Algorithmic stablecoins, DeFi yields, and delta-neutral strategies.', color: '#8B5CF6', orderIndex: 5 }
        ];

        const categories = [];
        for (const data of categoriesData) {
            categories.push(await prisma.forumCategory.create({ data }));
            results.categories++;
        }

        const personasToCreate = 65;
        const generatedUsers = [];

        for (let i = 0; i < personasToCreate; i++) {
            const walletAddress = '0x' + generateRandomString(40);
            const namePart1 = getRandomItem(['Alpha', 'Core', 'Apex', 'Zenith', 'Cipher', 'Nexus', 'Vertex']);
            const namePart2 = getRandomItem(['Capital', 'Ventures', 'Labs', 'Research', 'Holdings', 'Systems']);
            const domain = getRandomItem(DOMAINS);
            
            const displayName = `${namePart1} ${namePart2} | ${getRandomItem(JOB_TITLES)}`;
            
            const user = await prisma.user.create({
                data: {
                    walletAddress,
                    displayName: displayName,
                    bio: `Managing tier-1 liquidity on EVM. Sovereign grade execution. [Verified via ${domain}]`,
                    isPro: Math.random() > 0.5,
                    tier: Math.random() > 0.8 ? 'Private' : 'PRO',
                }
            });
            generatedUsers.push(user);
            results.users++;

            if (Math.random() > 0.5) {
                const template = getRandomItem(TOPIC_TEMPLATES);
                const title = template.title
                    .replace('{Action}', getRandomItem(ACTIONS))
                    .replace('{Target}', getRandomItem(TARGETS))
                    .replace('{Method}', getRandomItem(METHODS))
                    .replace('{Metric}', getRandomItem(METRICS))
                    .replace('{Chain}', getRandomItem(CHAINS));

                const content = template.content
                    .replace('{Action}', getRandomItem(ACTIONS))
                    .replace('{Target}', getRandomItem(TARGETS))
                    .replace('{Method}', getRandomItem(METHODS))
                    .replace('{Metric}', getRandomItem(METRICS))
                    .replace('{Chain}', getRandomItem(CHAINS))
                    .replace('{Amount}', `${Math.floor(Math.random() * 10) + 1}`)
                    .replace('{Slippage}', `${Math.floor(Math.random() * 5) + 1}`)
                    .replace('{Version}', `${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 9)}`)
                    .replace('{Hash}', generateRandomString(44, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'))
                    .replace('{Signature}', generateRandomString(130));

                const randomCategory = getRandomItem(categories);

                const topic = await prisma.forumTopic.create({
                    data: {
                        title: title,
                        content: content,
                        categoryId: randomCategory.id,
                        authorId: user.id,
                        views: Math.floor(Math.random() * 5000),
                    }
                });
                results.topics++;

                const replyCount = Math.floor(Math.random() * 3) + 1;
                for (let j = 0; j < replyCount; j++) {
                    if (generatedUsers.length > 1) {
                        const responder = getRandomItem(generatedUsers);
                        if (responder.id !== user.id) {
                            const replyContents = [
                                `Cryptographic signature verified. We have 250M USD ready to deploy in parallel. Please check your secure channels.`,
                                `We strongly advise auditing the ${getRandomItem(CHAINS)} bridge architecture before executing this strategy. We noticed potential MEV leakage vectors last week.`,
                                `Our heuristic models align perfectly with your briefing. Constructing a ZK-proof for our proposal now.`,
                                `Can you confirm the slippage tolerance? We can guarantee 0.1% execution via our private mempool infrastructure.`,
                                `Sovereign mandate acknowledged. Our firm will pass on this tranche but will monitor the on-chain results.`
                            ];
                            
                            await prisma.forumPost.create({
                                data: {
                                    content: getRandomItem(replyContents) + `\n\n[SIGNATURE:0x${generateRandomString(130)}]`,
                                    topicId: topic.id,
                                    authorId: responder.id
                                }
                            });
                            results.posts++;
                        }
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Forum seeded with 65 Sovereign Personas and 5 Strategic Sectors successfully.',
            results,
        });

    } catch (e: any) {
        console.error('[Seed Forum]', e);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
