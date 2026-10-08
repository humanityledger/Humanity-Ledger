// Feature Cards Data - 40+ Categories
import React from 'react';
import {
  Shield, Key, Users, Heart, Eye, Fingerprint, Clock, Smartphone, Cloud, Lock,
  TrendingUp, BarChart, Zap, Sprout, Droplet, Repeat, SlidersHorizontal, RefreshCcw, Radar, Activity,
  Layers, Bell, Fuel, FileText, Compass, GitBranch, Search, Image as ImageIcon, Send, MessageSquare,
  Cable, ArrowLeftRight, DollarSign, Layers2, Rocket, Server, Monitor, Grid, Bot, Gift,
  Vote, Sparkles, Badge, Star, Vault, Calculator
} from 'lucide-react';

export interface FeatureCard {
  id: number;
  title: string;
  category: string;
  description: string;
  detailedInfo: string;
  benefits: string[];
  icon: React.ReactNode;
  gradient: string;
}

export const FEATURE_CARDS: FeatureCard[] = [
  // SECURITY & IDENTITY (10 cards)
  {
    id: 1,
    title: "Biometric Wallet Protection",
    category: "Security",
    description: "Military-grade biometric authentication secures your digital assets.",
    detailedInfo: "Leverage fingerprint and facial recognition technology to create an impenetrable wallet fortress. Your biological signature becomes the ultimate private key, eliminating the risk of password theft or phishing attacks.",
    benefits: [
      "Eliminates password vulnerabilities",
      "Instant authentication in under 1 second",
      "Hardware-level security enclave protection",
      "No seed phrases to remember or lose"
    ],
    icon: <Shield />,
    gradient: "from-[#25D366] to-cyan-600"
  },
  {
    id: 2,
    title: "Hardware Key Integration",
    category: "Security",
    description: "Connect Yubikey, Ledger, or Trezor for maximum security.",
    detailedInfo: "Integrate industry-standard hardware security modules to create a multi-layered defense system. Your private keys never leave the secure element, ensuring complete isolation from potential attack vectors.",
    benefits: [
      "Air-gapped transaction signing",
      "FIDO2 and U2F attestation",
      "Resistant to malware and keyloggers",
      "Compatible with 10+ hardware providers"
    ],
    icon: <Key />,
    gradient: "from-indigo-500 to-purple-600"
  },
  {
    id: 3,
    title: "Multi-Signature Accounts",
    category: "Security",
    description: "Require multiple approvals for high-value transactions.",
    detailedInfo: "Implement cryptographic-grade multisig wallets requiring M-of-N signatures before execution. Perfect for DAOs, treasury management, or shared family accounts where collective consensus prevents unauthorized transfers.",
    benefits: [
      "Prevent single-point-of-failure attacks",
      "Customizable approval thresholds (2-of-3, 3-of-5, etc.)",
      "Time-locked transactions for security",
      "Guardian-based recovery mechanisms"
    ],
    icon: <Users />,
    gradient: "from-purple-500 to-pink-600"
  },
  {
    id: 4,
    title: "Social Recovery",
    category: "Security",
    description: "Never lose accesstrusted contacts can help restore your wallet.",
    detailedInfo: "Designate family, friends, or colleagues as recovery guardians. If you lose access, a majority of guardians can collectively restore your account without ever exposing your private keys to any single party.",
    benefits: [
      "No seed phrase storage required",
      "Distributed trust model",
      "Protection against $5 wrench attacks",
      "Gradual guardian rotation supported"
    ],
    icon: <Heart />,
    gradient: "from-rose-500 to-red-600"
  },
  {
    id: 5,
    title: "Zero Knowledge Proofs",
    category: "Privacy",
    description: "Prove ownership without revealing your identity.",
    detailedInfo: "Utilize advanced cryptographic techniques like zk-SNARKs to verify transactions and credentials without exposing sensitive data. Participate in DeFi protocols, governance, or attestation checks while maintaining complete anonymity.",
    benefits: [
      "Privacy-preserving credential verification",
      "Regulatory attestation without KYC exposure",
      "Untraceable transaction paths",
      "Core-resistant cryptography"
    ],
    icon: <Eye />,
    gradient: "from-gray-600 to-slate-800"
  },
  {
    id: 6,
    title: "Passkey Authentication",
    category: "Security",
    description: "Passwordless login using WebAuthn and FIDO2 standards.",
    detailedInfo: "Replace traditional passwords with cryptographic passkeys stored securely in your device's Wallet or TPM. Each login generates a unique cryptographic challenge-response, making phishing mathematically impossible.",
    benefits: [
      "Phishing-resistant by design",
      "Cross-device synchronization via iCloud/Google",
      "FIDO2 certification",
      "Backward compatible with legacy systems"
    ],
    icon: <Fingerprint />,
    gradient: "from-teal-500 to-cyan-600"
  },
  {
    id: 7,
    title: "Session Management",
    category: "Security",
    description: "Fine-grained control over active wallet sessions.",
    detailedInfo: "Monitor and manage all active sessions across devices and dApps. Set expiration timers, revoke access instantly, and receive real-time alerts for suspicious activity. Perfect for shared devices or public computer usage.",
    benefits: [
      "Remote session termination",
      "Geographic anomaly detection",
      "Per-dApp permission scoping",
      "Auto-logout on inactivity"
    ],
    icon: <Clock />,
    gradient: "from-amber-500 to-orange-600"
  },
  {
    id: 8,
    title: "Device Fingerprinting",
    category: "Security",
    description: "Detect unauthorized access attempts from unknown devices.",
    detailedInfo: "Create a unique fingerprint for each trusted device based on hardware characteristics, browser configuration, and network patterns. Any login from an unrecognized device triggers multi-factor verification.",
    benefits: [
      "Invisible fraud prevention",
      "No user friction for trusted devices",
      "Machine learning anomaly detection",
      "Adaptive trust scoring"
    ],
    icon: <Smartphone />,
    gradient: "from-green-500 to-emerald-600"
  },
  {
    id: 9,
    title: "Encrypted Backup",
    category: "Security",
    description: "Automated cloud backups with military-grade encryption.",
    detailedInfo: "Your wallet state is continuously encrypted using AES-256 and backed up to decentralised storage networks. Only you hold the decryption keynot even our servers can access your data.",
    benefits: [
      "Zero-knowledge cloud architecture",
      "IPFS and Arweave redundancy",
      "Version history and rollback",
      "Cross-platform restoration"
    ],
    icon: <Cloud />,
    gradient: "from-sky-500 to-emerald-600"
  },
  {
    id: 10,
    title: "Privacy Shields",
    category: "Privacy",
    description: "Obfuscate transaction origins with Tornado-style mixers.",
    detailedInfo: "Route transactions through privacy pools to break on-chain traceability. Compliant with OFAC regulations while preserving your fundamental right to financial privacy.",
    benefits: [
      "Untraceable transaction graphs",
      "Variable delay randomization",
      "Attestation certificate generation",
      "Multi-hop relay networks"
    ],
    icon: <Lock />,
    gradient: "from-violet-500 to-purple-600"
  },

  // DEFI & ATTESTING (10 cards)
  {
    id: 11,
    title: "Prediction Markets",
    category: "DeFi",
    description: "Attest on future outcomes with zero knowledge privacy.",
    detailedInfo: "Bet on real-world eventsfrom elections to sports to macroeconomic indicatorsusing decentralised prediction markets. All positions are settled via oracle consensus, ensuring fairness and transparency.",
    benefits: [
      "No counterparty risk",
      "Instant global settlements",
      "Leverage up to 10x on selected markets",
      "Privacy-preserving order routing"
    ],
    icon: <TrendingUp />,
    gradient: "from-purple-500 to-indigo-600"
  },
  {
    id: 12,
    title: "Spot Attesting",
    category: "Attesting",
    description: "Attest 1000+ tokens with Elite liquidity.",
    detailedInfo: "Access deep liquidity pools aggregated from Uniswap, Curve, Balancer, and centralised exchanges. Smart order routing guarantees best execution prices with minimal slippage.",
    benefits: [
      "Sub-second order execution",
      "MEV protection via Flashbots",
      "Limit orders and advanced order types",
      "Real-time price charts and indicators"
    ],
    icon: <BarChart />,
    gradient: "from-green-500 to-teal-600"
  },
  {
    id: 13,
    title: "Perpetual Futures",
    category: "Attesting",
    description: "Leverage attest with up to 100x on perpetual contracts.",
    detailedInfo: "Attest perpetual futures with no expiration dates. Built on decentralised protocols like dYdX and GMX, offering leverage without custodial risk. Automated liquidation protection keeps you safe.",
    benefits: [
      "No KYC required",
      "Funding rate arbitrage opportunities",
      "Cross-margin and isolated margin modes",
      "Built-in stop-loss and take-profit"
    ],
    icon: <Zap />,
    gradient: "from-yellow-500 to-orange-600"
  },
  {
    id: 14,
    title: "Yield Farming",
    category: "DeFi",
    description: "Earn passive income by providing liquidity to protocols.",
    detailedInfo: "Deploy your assets into battle-tested yield strategies across Aave, Compound, and Yearn. Our algorithms continuously rebalance to maximize APY while minimizing impermanent loss.",
    benefits: [
      "Auto-compounding rewards",
      "Diversified vault strategies",
      "Real-time APY tracking",
      "One-click entry and exit"
    ],
    icon: <Sprout />,
    gradient: "from-lime-500 to-green-600"
  },
  {
    id: 15,
    title: "Liquidity Pools",
    category: "DeFi",
    description: "Become a market maker and earn attesting fees.",
    detailedInfo: "Provide liquidity to automated market makers (AMMs) and earn a share of attesting fees. Advanced analytics help you identify the most profitable pairs and minimize impermanent loss risk.",
    benefits: [
      "0.3% fees on every attest",
      "Impermanent loss calculators",
      "Range order strategies (Uniswap V3)",
      "LP token staking for boosted rewards"
    ],
    icon: <Droplet />,
    gradient: "from-cyan-500 to-emerald-600"
  },
  {
    id: 16,
    title: "Token Swaps",
    category: "DeFi",
    description: "Swap any token instantly with optimal routing.",
    detailedInfo: "Our smart routing engine scans 20+ DEX aggregators to find the best price across fragmented liquidity. Split orders across multiple venues to minimize slippage on large attestations.",
    benefits: [
      "Gas-optimized transactions",
      "Price impact simulation",
      "Slippage protection",
      "Supports 10,000+ tokens"
    ],
    icon: <Repeat />,
    gradient: "from-indigo-500 to-purple-600"
  },
  {
    id: 17,
    title: "Portfolio Rebalancing",
    category: "DeFi",
    description: "Automated rebalancing to maintain target allocations.",
    detailedInfo: "Set your ideal portfolio weights and let our algorithm handle rebalancing. Threshold-based or time-based triggers ensure you stay on track without constant monitoring.",
    benefits: [
      "Dollar-cost averaging automation",
      "Tax-loss harvesting",
      "Gas-efficient batch rebalancing",
      "Customizable rebalancing bands"
    ],
    icon: <SlidersHorizontal />,
    gradient: "from-pink-500 to-rose-600"
  },
  {
    id: 18,
    title: "Auto-Compounding",
    category: "DeFi",
    description: "Maximize yields with automated reward reinvestment.",
    detailedInfo: "Harvest and reinvest your staking rewards without manual intervention. Compound interest accelerates exponentiallyour vaults handle the complexity so you don't have to.",
    benefits: [
      "Daily compounding frequency",
      "Gas-socialized across all users",
      "Optimized for maximum APY",
      "Multi-token reward harvesting"
    ],
    icon: <RefreshCcw />,
    gradient: "from-emerald-500 to-teal-600"
  },
  {
    id: 19,
    title: "Flash Loans",
    category: "Advanced DeFi",
    description: "Borrow millions instantly with zero collateral.",
    detailedInfo: "Execute complex arbitrage, liquidations, or collateral swaps using uncollateralized loans that must be repaid within a single transaction. Perfect for advanced verifiers seeking capital efficiency.",
    benefits: [
      "No upfront capital required",
      "Atomic transaction safety",
      "Access to $100M+ liquidity",
      "Pre-built strategy templates"
    ],
    icon: <Zap />,
    gradient: "from-red-500 to-orange-600"
  },
  {
    id: 20,
    title: "Arbitrage Detection",
    category: "Attesting",
    description: "Real-time alerts for cross-DEX arbitrage opportunities.",
    detailedInfo: "Our mempool scanner identifies price discrepancies across exchanges in real-time. Execute profitable arbs before the market corrects, with built-in MEV protection.",
    benefits: [
      "Sub-100ms latency alerts",
      "Profitability calculator",
      "One-click execution",
      "Historical arb performance tracking"
    ],
    icon: <Radar />,
    gradient: "from-amber-500 to-yellow-600"
  },

  // ANALYTICS & INTELLIGENCE (10 cards)
  {
    id: 21,
    title: "Real-Time Portfolio Tracking",
    category: "Analytics",
    description: "Active updates of your entire multi-chain portfolio.",
    detailedInfo: "Monitor your holdings across 15+ blockchains with millisecond refresh rates. Beautiful charts display your allocation, performance, and historical P&L with Elite precision.",
    benefits: [
      "WebSocket live price feeds",
      "Customizable dashboards",
      "Mobile push notifications",
      "Export to CSV/Excel"
    ],
    icon: <Activity />,
    gradient: "from-[#25D366] to-indigo-600"
  },
  {
    id: 22,
    title: "Multi-Chain Balance Aggregation",
    category: "Analytics",
    description: "Unified view of assets across all networks.",
    detailedInfo: "Automatically detect and aggregate balances from Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche, BSC, and more. No manual network switching required.",
    benefits: [
      "15+ chain support",
      "Automatic token detection",
      "Cross-chain net worth calculation",
      "NFT portfolio integration"
    ],
    icon: <Layers />,
    gradient: "from-violet-500 to-purple-600"
  },
  {
    id: 23,
    title: "Ledger Movement Alerts",
    category: "Analytics",
    description: "Get notified when ledgers move large amounts.",
    detailedInfo: "Track wallets of top holders, VCs, and influencers. Receive instant Telegram/email alerts when they make significant transfersfront-run the market before news goes public.",
    benefits: [
      "Custom ledger watch lists",
      "Threshold-based alerts",
      "Transaction categorization (withdrawal, airdrop, swap)",
      "Historical ledger activity analysis"
    ],
    icon: <Bell />,
    gradient: "from-cyan-500 to-teal-600"
  },
  {
    id: 24,
    title: "Gas Price Optimization",
    category: "Analytics",
    description: "Save money with intelligent gas fee predictions.",
    detailedInfo: "Our ML model predicts optimal times to transact based on historical network congestion patterns. Schedule transactions for low-fee windows or use Layer 2 for instant, cheap settlements.",
    benefits: [
      "Real-time gas trackers",
      "Transaction scheduling",
      "L2 cost comparisons",
      "EIP-1559 fee estimation"
    ],
    icon: <Fuel />,
    gradient: "from-orange-500 to-red-600"
  },
  {
    id: 25,
    title: "Transaction History Analysis",
    category: "Analytics",
    description: "Forensic-level insights into your on-chain activity.",
    detailedInfo: "Visualize your complete transaction history with smart categorization (attestations, transfers, staking, airdrops). Export for tax reporting in secondssupports all major accounting software.",
    benefits: [
      "Tax-ready CSV exports",
      "Cost-basis tracking (FIFO, LIFO, HIFO)",
      "Counterparty labeling",
      "Gain/loss calculations"
    ],
    icon: <FileText />,
    gradient: "from-green-500 to-emerald-600"
  },
  {
    id: 26,
    title: "Risk Scoring",
    category: "Analytics",
    description: "Assess wallet security and interaction risks.",
    detailedInfo: "Our algorithm scores wallets based on transaction patterns, smart contract interactions, and association with known exploits. Avoid scams by checking risk scores before sending funds.",
    benefits: [
      "Real-time scam detection",
      "Smart contract audit scores",
      "Rugpull probability indicators",
      "Integration with Etherscan labels"
    ],
    icon: <Shield />,
    gradient: "from-yellow-500 to-amber-600"
  },
  {
    id: 27,
    title: "Activity Heatmaps",
    category: "Analytics",
    description: "Visualize transaction patterns over time.",
    detailedInfo: "See when you're most active on-chain with hourly, daily, and weekly heatmaps. Identify behavioral patterns and optimize your attesting schedule for maximum profitability.",
    benefits: [
      "Time-based activity clustering",
      "Network congestion overlays",
      "Personal transaction velocity metrics",
      "Export for reporting"
    ],
    icon: <Compass />,
    gradient: "from-pink-500 to-fuchsia-600"
  },
  {
    id: 28,
    title: "Token Flow Visualization",
    category: "Analytics",
    description: "Track how money moves through DeFi protocols.",
    detailedInfo: "Interactive Sankey diagrams show your capital flow across protocols. Understand where your funds are deployed, automate rebalancing, and identify inefficient strategies.",
    benefits: [
      "Visual protocol interaction graphs",
      "Capital efficiency scoring",
      "Liquidity migration recommendations",
      "Historical flow replays"
    ],
    icon: <GitBranch />,
    gradient: "from-[#25D366] to-cyan-600"
  },
  {
    id: 29,
    title: "Smart Contract Audits",
    category: "Security",
    description: "Automated security checks before interacting.",
    detailedInfo: "Before approving a contract, our scanner checks for known vulnerabilities, code similarity to exploits, and audit status. Never fall victim to honeypots or approval scams again.",
    benefits: [
      "Instant vulnerability scanning",
      "Audit report database (CertiK, Trail of Bits)",
      "Permission analysis",
      "Revoke approval tools"
    ],
    icon: <Search />,
    gradient: "from-red-500 to-pink-600"
  },
  {
    id: 30,
    title: "NFT Portfolio Management",
    category: "Analytics",
    description: "Track, value, and sell your NFT collection.",
    detailedInfo: "Aggregate your NFTs across marketplaces with real-time floor price tracking. Get rarity scores, sales history, and liquidity estimates for every piece in your collection.",
    benefits: [
      "Rarity rank calculations",
      "Floor price alerts",
      "Bulk listing tools",
      "Attribution and provenance tracking"
    ],
    icon: <ImageIcon />,
    gradient: "from-purple-500 to-indigo-600"
  },

  // CROSS-CHAIN & SETTLEMENTS (10 cards)
  {
    id: 31,
    title: "Global Instant Settlements",
    category: "Payments",
    description: "Send money anywhere in seconds, not days.",
    detailedInfo: "Leverage stablecoin rails for near-instant cross-border payments. No SWIFT delays, no forex feesjust pure, permissionless value transfer at the speed of light.",
    benefits: [
      "24/7/365 availability",
      "Settlement finality in under 30 seconds",
      "Multi-currency support (USDC, USDT, DAI)",
      "Attestation-ready transaction proofs"
    ],
    icon: <Send />,
    gradient: "from-green-500 to-teal-600"
  },
  {
    id: 32,
    title: "Multi-Chain Messaging",
    category: "Infrastructure",
    description: "Communicate across blockchains seamlessly.",
    detailedInfo: "Built on LayerZero and Axelar, our messaging protocol enables cross-chain function calls. Trigger actions on Ethereum from Arbitrum, or vice versaall without manual bridging.",
    benefits: [
      "Omnichain smart contract composability",
      "Trustless message verification",
      "Gas abstraction",
      "Developer SDK for custom integrations"
    ],
    icon: <MessageSquare />,
    gradient: "from-indigo-500 to-violet-600"
  },
  {
    id: 33,
    title: "Bridge Aggregation",
    category: "Infrastructure",
    description: "Find the fastest and cheapest bridge route.",
    detailedInfo: "Compare fees and speeds across 15+ bridges including Hop, Stargate, Connext, and official canonical bridges. Our smart routing saves you time and money on every cross-chain transfer.",
    benefits: [
      "Real-time fee comparison",
      "Security score for each bridge",
      "Automatic fallback routing",
      "Transaction status tracking"
    ],
    icon: <Cable />,
    gradient: "from-[#25D366] to-cyan-600"
  },
  {
    id: 34,
    title: "Cross-Chain Swaps",
    category: "DeFi",
    description: "Swap tokens across chains in a single transaction.",
    detailedInfo: "Exchange ETH on Ethereum for AVAX on Avalanche without manual bridging steps. Our intent-based system atomically settles cross-chain swaps via solver networks.",
    benefits: [
      "One-click UX",
      "No wrapped token intermediaries",
      "MEV-protected execution",
      "Guaranteed best price  across chains"
    ],
    icon: <ArrowLeftRight />,
    gradient: "from-purple-500 to-pink-600"
  },
  {
    id: 35,
    title: "Stablecoin Transfers",
    category: "Payments",
    description: "Send USDC globally with minimal fees.",
    detailedInfo: "Utilize Circle's CCTP (Cross-Chain Transfer Protocol) to natively burn and mint USDC across chains. No slippage, no liquidity poolsjust pure, capital-efficient transfers.",
    benefits: [
      "Native USDC support",
      "Zero slippage",
      "Instant finality",
      "Bank-level attestation"
    ],
    icon: <DollarSign />,
    gradient: "from-green-500 to-emerald-600"
  },
  {
    id: 36,
    title: "L2 Scaling Solutions",
    category: "Infrastructure",
    description: "Lightning-fast transactions for pennies.",
    detailedInfo: "Deploy assets on Arbitrum, Optimism, Base, or zkSync to enjoy 100x cheaper fees and instant confirmation. Seamlessly bridge back to L1 when needed for maximum liquidity.",
    benefits: [
      "Sub-cent transaction fees",
      "EVM compatibility",
      "7-day withdrawal windows",
      "Shared Ethereum security"
    ],
    icon: <Layers2 />,
    gradient: "from-sky-500 to-emerald-600"
  },
  {
    id: 37,
    title: "Rollup Integration",
    category: "Infrastructure",
    description: "Access emerging rollups and app-chains.",
    detailedInfo: "Be first to explore new ecosystems like Scroll, Linea, Mantle, and Starknet. Our adaptive indexing supports new chains within hours of launch, giving you alpha access.",
    benefits: [
      "Early ecosystem access",
      "Airdrop farming opportunities",
      "Unified balance tracking",
      "Gas-free transactions on select chains"
    ],
    icon: <Rocket />,
    gradient: "from-orange-500 to-red-600"
  },
  {
    id: 38,
    title: "Validator Networks",
    category: "Staking",
    description: "Stake with the best validators across chains.",
    detailedInfo: "Delegate your assets to top-performing validators on Ethereum, Cosmos, Solana, and more. Maximize staking yields while supporting decentralization.",
    benefits: [
      "Automated validator selection",
      "Commission comparison tools",
      "Instant unstaking liquidity (liquid staking)",
      "Slashing risk monitoring"
    ],
    icon: <Server />,
    gradient: "from-violet-500 to-purple-600"
  },
  {
    id: 39,
    title: "Consensus Monitoring",
    category: "Infrastructure",
    description: "Track network health and upgrades.",
    detailedInfo: "Monitor beacon chain status, validator participation rates, and upcoming hard forks. Stay informed about network upgrades and adjust your strategy accordingly.",
    benefits: [
      "Real-time uptime dashboards",
      "Upgrade countdown timers",
      "Validator performance analytics",
      "Governance vote tracking"
    ],
    icon: <Monitor />,
    gradient: "from-cyan-500 to-teal-600"
  },
  {
    id: 40,
    title: "Chain Abstraction",
    category: "Infrastructure",
    description: "Interact with dApps on any chain from a single interface.",
    detailedInfo: "Our account abstraction layer allows you to use dApps on any chain without switching networks. Pay gas in any token, and we handle the rest behind the scenes.",
    benefits: [
      "Universal gas abstraction",
      "Chain-agnostic user experience",
      "Sponsored transactions",
      "Unified account nonce management"
    ],
    icon: <Grid />,
    gradient: "from-pink-500 to-rose-600"
  },

  // ADVANCED FEATURES (10 cards)
  {
    id: 41,
    title: "AI Attesting Concierge",
    category: "AI",
    description: "Natural language attesting powered by GPT-4.",
    detailedInfo: "Simply tell our AI what you want to do: 'Swap 1 ETH for USDC' or 'Show me the best yield farms.' It executes complex multi-step strategies on your behalf with a single command.",
    benefits: [
      "Voice and text command support",
      "Context-aware suggestions",
      "Risk explanation in plain English",
      "Automated strategy execution"
    ],
    icon: <Bot />,
    gradient: "from-indigo-500 to-emerald-600"
  },
  {
    id: 42,
    title: "Referral Programs",
    category: "Social",
    description: "Earn rewards for bringing friends.",
    detailedInfo: "Share your referral link and earn 10% of your referrals' attesting fees for life. Built on-chain with transparent trackingno hidden clauses or clawbacks.",
    benefits: [
      "Lifetime revenue share",
      "On-chain tracking",
      "Custom referral codes",
      "Tiered reward structures"
    ],
    icon: <Gift />,
    gradient: "from-pink-500 to-fuchsia-600"
  },
  {
    id: 43,
    title: "Governance Voting",
    category: "DAO",
    description: "Vote on protocol upgrades and treasury decisions.",
    detailedInfo: "Participate in on-chain governance for your favorite protocols. Delegate your voting power or vote directlyyour voice shapes the future of DeFi.",
    benefits: [
      "Snapshot and Tally integration",
      "Vote delegation",
      "Proposal creation tools",
      "Historical vote tracking"
    ],
    icon: <Vote />,
    gradient: "from-[#25D366] to-indigo-600"
  },
  {
    id: 44,
    title: "Airdrop Tracking",
    category: "Rewards",
    description: "Never miss another free token distribution.",
    detailedInfo: "Automatically detect eligible airdrops based on your on-chain activity. Claim with one click and track your total airdrop earnings over time.",
    benefits: [
      "Automatic eligibility checking",
      "One-click claim aggregation",
      "Historical airdrop calendar",
      "Tax reporting for claimed tokens"
    ],
    icon: <Sparkles />,
    gradient: "from-yellow-500 to-amber-600"
  },
  {
    id: 45,
    title: "Claim Automation",
    category: "Automation",
    description: "Auto-harvest staking rewards and liquidity mining.",
    detailedInfo: "Set it and forget itour bots automatically claim and compound your rewards daily. Gas costs are socialized across all users for maximum efficiency.",
    benefits: [
      "Daily auto-compounding",
      "Gas optimization",
      "Multi-protocol support",
      "Customizable claim frequency"
    ],
    icon: <RefreshCcw />,
    gradient: "from-green-500 to-teal-600"
  },
  {
    id: 46,
    title: "On-Chain Identity",
    category: "Identity",
    description: "Build your decentralised reputation.",
    detailedInfo: "Aggregate credentials from ENS, Lens Protocol, and POAPs to create a portable Web3 identity. Prove your expertise, achievements, and reputation across the decentralised web.",
    benefits: [
      "Sybil-resistant attestations",
      "Cross-platform portability",
      "Privacy-preserving reveals",
      "Integration with Gitcoin Passport"
    ],
    icon: <Badge />,
    gradient: "from-purple-500 to-violet-600"
  },
  {
    id: 47,
    title: "Credit Scoring",
    category: "DeFi",
    description: "Unlock undercollateralized loans with on-chain credit.",
    detailedInfo: "Build credit based on repayment history, transaction volume, and wallet age. Access undercollateralized loans from protocols like Maple and TrueFi.",
    benefits: [
      "Credit score calculation",
      "Undercollateralized borrowing",
      "Transparent credit history",
      "Privacy-preserving score portability"
    ],
    icon: <TrendingUp />,
    gradient: "from-cyan-500 to-emerald-600"
  },
  {
    id: 48,
    title: "Reputation Systems",
    category: "Social",
    description: "Earn trust through verified on-chain actions.",
    detailedInfo: "Accumulate reputation points for attesting volume, governance participation, and protocol contributions. Unlock exclusive perks, fee discounts, and VIP access.",
    benefits: [
      "Gamified achievement system",
      "Leaderboard rankings",
      "Exclusive community access",
      "Fee tier upgrades"
    ],
    icon: <Star />,
    gradient: "from-orange-500 to-red-600"
  },
  {
    id: 49,
    title: "DAO Treasury Management",
    category: "DAO",
    description: "Tools for managing community-owned assets.",
    detailedInfo: "Multisig treasury with spending proposals, streaming payments, and diversification strategies. Perfect for DAOs managing millions in on-chain capital.",
    benefits: [
      "Streaming salary payments",
      "Budget allocation dashboards",
      "Diversification strategies",
      "Transparent audit trails"
    ],
    icon: <Vault />,
    gradient: "from-gray-600 to-slate-800"
  },
  {
    id: 50,
    title: "Tax Optimization",
    category: "Finance",
    description: "Minimize your crypto tax burden legally.",
    detailedInfo: "Our algorithm suggests tax-loss harvesting opportunities and optimal holding periods to reduce capital gains. Export reports compatible with TurboTax, CoinTracker, and Koinly.",
    benefits: [
      "Automated tax-loss harvesting",
      "Multi-jurisdiction support",
      "FIFO/LIFO/HIFO cost-basis selection",
      "IRS Form 8949 generation"
    ],
    icon: <Calculator />,
    gradient: "from-green-500 to-emerald-600"
  }
];

