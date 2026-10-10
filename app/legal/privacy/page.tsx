"use client";

import React from 'react';
import { Shield } from 'lucide-react';

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-white text-black font-sans pt-32 pb-24 selection:bg-[#25D366]/20 selection:text-black">
            <div className="max-w-3xl mx-auto px-6 md:px-12">
                <div className="mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#25D366]/10 text-[#25D366] text-sm font-medium mb-6">
                        <Shield size={16} />
                        Legal Information
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Privacy Policy</h1>
                    <p className="text-lg text-black/60 leading-relaxed">
                        We believe privacy is a fundamental human right. Here is how we handle your data with respect, transparency, and top-tier security.
                    </p>
                </div>

                <div className="space-y-12 text-black/80 prose prose-lg prose-gray max-w-none">
                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-black flex items-center gap-3">
                            <span className="text-[#25D366]">1.</span> Minimal Data Collection
                        </h2>
                        <p className="leading-relaxed">
                            We collect only what is absolutely necessary to provide you with a seamless and secure experience. We do not track your activity across other applications or websites, and we never sell your personal information to third parties.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-black flex items-center gap-3">
                            <span className="text-[#25D366]">2.</span> How We Use Your Information
                        </h2>
                        <p className="leading-relaxed">
                            Any data we do collect is strictly used to maintain your account, process transactions, and improve the reliability of Humanity Ledger. We focus on providing you value, not monetizing your identity.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-black flex items-center gap-3">
                            <span className="text-[#25D366]">3.</span> State-of-the-art Security
                        </h2>
                        <p className="leading-relaxed">
                            Your information is encrypted both in transit and at rest. We leverage advanced cryptographic protocols to ensure that your data remains yours, fully shielded from unauthorized access.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-black flex items-center gap-3">
                            <span className="text-[#25D366]">4.</span> Your Rights
                        </h2>
                        <p className="leading-relaxed">
                            You have complete control over your data. You can access, modify, or permanently delete your account information at any time directly through the application settings.
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
