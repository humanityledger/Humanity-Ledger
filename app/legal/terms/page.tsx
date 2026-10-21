"use client";

import React from 'react';
import { FileCheck, Shield, Key, AlertCircle, Scale } from 'lucide-react';
import Link from 'next/link';

export default function TermsOfService() {
    return (
        <div className="min-h-screen bg-white text-black font-sans pt-28 pb-24 selection:bg-black/10 selection:text-black">
            <div className="max-w-3xl mx-auto px-6 md:px-12">
                <div className="mb-14">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-black/50 hover:text-black mb-8 transition-colors"
                    >
                        ← Back to Humanity Ledger
                    </Link>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 text-black text-xs font-semibold mb-6">
                        <FileCheck size={14} />
                        Protocol Agreement
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Terms of Service</h1>
                    <p className="text-base md:text-lg text-black/60 leading-relaxed font-normal">
                        Clear, transparent, and enforceable terms governing access to Humanity Ledger client applications, decentralized messaging interfaces, and privacy tools.
                    </p>
                </div>

                <div className="space-y-12 text-black/80 prose prose-lg prose-gray max-w-none">
                    <section>
                        <h2 className="text-xl md:text-2xl font-bold mb-3 text-black flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-black/5 text-black flex items-center justify-center text-sm font-black">1</span>
                            Eligibility & Sanctions Compliance
                        </h2>
                        <p className="leading-relaxed text-sm md:text-base">
                            By accessing or using Humanity Ledger, you represent and warrant that you are at least 16 years of age (or the legal age of digital consent in your jurisdiction). You affirm that neither you nor any affiliated entity is named on international sanctions lists maintained by the United States (OFAC), the European Union, the United Nations, or HM Treasury.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl md:text-2xl font-bold mb-3 text-black flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-black/5 text-black flex items-center justify-center text-sm font-black">2</span>
                            Non-Custodial Architecture & Private Key Sovereignty
                        </h2>
                        <p className="leading-relaxed text-sm md:text-base">
                            Humanity Ledger is fundamentally non-custodial. Cryptographic private keys, seed phrases, XMTP installation identity keys, and Aztec viewing keys remain under your exclusive control on your personal devices. Humanity Ledger developers cannot access your keys, cannot recover lost credentials, cannot reverse on-chain transactions, and cannot decrypt your end-to-end encrypted communications.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl md:text-2xl font-bold mb-3 text-black flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-black/5 text-black flex items-center justify-center text-sm font-black">3</span>
                            Decentralized Protocol Disclaimers
                        </h2>
                        <p className="leading-relaxed text-sm md:text-base">
                            Smart contracts and zero-knowledge protocols (including Ethereum, Aztec L2, and XMTP Network) operate autonomously on decentralized networks. While audited with zero-simulation rigor, execution of transactions is subject to public blockchain availability, gas fees, sequencer finality, and network consensus. Humanity Ledger provides the software interface and is not liable for blockchain protocol anomalies.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl md:text-2xl font-bold mb-3 text-black flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-black/5 text-black flex items-center justify-center text-sm font-black">4</span>
                            Acceptable Use & Anti-Abuse
                        </h2>
                        <p className="leading-relaxed text-sm md:text-base">
                            You agree not to use Humanity Ledger to conduct illegal activities, distribute malicious software, conduct denial-of-service attacks against protocol relays, or transmit material involving child sexual abuse material (CSAM). Community moderators retain autonomous rights to kick or ban members from community channels pursuant to community governance guidelines.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl md:text-2xl font-bold mb-3 text-black flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-black/5 text-black flex items-center justify-center text-sm font-black">5</span>
                            Warranty Disclaimer & Limitation of Liability
                        </h2>
                        <p className="leading-relaxed text-sm md:text-base">
                            The software is provided "AS IS", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement. In no event shall the authors or copyright holders be liable for any claim, damages, or other liability arising from the use of the software.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl md:text-2xl font-bold mb-3 text-black flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-black/5 text-black flex items-center justify-center text-sm font-black">6</span>
                            Account Termination & Data Erasure
                        </h2>
                        <p className="leading-relaxed text-sm md:text-base">
                            You may terminate your account at any time using the self-sovereign account deletion mechanism in Settings (or <code>/api/user/nuke</code>), which atomically purges your profile, associated metadata, and active session tokens.
                        </p>
                    </section>
                </div>

                <div className="mt-20 pt-8 border-t border-black/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-black/50">
                    <p>Last audited & verified: October 21, 2026</p>
                    <Link href="/legal/privacy" className="font-semibold text-black hover:underline">
                        View Privacy Policy →
                    </Link>
                </div>
            </div>
        </div>
    );
}
