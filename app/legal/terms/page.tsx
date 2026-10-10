"use client";

import React from 'react';
import { FileCheck } from 'lucide-react';

export default function TermsOfService() {
    return (
        <div className="min-h-screen bg-white text-black font-sans pt-32 pb-24 selection:bg-[#25D366]/20 selection:text-black">
            <div className="max-w-3xl mx-auto px-6 md:px-12">
                <div className="mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#25D366]/10 text-[#25D366] text-sm font-medium mb-6">
                        <FileCheck size={16} />
                        Legal Information
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Terms of Service</h1>
                    <p className="text-lg text-black/60 leading-relaxed">
                        Clear, straightforward rules for using Humanity Ledger. No confusing legal jargon.
                    </p>
                </div>

                <div className="space-y-12 text-black/80 prose prose-lg prose-gray max-w-none">
                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-black flex items-center gap-3">
                            <span className="text-[#25D366]">1.</span> Our Agreement
                        </h2>
                        <p className="leading-relaxed">
                            By using Humanity Ledger, you agree to these terms. We keep them simple because we believe transparency builds trust. If you do not agree with them, you may discontinue using our services at any time.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-black flex items-center gap-3">
                            <span className="text-[#25D366]">2.</span> Your Responsibilities
                        </h2>
                        <p className="leading-relaxed">
                            You are responsible for keeping your account credentials and cryptographic keys secure. Do not use our platform for illegal activities, and respect the community and underlying infrastructure.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-black flex items-center gap-3">
                            <span className="text-[#25D366]">3.</span> Our Commitment
                        </h2>
                        <p className="leading-relaxed">
                            We strive to provide a reliable, secure, and privacy-preserving platform. While we continuously work to ensure maximum uptime and security, the services are provided "as is" without guaranteed warranties.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-black flex items-center gap-3">
                            <span className="text-[#25D366]">4.</span> Account Termination
                        </h2>
                        <p className="leading-relaxed">
                            You can close your account whenever you want. We reserve the right to suspend accounts that compromise the security of our platform or violate these straightforward terms.
                        </p>
                    </section>
                </div>
                
                <div className="mt-24 pt-8 border-t border-black/10">
                    <p className="text-sm text-black/50">Last updated: October 10, 2026</p>
                </div>
            </div>
        </div>
    );
}
