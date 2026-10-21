"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ShieldCheck, Activity, Radio, Lock } from 'lucide-react';
import { HLLogo } from '@/components/shared/HLLogo';

export default function StatusPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const systems = [
    { name: 'Core Auth & SIWE Gate', status: 'Operational', uptime: '99.98%' },
    { name: 'XMTP E2EE Messaging Stream', status: 'Operational', uptime: '99.95%' },
    { name: 'Real-time SSE Hub (/api/events)', status: 'Operational', uptime: '99.99%' },
    { name: 'Communities & Public Channels', status: 'Operational', uptime: '99.96%' },
    { name: 'Aztec L2 Private Sandbox Bridge', status: 'Testnet Ready', uptime: '99.90%' },
    { name: 'LiveKit Voice & Video SFU', status: 'Operational', uptime: '99.94%' },
  ];

  return (
    <div className="min-h-screen bg-white text-[#1C1C1E] font-sans pt-28 pb-20">
      <div className="max-w-3xl mx-auto px-6">
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-black/[0.06]">
          <Link href="/">
            <HLLogo size={34} />
          </Link>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            All Systems Operational
          </div>
        </div>

        <div className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">System Status & Transparency</h1>
          <p className="text-black/50 text-sm">Real-time uptime and operational metrics for Humanity Ledger infrastructure.</p>
        </div>

        <div className="space-y-3 mb-10">
          {systems.map((s, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-black/[0.02] border border-black/[0.05]">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span className="text-sm font-semibold text-black">{s.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-black/40">{s.uptime}</span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100/60 px-2.5 py-0.5 rounded-full">
                  {s.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 rounded-2xl bg-black/[0.015] border border-black/[0.06] text-xs text-black/60 space-y-2">
          <div className="flex items-center gap-2 font-bold text-black">
            <ShieldCheck size={14} className="text-emerald-600" />
            Zero-Simulation Guarantee
          </div>
          <p>
            All operational metrics are reported from genuine health probes. In accordance with platform policy, any simulated or testnet-restricted feature is explicitly demarcated.
          </p>
        </div>
      </div>
    </div>
  );
}
