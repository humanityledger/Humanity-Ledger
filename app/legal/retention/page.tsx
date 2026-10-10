"use client";

import React from 'react';
import { Lock } from 'lucide-react';

export default function DataRetentionPolicy() {
    return (
        <div className="min-h-screen bg-white text-black font-sans pt-32 pb-24 selection:bg-[#25D366]/20 selection:text-black">
            <div className="max-w-3xl mx-auto px-6 md:px-12">
                <div className="mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#25D366]/10 text-[#25D366] text-sm font-medium mb-6">
                        <Lock size={16} />
                        Legal Information
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Data Retention Policy</h1>
                    <p className="text-lg text-black/60 leading-relaxed">
                        We do not hoard your data. What you delete stays deleted.
                    </p>
                </div>

                <div className="space-y-12 text-black/80 prose prose-lg prose-gray max-w-none">
                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-black flex items-center gap-3">
                            <span className="text-[#25D366]">1.</span> Active Accounts
                        </h2>
                        <p className="leading-relaxed">
                            We retain your basic account information only as long as your account remains active. This ensures you have continuous access to our services without interruption.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-black flex items-center gap-3">
                            <span className="text-[#25D366]">2.</span> Immediate Deletion
                        </h2>
                        <p className="leading-relaxed">
                            When you choose to delete your account, your personal data is immediately and permanently removed from our active databases. We do not keep shadow profiles or hidden backups of your personal information.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4 text-black flex items-center gap-3">
                            <span className="text-[#25D366]">3.</span> Decentralized Ledger Data
                        </h2>
                        <p className="leading-relaxed">
                            Due to the immutable nature of the blockchain, transaction records committed to the ledger cannot be altered or deleted. However, these records are mathematically proven to conceal your personal identity by design.
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
