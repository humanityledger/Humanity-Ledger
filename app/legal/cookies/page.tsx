"use client";

import React from 'react';
import { Database } from 'lucide-react';

export default function CookiePolicy() {
    return (
        <div className="min-h-screen bg-white text-black font-sans pt-32 pb-24 selection:bg-[#25D366]/20 selection:text-black">
            <div className="max-w-3xl mx-auto px-6 md:px-12">
                <div className="mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#25D366]/10 text-[#25D366] text-sm font-medium mb-6">
                        <Database size={16} />
                        Legal Information
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Cookie Policy</h1>
                    <p className="text-lg text-black/60 leading-relaxed">
                        We only use the essentials. Your device, your rules.
                    </p>
                </div>

                <div className="space-y-12 text-black/80 prose prose-lg prose-gray max-w-none">
                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-black flex items-center gap-3">
                            <span className="text-[#25D366]">1.</span> Strictly Necessary
                        </h2>
                        <p className="leading-relaxed">
                            We use a minimal number of cookies strictly necessary for Humanity Ledger to function. These include session tokens to keep you securely logged in and preferences to ensure the app loads correctly.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-black flex items-center gap-3">
                            <span className="text-[#25D366]">2.</span> Zero Third-Party Tracking
                        </h2>
                        <p className="leading-relaxed">
                            We do not use advertising or third-party tracking cookies. We believe your browsing habits belong to you, and we have built our platform to operate without compromising that principle.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-black flex items-center gap-3">
                            <span className="text-[#25D366]">3.</span> Managing Your Preferences
                        </h2>
                        <p className="leading-relaxed">
                            Because we only use essential functional cookies, there are no complex tracking preferences to manage. If you wish to clear your session data, you can do so directly from your browser settings at any time.
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
