"use client";

import React from 'react';
import { Shield, Lock, Eye, Database, Trash2, Key } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPolicy() {
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
                        <Shield size={14} />
                        GDPR Compliant & Sovereign Privacy
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Privacy Policy</h1>
                    <p className="text-base md:text-lg text-black/60 leading-relaxed font-normal">
                        Privacy is not an added feature; it is the cryptographic core of Humanity Ledger. Here is an honest, technical explanation of what data is processed, where it lives, and why we cannot read your communications.
                    </p>
                </div>

                <div className="space-y-12 text-black/80 prose prose-lg prose-gray max-w-none">
                    <section>
                        <h2 className="text-xl md:text-2xl font-bold mb-3 text-black flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-black/5 text-black flex items-center justify-center text-sm font-black">1</span>
                            Zero Plaintext Message Storage
                        </h2>
                        <p className="leading-relaxed text-sm md:text-base">
                            All direct messages, private group messages, and channel content within private communities are end-to-end encrypted using XMTP MLS (Messaging Layer Security) with post-quantum key encapsulation. Decryption keys reside exclusively on your local device. Our servers never receive, store, log, or index the plaintext contents of your messages.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl md:text-2xl font-bold mb-3 text-black flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-black/5 text-black flex items-center justify-center text-sm font-black">2</span>
                            Cryptographic Authentication & Signatures
                        </h2>
                        <p className="leading-relaxed text-sm md:text-base">
                            When connecting with a wallet, we utilize Sign-In with Ethereum (EIP-4361 / SIWE). Authentication nonces are single-use, randomized cryptographic tokens stored with strict 10-minute TTLs. For email sign-ins, verification codes are salted and hashed (SHA-256) before verification. Screen lock PINs are hashed using memory-hard scrypt with unique per-user salts and application pepper.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl md:text-2xl font-bold mb-3 text-black flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-black/5 text-black flex items-center justify-center text-sm font-black">3</span>
                            Voice & Video Calls (E2EE)
                        </h2>
                        <p className="leading-relaxed text-sm md:text-base">
                            Real-time calls utilize WebRTC with LiveKit SFU infrastructure. Audio and video streams are end-to-end encrypted via insertable streams. For users requiring maximum network privacy, a forced TURN relay option is available to prevent revealing IP addresses to call peers. We do not record or archive call media.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl md:text-2xl font-bold mb-3 text-black flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-black/5 text-black flex items-center justify-center text-sm font-black">4</span>
                            Zero-Knowledge Payments (Aztec Network)
                        </h2>
                        <p className="leading-relaxed text-sm md:text-base">
                            Private settlements, shielded balances, and confidential invoices run through Aztec Network client-side Private Execution Environments (PXE). Private spend and viewing keys remain solely on your device. Transaction proofs are generated locally (or via an isolated Web Worker), leaving zero transaction metadata on our central servers.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl md:text-2xl font-bold mb-3 text-black flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-black/5 text-black flex items-center justify-center text-sm font-black">5</span>
                            Cookies & Local Storage
                        </h2>
                        <p className="leading-relaxed text-sm md:text-base">
                            We use zero third-party tracking cookies, zero analytics pixels, and zero advertising trackers. Only a single essential session cookie (<code>hl_session</code>) is set with <code>HttpOnly</code>, <code>SameSite=Strict</code>, and <code>Secure</code> flags to maintain your cryptographic session.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl md:text-2xl font-bold mb-3 text-black flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-black/5 text-black flex items-center justify-center text-sm font-black">6</span>
                            Your GDPR Rights (Articles 15–20)
                        </h2>
                        <p className="leading-relaxed text-sm md:text-base">
                            You maintain absolute sovereignty over your profile data:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-sm md:text-base text-black/70">
                            <li><strong>Right of Access & Portability:</strong> Export all server-stored profile records at any time via <code>/api/user/export</code>.</li>
                            <li><strong>Right to Erasure (Nuclear Deletion):</strong> Permanently wipe your server presence, memberships, and session states in a single atomic transaction via <code>/api/user/nuke</code>.</li>
                        </ul>
                    </section>
                </div>

                <div className="mt-20 pt-8 border-t border-black/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-black/50">
                    <p>Last audited & verified: October 21, 2026</p>
                    <Link href="/legal/terms" className="font-semibold text-black hover:underline">
                        View Terms of Service →
                    </Link>
                </div>
            </div>
        </div>
    );
}
