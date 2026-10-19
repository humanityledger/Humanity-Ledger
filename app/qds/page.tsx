"use client";

import React, { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────
type Section = {
  num: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  diagram?: string[];
  tag?: string;
};

// ─── Stats Bar ────────────────────────────────────────────────────────────────
const STATS = [
  { label: 'Total Supply',      value: '210,000,000', sub: 'Hard cap — immutable by protocol' },
  { label: 'Decimals',          value: '8',            sub: 'Native Aztec precision' },
  { label: 'Distribution',      value: '100% earned',  sub: 'No pre-mine, no team allocation' },
  { label: 'Network',           value: 'Aztec v6',     sub: 'Testnet active now' },
  { label: 'Privacy Model',     value: 'ZK by default',sub: 'Noir circuits, Barretenberg proofs' },
  { label: 'Governance',        value: 'On-chain',     sub: 'Cryptographic community vote' },
];

// ─── Content Sections ─────────────────────────────────────────────────────────
const SECTIONS: Section[] = [
  {
    num: '01',
    title: 'What are QDs — Quantum Dots?',
    tag: 'Foundation',
    paragraphs: [
      'QDs (Quantum Dots) are the native digital asset of the Humanity Ledger. They are not an ERC-20 token on Ethereum mainnet. They are not a wrapped asset. They live and move exclusively inside the Aztec Network — a Zero Knowledge Layer 2 rollup — making every balance and every transfer private by cryptographic default.',
      'The name "Quantum Dots" comes from physics: the smallest indivisible unit of verifiable quantum energy output. Inside the protocol, QDs represent the smallest indivisible unit of verifiable economic contribution. You cannot fake them, you cannot mint extra ones, and you cannot subdivide them below 8 decimal places.',
      'The supply is mathematically hard-capped at exactly 210,000,000 units. This number is an immutable constant encoded in the genesis state of the contract. No governance vote, no team decision, no regulatory pressure, and no technical upgrade can ever change it. The protocol enforces this not by trust but by arithmetic: any transaction attempting to exceed the ceiling will be mathematically rejected by every node in the network.',
    ],
    bullets: [
      'Native to Aztec Network — not an ERC-20 on Ethereum L1.',
      'Private by default: your balance is cryptographically invisible to observers.',
      'Hard cap: 210,000,000 units. No inflation. No exceptions.',
      'Permissionless: no KYC, no whitelist, no geographic restriction at the protocol level.',
    ],
  },
  {
    num: '02',
    title: 'Why privacy matters for a token',
    tag: 'Architecture',
    paragraphs: [
      'On a public blockchain like Ethereum, every transaction is permanently visible to everyone. Your balance, your trading history, who you paid, how much you earned — all of it is public. This creates real-world problems: competitors track your positions, front-runners exploit your pending transactions, and any counterparty can profile your economic activity.',
      'QDs use Aztec\'s ZK-SNARK architecture to make balances and transfers mathematically private. When you send QDs to another participant, the Aztec network verifies only one thing: that a valid Zero Knowledge proof was submitted proving you had sufficient balance and authorized the transfer. The network learns nothing else. The amount transferred, the recipient\'s address, and your remaining balance are all hidden inside the proof.',
      'This is not obscurity — it is cryptographic proof. Anyone can verify that the rules were followed (no double-spend, no out-of-thin-air creation) without being able to see the underlying numbers. This is the Aztec model: verifiable without being transparent.',
    ],
    diagram: [
      '  PUBLIC BLOCKCHAIN (Ethereum)       vs      AZTEC NETWORK (QDs)',
      '  ─────────────────────────────────────────────────────────────────────',
      '  Sender address:   VISIBLE          │  Sender address:   PRIVATE',
      '  Recipient:        VISIBLE          │  Recipient:        PRIVATE',
      '  Amount:           VISIBLE          │  Amount:           PRIVATE',
      '  Balance:          VISIBLE          │  Balance:          PRIVATE',
      '  Transaction valid: YES             │  Transaction valid: PROVEN ✓',
    ],
  },
  {
    num: '03',
    title: 'How to get QDs — Step by step',
    tag: 'Getting Started',
    paragraphs: [
      'Currently (Aztec Testnet phase, October 2026), QDs are distributed exclusively through the network\'s Proof of Contribution airdrop mechanism. There is no purchase, no presale, and no ICO. Acquiring QDs requires participation.',
      'Step 1 — Authenticate: Connect to the Humanity Ledger at humanidfi.com/connect using your Web3 wallet (MetaMask, Coinbase Wallet, WalletConnect) or via Turing Shield (email + 6-digit PIN for mobile users).',
      'Step 2 — Open the Terminal: Once authenticated, press Cmd+K (Mac) or Ctrl+K (Windows) to open the Ledger Terminal from anywhere on the platform.',
      'Step 3 — Navigate to Identity: In the terminal sidebar, find the "Identity / Airdrop" tab. This section shows your current ZK identity status, your Aztec account address, and your current QD balance.',
      'Step 4 — Claim Airdrop: Click "Claim Airdrop". The system verifies your identity via a ZK proof — confirming you are a unique, active participant — and deposits 50 testnet QDs directly into your private Aztec balance. The balance update happens on-chain and is visible only to you.',
    ],
    bullets: [
      'No purchase required — QDs are earned through participation.',
      'Each eligible address can claim once per epoch.',
      'Testnet QDs have no monetary value — they are for protocol testing and development.',
      'Future mainnet distribution will follow the same earned-not-purchased model.',
    ],
  },
  {
    num: '04',
    title: 'What QDs unlock — Current utility',
    tag: 'Utility',
    paragraphs: [
      'QDs are not a speculative asset waiting for utility. They have concrete, working utility inside the Humanity Ledger ecosystem today on testnet. Here is an honest description of each use case as it exists right now.',
    ],
    bullets: [
      'Ledger Terminal Pro Access: Spending QDs unlocks advanced analytical tiers (Tier 2 Pro, Tier 3 Ledger). These tiers provide real-time ledger alert filtering, anomaly detection dashboards, and cross-chain capital flow monitoring beyond what the free tier offers.',
      'Ledger Chat Encrypted Signals: When a participant sends a paid signal in LedgerChat, the recipient must spend QDs to decrypt and view it. The payment is a private ZK transaction — Aztec confirms the balance change, then the signal decrypts locally on the recipient\'s device.',
      'On-Chain Governance Voting: Submitting or voting on a Market Proposal requires locking a small amount of QDs. This prevents sybil attacks (creating many fake accounts to spam votes) by requiring economic commitment. Votes are cryptographically anchored to the ledger.',
      'Studio Provenance — ZK Product Passports: Minting an immutable cryptographic QR passport for a physical product costs QDs. The provenance record is anchored to the Aztec state, making it tamper-proof and verifiable by any third party scanning the QR code.',
    ],
  },
  {
    num: '05',
    title: 'Spending QDs in Ledger Chat — step by step',
    tag: 'How-To',
    paragraphs: [
      'This is the most direct example of QDs working as a real cryptographic payment layer today.',
      'Step 1: Open Ledger Chat from the terminal. Select a conversation with a peer you have already connected with via QR scan or wallet address.',
      'Step 2: Locate a message with a paid signal attached (indicated by a lock icon and QD cost).',
      'Step 3: Click "Pay & Decrypt". The application encodes your payment using Noir ABI encoding locally in your browser — the private inputs (your balance commitment, the recipient\'s Aztec address) never leave your device.',
      'Step 4: The encoded transaction is submitted to the Aztec V5 testnet RPC. The sequencer validates your ZK proof and updates both balances atomically — your balance decreases, the sender\'s increases.',
      'Step 5: Upon on-chain confirmation, the signal decrypts locally. The decryption key is derived from the state transition — our servers never hold it.',
    ],
    diagram: [
      '  [Your Browser]              [Aztec V5 Testnet]           [Sender\'s Browser]',
      '       |                             |                             |',
      '  1. Encode tx locally               |                             |',
      '  2. Generate ZK proof               |                             |',
      '       |──── Submit Proof ──────────>|                             |',
      '       |                    3. Verify ACIR constraints              |',
      '       |                    4. Nullify your QD note                 |',
      '       |                    5. Create sender\'s new note             |',
      '       |<─── State root confirmed ───|─────── Balance +QDs ───────>|',
      '  6. Signal decrypts locally         |                             |',
    ],
  },
  {
    num: '06',
    title: 'The 210,000,000 supply — why this number',
    tag: 'Economics',
    paragraphs: [
      'The supply ceiling of 210,000,000 is not arbitrary. It is chosen to create sufficient granularity for micro-transactions (each QD is divisible to 8 decimal places, giving 21 quadrillion discrete units in total) while maintaining meaningful scarcity at the whole-token level.',
      'The relationship to Bitcoin\'s 21,000,000 is intentional: QDs operate at 10x the base unit of the most established finite-supply asset, creating a parallel scarcity model that is intuitive for participants already familiar with the Bitcoin supply model.',
      'Once the 210,000,000th QD has been distributed, the protocol enters a pure fee-driven phase. No new QDs can be created — ever. The block reward reaches zero asymptotically, and after that point the only economic incentive for network validators is transaction fees paid in existing QDs. This transition is mathematically inevitable and has been modeled into the protocol architecture from day one.',
    ],
    bullets: [
      '210,000,000 total × 10^8 decimal subdivisions = 21,000,000,000,000,000 discrete units.',
      'Any transaction attempting to create QDs beyond the ceiling is rejected at the circuit level — no admin can override this.',
      'After the cap is reached: zero inflation, pure fee economy. The protocol is designed for this transition.',
    ],
  },
  {
    num: '07',
    title: 'The Halving Schedule',
    tag: 'Economics',
    paragraphs: [
      'QDs are not all distributed at once. They enter circulation through a geometric decay emission schedule modeled on Bitcoin\'s halving mechanism, adapted for Aztec\'s proof-based block structure.',
      'Block rewards begin at a set initial amount and halve at fixed intervals defined in the genesis parameters. Each halving reduces the rate of new QD issuance by 50%, extending the total distribution timeline while preserving the mathematical supply ceiling. The halving schedule is fully public, deterministic, and cannot be altered by any party.',
      'The consequence of this schedule is predictable: early network participants who contribute infrastructure and liquidity receive a proportionally larger share of the total supply. As the network matures and the block reward decreases, transaction fees become the primary incentive for validators. This creates a self-sustaining economic model that does not depend on perpetual inflation to function.',
    ],
    bullets: [
      'Halving intervals are defined at genesis and cannot be changed by any governance action.',
      'Each halving event is predictable: participants can calculate future issuance with certainty years in advance.',
      'The transition from inflationary (block reward) to deflationary (fee-only) is mathematically inevitable.',
      'Halvings create structured scarcity events historically associated with increased economic activity in similar networks.',
    ],
  },
  {
    num: '08',
    title: 'ZK Architecture — how it works under the hood',
    tag: 'Technical',
    paragraphs: [
      'QDs are built on the Aztec Network\'s Noir smart contract system. Noir is a domain-specific language for writing Zero Knowledge circuits. A Noir program encodes the rules of a token transfer: "the spender owns a valid note, the amount is positive, the total supply constraint is preserved." These rules compile to ACIR (Abstract Circuit Intermediate Representation) bytecode.',
      'When you perform any QD operation, the Barretenberg proving engine — a highly optimized C++ library compiled to WebAssembly — runs in your browser and generates an UltraHonk proof that you followed all the rules, without revealing any of your private inputs. This proof is then submitted to the Aztec sequencer, which batches it with other proofs and posts a single aggregated proof to Ethereum L1 for final settlement.',
      'The cryptographic primitives: Schnorr signatures on the BN254 Grumpkin curve for account authorization. Poseidon2 hashing for the Note commitment Merkle tree (depth 32). An Indexed Merkle tree for the nullifier set (depth 20). These are not arbitrary choices — they are the most efficient primitives for proof generation inside the BN254 proving system.',
    ],
    diagram: [
      '  ┌──────────────────────────┐',
      '  │    Your Browser (WASM)   │',
      '  │  Noir ABI Encoding       │',
      '  │  Barretenberg Prover     │',
      '  │  → UltraHonk Proof       │',
      '  └────────────┬─────────────┘',
      '               │ Submit proof',
      '               ▼',
      '  ┌──────────────────────────┐',
      '  │   Aztec V5 Sequencer     │',
      '  │  Validate ACIR bytecode  │',
      '  │  Update Note/Nullifier   │',
      '  │  trees                   │',
      '  └────────────┬─────────────┘',
      '               │ Rollup commitment',
      '               ▼',
      '  ┌──────────────────────────┐',
      '  │    Ethereum L1 (anchor)  │',
      '  │  BN254 pairing check     │',
      '  │  State root finalized    │',
      '  └──────────────────────────┘',
    ],
  },
  {
    num: '09',
    title: 'No team allocation — what this means exactly',
    tag: 'Tokenomics',
    paragraphs: [
      'Zero percent of the 210,000,000 QD supply is reserved for the founding team, investors, advisors, or any organizational entity. This is not a policy statement that can be walked back — it is a technical constraint enforced at the genesis state of the contract.',
      'This matters because team allocations are the most common source of token supply manipulation. When a team holds a large block of tokens, they can: sell into price rallies, create artificial scarcity by withholding, or dilute holders through vesting unlocks. None of these attack vectors exist in QDs, because no such block was ever created.',
      'If the Humanity Ledger team wants QDs, they must acquire them through the same participation mechanisms available to every other user: airdrops, governance contributions, and future mining. The protocol treats its creators identically to any other participant. This is enforced by code, not by promise.',
    ],
    bullets: [
      '0% team reserve. 0% investor allocation. 0% foundation treasury.',
      'No pre-mine: every QD ever created enters circulation through a defined contribution mechanism.',
      'The 15% stat shown refers to a future governance-managed ecosystem fund, governed by community vote — not unilateral team control.',
    ],
  },
  {
    num: '10',
    title: 'Current Status — Aztec v6 Testnet (October 2026)',
    tag: 'Status',
    paragraphs: [
      'QDs are currently live on the Aztec v6 testnet (endpoint: node.aztec.network). All functionality described in this document is operational on testnet: airdrops, Ledger Chat payments, governance votes, and Studio Provenance records.',
      'Testnet tokens have zero monetary value. They exist for the purpose of protocol validation, security testing, and infrastructure preparation before mainnet deployment. Do not purchase, sell, or treat testnet QDs as financial instruments. Any marketplace offering to sell testnet QDs is operating outside the canonical protocol.',
      'The transition from testnet to mainnet will happen only when: (1) a Tier-1 ZK security audit of the Noir circuit is complete and all findings are publicly disclosed, (2) the Barretenberg proving system reaches the performance benchmarks required for mainnet throughput, and (3) Aztec Network\'s L1 settlement contracts are formally verified and deployed.',
    ],
    bullets: [
      'Testnet endpoint: node.aztec.network',
      'All QD operations are functional on testnet today.',
      'No monetary value. No purchase events. No ICO.',
      'Mainnet deployment is conditional on ZK audit completion + Aztec L1 contract verification.',
    ],
  },
  {
    num: '11',
    title: 'Mainnet Vision — What QDs will power',
    tag: 'Roadmap',
    paragraphs: [
      'On mainnet, QDs become the core economic layer of a private-by-default financial intelligence network. The vision is not a speculative token — it is a functional unit of exchange for a specific, operational ecosystem.',
      'Private Wealth Intelligence: On mainnet, Ledger Terminal Pro access paid in QDs grants participants private real-time intelligence on capital movements across Ethereum, Aztec, and bridged L2 networks. The competitive advantage is significant: most participants use public data. Ledger Terminal users operate on private analytics that no one else can see or intercept.',
      'Sovereign P2P Economy: Ledger Chat on mainnet becomes a fully operational peer-to-peer marketplace for financial intelligence. Analysts, researchers, and ledger-level investors will be able to sell encrypted insights directly to each other, denominated in QDs, with no intermediary, no platform fee beyond the ZK transaction cost, and no record of who paid whom.',
      'Verifiable Provenance at Scale: Studio Provenance on mainnet allows manufacturers, artists, and institutions to anchor physical-world ownership records to the Aztec state permanently. A QD-denominated fee mints an immutable, cryptographically verifiable passport for any asset — from luxury goods to medical devices to art.',
      'Protocol Governance: On mainnet, every significant parameter change to the Humanity Ledger protocol (alert thresholds, new asset integrations, fee structures) goes through ZK-based on-chain governance. QD holders vote. QDs locked in proposals cannot be double-voted. The protocol evolves only through demonstrated economic consensus.',
    ],
  },
  {
    num: '12',
    title: 'Long-term Roadmap — from testnet to ecosystem',
    tag: 'Roadmap',
    paragraphs: [
      'Phase 1 — Testnet Validation (Current): All four QD use cases operational on Aztec V5 testnet. Security audit of Noir circuits in preparation. Barretenberg WASM proving performance benchmarking underway. Community participation through airdrops building initial network effects.',
      'Phase 2 — ZK Audit and Pre-Mainnet: Independent Tier-1 ZK security audit of the QD token circuit and all Humanity Ledger Noir contracts. All findings published publicly in full. No mainnet deployment before 100% audit completion and resolution of all critical findings.',
      'Phase 3 — Mainnet Launch: Deployment of the canonical QD genesis state on Aztec mainnet. Initial distribution via the Proof of Contribution mechanism begins. Studio Provenance mainnet records activated. Ledger Chat P2P payments operational with real economic value.',
      'Phase 4 — Ecosystem Expansion: Integration with external Aztec-native applications and DeFi protocols. Cross-chain capital bridges (Ethereum ↔ Aztec) for shielding/unshielding. QD-denominated fee markets for new terminal data sources. Full on-chain governance activation for protocol parameter changes.',
      'Phase 5 — Autonomous Protocol: Network reaches sufficient decentralization that no single participant, including the Humanity Ledger team, can alter the protocol unilaterally. The emission schedule completes. The network operates on pure fee economics. QDs exist as a sovereign, immutable unit of account — exactly as designed from genesis.',
    ],
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function QDsPage() {
  const heroRef = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroTextY = useTransform(scrollYProgress, [0, 1], ['0%', '32%']);
  const heroOpa   = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  return (
    <div className="min-h-screen bg-white text-black font-sans antialiased overflow-x-hidden selection:bg-black selection:text-white">

      {/* ── HERO ── */}
      <section
        ref={heroRef}
        className="relative w-full overflow-hidden bg-white"
        style={{ minHeight: '100dvh' }}
      >
        <div className="absolute inset-x-0 bottom-0 h-56 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, white)' }}
        />

        <motion.div
          style={{ y: heroTextY, opacity: heroOpa, minHeight: '100dvh' } as any}
          className="relative z-20 flex flex-col items-center justify-center text-center px-6 select-none pointer-events-none"
        >
          <div className="flex flex-col items-center justify-center" style={{ minHeight: '100dvh' }}>
            <motion.span
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              className="font-mono text-[11px] font-black uppercase tracking-[0.5em] text-black/40 mb-8 block"
            >
              Humanity Ledger · Digital Asset · Aztec V5
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
              className="font-black tracking-tighter uppercase leading-[0.85] text-black mb-6"
              style={{ fontSize: 'clamp(72px, 16vw, 180px)' }}
            >
              QDs
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.65 }}
              className="font-serif text-black/50 max-w-[560px] leading-relaxed"
              style={{ fontSize: 'clamp(16px, 2vw, 22px)' }}
            >
              Quantum Dots. 210,000,000 units. Private by default.
              <br className="hidden md:block" />
              Native Aztec Network — Noir smart contract.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.6, duration: 1 }}
              className="mt-16 flex flex-col items-center gap-2"
            >
              <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-black/20">Scroll</span>
              <div className="w-px h-10 bg-gradient-to-b from-black/15 to-transparent" />
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ── STATS BAND ── */}
      <section className="w-full border-y border-black/10 bg-white py-14">
        <div className="max-w-[1100px] mx-auto px-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.6, ease: 'easeOut' }}
              className="flex flex-col gap-2 p-5 rounded-2xl bg-white border border-black/10 hover:border-black/20 transition-colors shadow-sm"
            >
              <span className="font-mono text-[9px] font-black uppercase tracking-[0.25em] text-black/40">
                {s.label}
              </span>
              <span className="font-black text-[18px] tracking-tight text-black leading-none">
                {s.value}
              </span>
              <span className="font-mono text-[9px] text-black/50 leading-snug">
                {s.sub}
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CONTENT SECTIONS ── */}
      <section className="w-full max-w-[960px] mx-auto px-6 py-24 md:py-36 flex flex-col gap-24 md:gap-36">
        {SECTIONS.map((s) => (
          <motion.article
            key={s.num}
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col md:flex-row gap-8 md:gap-20"
          >
            {/* Section label */}
            <div className="w-full md:w-[220px] shrink-0 flex flex-col gap-3 pt-1">
              <span className="font-mono text-[10px] font-black text-black/20 tracking-[0.3em]">
                {s.num}
              </span>
              {s.tag && (
                <span className="inline-block font-mono text-[8px] font-black uppercase tracking-[0.25em] text-black/30 bg-black/5 border border-black/8 rounded-full px-2 py-1 w-fit">
                  {s.tag}
                </span>
              )}
              <h2 className="text-[20px] md:text-[24px] font-black tracking-tight leading-[1.15] text-black">
                {s.title}
              </h2>
              <div className="w-8 h-[2px] bg-black rounded-full mt-1" />
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col gap-5">
              {s.paragraphs.map((p, pi) => (
                <p
                  key={pi}
                  className="font-serif text-black/60 leading-[1.85]"
                  style={{ fontSize: 'clamp(15px, 1.5vw, 17px)' }}
                >
                  {p}
                </p>
              ))}

              {s.bullets && s.bullets.length > 0 && (
                <ul className="mt-2 flex flex-col gap-3">
                  {s.bullets.map((b, bi) => (
                    <li key={bi} className="flex gap-3 items-start">
                      <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-black/30 shrink-0" />
                      <span className="font-serif text-black/55 leading-relaxed"
                        style={{ fontSize: 'clamp(14px, 1.3vw, 16px)' }}>
                        {b}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {s.diagram && (
                <div className="mt-4 p-5 bg-black/[0.03] rounded-2xl border border-black/8 overflow-x-auto">
                  <pre className="font-mono text-[10px] md:text-[11px] leading-[1.6] text-black/60">
                    {s.diagram.join('\n')}
                  </pre>
                </div>
              )}
            </div>
          </motion.article>
        ))}
      </section>

      {/* ── DIVIDER BAND ── */}
      <section className="w-full border-y border-black/10 bg-black py-20 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9 }}
          className="text-center px-6"
        >
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.5em] text-white/30 mb-4">
            Aztec Network · Noir · Barretenberg · UltraHonk
          </p>
          <h3
            className="font-black tracking-tighter uppercase text-white leading-[0.87]"
            style={{ fontSize: 'clamp(32px, 6vw, 64px)' }}
          >
            Private by default.
            <br />No exceptions.
          </h3>
          <p className="mt-6 font-serif text-white/40 max-w-lg mx-auto leading-relaxed"
            style={{ fontSize: 'clamp(14px, 1.5vw, 17px)' }}>
            Every QD balance, every transfer, every governance vote is cryptographically private.
            Verifiable without being transparent. That is the Aztec model.
          </p>
        </motion.div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative w-full py-32 md:py-48 flex flex-col items-center justify-center overflow-hidden bg-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 max-w-2xl flex flex-col items-center gap-8 px-6 text-center"
        >
          <span className="font-mono text-[10px] font-black uppercase tracking-[0.5em] text-black/30">
            Testnet Active · Mainnet Pending ZK Audit
          </span>
          <h2
            className="font-black tracking-tighter uppercase leading-[0.87] text-black text-balance"
            style={{ fontSize: 'clamp(36px, 7vw, 72px)' }}
          >
            Start participating.
          </h2>
          <p
            className="font-serif text-black/55 leading-relaxed max-w-xl"
            style={{ fontSize: 'clamp(15px, 1.7vw, 19px)' }}
          >
            Connect your wallet, claim your testnet airdrop, and experience
            what private-by-default economics feels like in practice.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-2">
            <Link
              href="/connect"
              className="px-10 py-5 bg-black text-white hover:bg-black/85 rounded-full font-mono text-[11px] font-black uppercase tracking-[0.22em] transition-all active:scale-95 shadow-xl shadow-black/10"
            >
              Connect Wallet
            </Link>
            <Link
              href="/whitepaper"
              className="px-10 py-5 bg-transparent border border-black/12 text-black hover:bg-black/4 rounded-full font-mono text-[11px] font-black uppercase tracking-[0.22em] transition-all active:scale-95"
            >
              Read Whitepaper
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="w-full bg-white border-t border-black/[0.05] py-10 px-6">
        <div className="max-w-[960px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-mono text-[9px] font-black uppercase tracking-[0.28em] text-black/25">
            © 2026 Humanity Ledger · QDs Protocol · Updated July 26, 2026
          </span>
          <div className="flex items-center gap-6">
            {[
              { label: 'Privacy',   href: '/privacy'   },
              { label: 'Whitepaper',href: '/whitepaper'},
              { label: 'Developer', href: '/developer' },
              { label: 'Status',    href: '/status'    },
              { label: 'Legal',     href: '/legal'     },
            ].map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-black/25 hover:text-black transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
