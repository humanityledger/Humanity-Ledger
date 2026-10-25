"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { toast } from 'sonner';
import Link from 'next/link';

interface Ticket {
    id: string;
    subject: string;
    status: 'OPEN' | 'IN PROGRESS' | 'RESOLVED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    createdAt: string;
}

type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

const FAQ = [
    { q: 'How do I connect my wallet?',          a: 'Navigate to the Dashboard section and use the system handshake flow to link your wallet securely through WalletConnect or MetaMask.' },
    { q: 'What is the Aztec Network integration?', a: 'Humanity Ledger is fully anchored to Aztec Network\'s privacy-preserving L2 rollup. All transactions execute inside Aztec\'s zero knowledge virtual machine, ensuring your financial activity is never exposed on-chain.' },
    { q: 'How do QDs tokens work?',              a: 'QDs (Network Score) are the native governance and utility token of the Humanity Ledger ecosystem. They enable voting rights, premium feature access, and staking for network security contributions.' },
    { q: 'Is Ledger Chat end to end encrypted?',  a: 'Yes. Ledger Chat uses the XMTP protocol with full end to end encryption. Messages are encrypted client-side using your wallet keys. Not even Humanity Ledger can read your messages.' },
    { q: 'How do I upgrade my plan?',            a: 'Go to the Pricing section in the sidebar to view and upgrade your sovereign tier. All payments are processed via Stripe with SEPA and card support.' },
    { q: 'Where does the market data come from?', a: 'Market data is sourced directly from on-chain oracles (Chainlink, GetBlock RPC nodes) and verified exchange APIs in real time with zero interpolation or mock data.' },
    { q: 'What is the Humanity Ledger indexer?', a: 'The Humanity Ledger is an official Aztec Network live indexer that records and stores all blockchain transactions in a local SQLite database. It resets every 11h 59m for optimal performance.' },
    { q: 'How is my privacy protected?',         a: 'Your portfolio, identity, and messaging data is never stored on centralised servers. All sensitive operations use zero knowledge proofs on Aztec\'s private execution layer. Your IP is never logged.' },
];

const COMMUNITY_CHANNELS = [
    {
        icon: <span className="font-mono font-black text-[12px]">[WWW]</span>,
        label: 'Token Forum',
        sub: 'Governance · Research · Announcements',
        href: '/forum',
        external: false,
        badge: 'LIVE',
    },
    {
        icon: <span className="font-mono font-black text-[12px]">[MSG]</span>,
        label: 'Discord',
        sub: 'Real-time community discussion',
        href: 'https://discord.gg/aztec',
        external: true,
        badge: null,
    },
    {
        icon: <span className="font-mono font-black text-[12px]">[X]</span>,
        label: 'Twitter / X',
        sub: 'Updates, announcements, and ecosystem news',
        href: 'https://x.com/aztecnetwork',
        external: true,
        badge: null,
    },
];

const DOCS_LINKS = [
    { icon: <span className="font-mono font-black text-[10px]">[DOC]</span>, label: 'Technical Whitepaper',  href: '/whitepaper',  desc: 'Full cryptographic architecture of Humanity Ledger on Aztec L2.' },
    { icon: <span className="font-mono font-black text-[10px]">[SEC]</span>,   label: 'Privacy Manifesto',     href: '/manifesto',   desc: 'Our commitment to zero knowledge privacy and human Privatety.' },
    { icon: <span className="font-mono font-black text-[10px]">[ZAP]</span>,      label: 'QDs Tokenomics',        href: '/tokenomics',  desc: 'Supply schedule, distribution model, and governance mechanics.' },
    { icon: <span className="font-mono font-black text-[10px]">[WWW]</span>,    label: 'Roadmap',               href: '/roadmap',     desc: 'Quarterly milestones and Aztec Network integration timeline.' },
    { icon: <span className="font-mono font-black text-[10px]">[DEV]</span>,    label: 'Developer Hub',         href: '/developer',   desc: 'API documentation, SDK references, and Noir circuit guides.' },
    { icon: <span className="font-mono font-black text-[10px]">[DEV]</span>,    label: 'API Reference',         href: '/developers/api-docs', desc: 'Full REST and WebSocket API specification with live playground.' },
    { icon: <span className="font-mono font-black text-[10px]">[DEV]</span>,    label: 'API Marketplace',       href: '/developers',  desc: 'Third-party integrations and licensed data endpoint catalogue.' },
    { icon: <span className="font-mono font-black text-[10px]">[DEV]</span>,    label: 'Noir Circuits',         href: 'https://github.com/hvbr1s/noir-circuits', desc: 'Open source ZK circuit implementations powering private execution.' },
    { icon: <span className="font-mono font-black text-[10px]">[SEC]</span>,   label: 'Security Policy',       href: '/security',    desc: 'Responsible disclosure process and security architecture overview.' },
    { icon: <span className="font-mono font-black text-[10px]">[SEC]</span>,   label: 'Audits',                href: '/security',    desc: 'Independent third-party audit reports and formal verification results.' },
];

export function LedgerSupport() {
    const [openFaq, setOpenFaq]       = useState<number | null>(null);
    const [subject, setSubject]       = useState('');
    const [message, setMessage]       = useState('');
    const [priority, setPriority]     = useState<Priority>('MEDIUM');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted]   = useState(false);
    const [tickets, setTickets]       = useState<Ticket[]>([]);
    const [activeSection, setActiveSection] = useState<'support' | 'docs' | 'community'>('community');

    useEffect(() => {
        try {
            const stored = localStorage.getItem('ledger_support_tickets');
            if (stored) setTickets(JSON.parse(stored));
        } catch {}
    }, []);

    const handleSubmit = async () => {
        if (!subject.trim() || !message.trim()) {
            toast.error('Subject and message are required.');
            return;
        }
        setSubmitting(true);
        try {
            const ticketId = typeof crypto !== 'undefined' && crypto.randomUUID 
                ? crypto.randomUUID().slice(0, 8) 
                : `TK-${Date.now().toString(36).toUpperCase()}`;
            const newTicket: Ticket = {
                id: ticketId,
                subject, status: 'OPEN', priority,
                createdAt: new Date().toISOString(),
            };
            const updated = [newTicket, ...tickets];
            setTickets(updated);
            localStorage.setItem('ledger_support_tickets', JSON.stringify(updated));
            setSubmitted(true); setSubject(''); setMessage('');
            toast.success('Support ticket submitted.');
            setTimeout(() => setSubmitted(false), 4000);
        } catch { toast.error('Error submitting ticket.'); }
        finally { setSubmitting(false); }
    };

    const priorityLabel: Record<Priority, string> = { LOW: 'LOW', MEDIUM: 'MED', HIGH: 'HIGH' };

    const TABS = [
        { id: 'community', label: 'Community', icon: <span className="font-mono font-black text-[9px]">[PPL]</span> },
        { id: 'docs',      label: 'Documentation', icon: <span className="font-mono font-black text-[9px]">[DOC]</span> },
        { id: 'support',   label: 'Support Desk', icon: <span className="font-mono font-black text-[9px]">[EML]</span> },
    ] as const;

    return (
        <div className="w-full h-full min-h-0 flex flex-col items-center justify-start p-4 md:p-8 text-black font-sans overflow-y-auto no-scrollbar relative bg-white">
            <div className="w-full max-w-[1100px] mx-auto flex flex-col gap-6">

                {/* ── HEADER ── */}
                <div className="w-full border-b border-slate-200/60 pb-6">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div className="flex flex-col">
                            <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase text-slate-900 leading-none">
                                Community
                            </h1>
                            <span className="mt-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                Aztec Network · Ecosystem Hub · Documentation · Support
                            </span>
                        </div>
                        {/* Active badge */}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/[0.03] border border-black/8 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="font-mono text-[9px] font-black uppercase tracking-widest text-black/40">Forum Active</span>
                        </div>
                    </div>

                    {/* Section Tabs */}
                    <div className="flex items-center gap-1 mt-6 bg-black/[0.02] border border-black/5 p-1 rounded-xl w-fit">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveSection(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                    activeSection === tab.id
                                        ? 'bg-black text-white shadow-sm'
                                        : 'text-black/40 hover:text-black hover:bg-black/[0.04]'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── COMMUNITY SECTION ── */}
                <AnimatePresence mode="wait">
                {activeSection === 'community' && (
                    <motion.div key="community" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.25 }} className="flex flex-col gap-6">

                        {/* Channel Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {COMMUNITY_CHANNELS.map(ch => (
                                <Link
                                    key={ch.label}
                                    href={ch.href}
                                    target={ch.external ? '_blank' : undefined}
                                    rel={ch.external ? 'noopener noreferrer' : undefined}
                                    className="group relative flex flex-col gap-3 p-6 bg-white border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md hover:border-black/20 transition-all duration-300"
                                >
                                    {ch.badge && (
                                        <span className="absolute top-4 right-4 text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-emerald-500 text-white rounded-md">{ch.badge}</span>
                                    )}
                                    <div className="w-10 h-10 flex items-center justify-center bg-black/[0.04] border border-black/8 rounded-xl text-black/60 group-hover:bg-black group-hover:text-white group-hover:border-black transition-all duration-300">
                                        {ch.icon}
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-[14px] text-slate-900 tracking-tight">{ch.label}</span>
                                            {ch.external && <span className="font-mono font-black text-[9px] text-black/30 group-hover:text-black transition-colors">[^&gt;]</span>}
                                        </div>
                                        <span className="font-mono text-[10px] text-black/40 uppercase tracking-wider">{ch.sub}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>

                        {/* FAQ */}
                        <div className="w-full bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm">
                            <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200/60 bg-black/5/60">
                                <span className="font-mono text-[10px] font-black text-black/40">[!]</span>
                                <span className="font-mono text-[10px] font-black uppercase tracking-widest">Frequently Asked Questions</span>
                                <span className="ml-auto font-mono text-[9px] text-black/30 uppercase tracking-widest">{FAQ.length} entries</span>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {FAQ.map((faq, i) => (
                                    <div key={i} className="cursor-pointer hover:bg-black/5/60 transition-colors" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                                        <div className="px-6 py-4 flex items-center justify-between gap-4">
                                            <span className="text-[13px] font-bold text-slate-800 leading-snug">{faq.q}</span>
                                            <motion.div animate={{ rotate: openFaq === i ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0">
                                                <span className="font-mono text-[10px] font-black text-black/30">[v]</span>
                                            </motion.div>
                                        </div>
                                        <AnimatePresence>
                                            {openFaq === i && (
                                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                                    <p className="px-6 pb-5 text-[13px] text-black/50 leading-relaxed font-medium">{faq.a}</p>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ── DOCUMENTATION SECTION ── */}
                {activeSection === 'docs' && (
                    <motion.div key="docs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.25 }} className="flex flex-col gap-4">
                        <div className="w-full bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm">
                            <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200/60 bg-black/5/60">
                                <span className="font-mono text-[10px] font-black text-black/40">[DOC]</span>
                                <span className="font-mono text-[10px] font-black uppercase tracking-widest">Protocol Documentation</span>
                                <span className="ml-auto font-mono text-[9px] text-black/30 uppercase tracking-widest">{DOCS_LINKS.length} resources</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                                {DOCS_LINKS.map((doc, i) => (
                                    <Link
                                        key={doc.label}
                                        href={doc.href}
                                        target={doc.href.startsWith('http') ? '_blank' : undefined}
                                        rel={doc.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                                        className={`group flex items-start gap-4 p-5 hover:bg-black/5/60 transition-colors ${i % 2 === 0 && i < DOCS_LINKS.length - 1 ? 'sm:border-b sm:border-slate-100' : ''}`}
                                    >
                                        <div className="w-8 h-8 flex items-center justify-center bg-black/[0.03] border border-black/8 rounded-lg text-black/50 shrink-0 group-hover:bg-black group-hover:text-white group-hover:border-black transition-all duration-200 mt-0.5">
                                            {doc.icon}
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-black text-[13px] text-slate-900 tracking-tight group-hover:text-black">{doc.label}</span>
                                                {doc.href.startsWith('http') && <span className="font-mono text-[9px] font-black text-black/25 group-hover:text-black transition-colors shrink-0">[^&gt;]</span>}
                                            </div>
                                            <span className="font-mono text-[10px] text-black/40 leading-relaxed">{doc.desc}</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ── SUPPORT DESK SECTION ── */}
                {activeSection === 'support' && (
                    <motion.div key="support" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.25 }}>
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                            {/* Form */}
                            <div className="lg:col-span-3 bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm">
                                <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200/60 bg-black/5/60">
                                    <span className="font-mono text-[10px] font-black text-black/40">[EML]</span>
                                    <span className="font-mono text-[10px] font-black uppercase tracking-widest">Contact Support</span>
                                </div>
                                <div className="p-6 flex flex-col gap-5">
                                    <div>
                                        <label className="font-mono text-[9px] font-black uppercase tracking-widest text-black/40 block mb-2">Subject</label>
                                        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="What is your issue about?" className="w-full rounded-xl px-4 py-3 text-[13px] bg-black/5/60 border border-slate-200/60 outline-none focus:border-black/30 transition-all placeholder:text-black/25 text-slate-900 font-sans" />
                                    </div>
                                    <div>
                                        <label className="font-mono text-[9px] font-black uppercase tracking-widest text-black/40 block mb-2">Priority</label>
                                        <div className="flex gap-2">
                                            {(['LOW', 'MEDIUM', 'HIGH'] as Priority[]).map(p => (
                                                <button key={p} onClick={() => setPriority(p)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${priority === p ? 'bg-black text-white border-black' : 'bg-white text-black/40 border-slate-200/60 hover:border-black/20 hover:text-black'}`}>
                                                    {priorityLabel[p]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="font-mono text-[9px] font-black uppercase tracking-widest text-black/40 block mb-2">Message</label>
                                        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} placeholder="Describe your issue in detail..." className="w-full rounded-xl px-4 py-3 text-[13px] bg-black/5/60 border border-slate-200/60 outline-none focus:border-black/30 resize-none transition-all placeholder:text-black/25 text-slate-900 font-sans" />
                                    </div>
                                    <AnimatePresence mode="wait">
                                        {submitted ? (
                                            <motion.div key="ok" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="flex items-center justify-center gap-3 py-4 rounded-xl bg-black/5/80 border border-slate-200/60 text-slate-700">
                                                <span className="font-mono text-[10px] font-black">[OK]</span>
                                                <span className="font-mono text-[10px] font-black uppercase tracking-widest">Ticket Submitted</span>
                                            </motion.div>
                                        ) : (
                                            <motion.button key="sub" onClick={handleSubmit} disabled={submitting} className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] bg-black text-white hover:bg-black/80 transition-all disabled:opacity-50 active:scale-[0.98]">
                                                {submitting ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <span className="font-mono text-[10px] font-black">[SND]</span>}
                                                {submitting ? 'Submitting...' : 'Submit Ticket'}
                                            </motion.button>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Right column */}
                            <div className="lg:col-span-2 flex flex-col gap-6">
                                {/* Active Tickets */}
                                <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 bg-black/5/60">
                                        <span className="font-mono text-[10px] font-black uppercase tracking-widest">Your Tickets</span>
                                        <span className="font-mono text-[10px] text-black/30 font-bold">{tickets.length} total</span>
                                    </div>
                                    <div className="max-h-[280px] overflow-y-auto no-scrollbar divide-y divide-slate-100">
                                        {tickets.length === 0 ? (
                                            <div className="py-10 text-center font-mono text-[11px] font-black uppercase tracking-widest text-black/25">No active tickets</div>
                                        ) : tickets.map(t => (
                                            <div key={t.id} className="px-6 py-4 hover:bg-black/5/60 transition-colors">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-mono text-[9px] text-black/30 font-bold">#{t.id}</span>
                                                            <span className="font-mono text-[8px] font-black uppercase tracking-widest text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded">{t.priority}</span>
                                                        </div>
                                                        <p className="text-[13px] font-bold text-slate-800 truncate">{t.subject}</p>
                                                        <span className="font-mono text-[9px] text-black/30">{new Date(t.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <span className="font-mono text-[9px] px-2.5 py-1 rounded-lg font-black uppercase whitespace-nowrap shrink-0 bg-slate-100 border border-slate-200 text-slate-700">{t.status}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Quick Links */}
                                <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200/60 bg-black/5/60">
                                        <span className="font-mono text-[10px] font-black text-black/40">[WWW]</span>
                                        <span className="font-mono text-[10px] font-black uppercase tracking-widest">Quick Resources</span>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {[
                                            { label: 'Aztec Network Docs',   href: 'https://docs.aztec.network', external: true },
                                            { label: 'Security Policy',      href: '/security',  external: false },
                                            { label: 'API Marketplace',      href: '/developers', external: false },
                                        ].map(l => (
                                            <Link key={l.label} href={l.href} target={l.external ? '_blank' : undefined} rel={l.external ? 'noopener noreferrer' : undefined} className="group flex items-center justify-between px-6 py-3.5 hover:bg-black/5/60 transition-colors">
                                                <span className="text-[12px] font-bold text-slate-700 group-hover:text-black transition-colors">{l.label}</span>
                                                <span className="font-mono text-[9px] font-black text-black/25 group-hover:text-black transition-colors">[^&gt;]</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
                </AnimatePresence>

            </div>
        </div>
    );
}
