"use client";

import React from 'react';
import { CheckCircle, Activity, Server, Database, Shield, Zap, RefreshCcw } from 'lucide-react';

const metrics = [
  { name: 'Aztec PXE Nodes', uptime: '99.99%', status: 'Operational', icon: Shield },
  { name: 'Relayer Network', uptime: '100.00%', status: 'Operational', icon: Server },
  { name: 'Messaging CRDT', uptime: '99.99%', status: 'Operational', icon: Database },
  { name: 'Proof Generation', uptime: '99.95%', status: 'Operational', icon: Zap },
  { name: 'Indexers & APIs', uptime: '99.98%', status: 'Operational', icon: Activity },
];

export default function StatusPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 selection:bg-neutral-200 font-sans">
      <div className="max-w-4xl mx-auto px-6 py-24">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-6 mb-20">
          <div className="h-16 w-16 bg-neutral-100 rounded-3xl flex items-center justify-center border border-neutral-200">
            <Activity className="w-8 h-8 text-neutral-800" strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-neutral-900">
            System Status
          </h1>
          <p className="text-lg text-neutral-500 max-w-xl font-light">
            All systems operating at peak performance. Real-time metrics for our global infrastructure and core services.
          </p>
        </div>

        {/* Overall Status Banner */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-8 flex items-center space-x-6 mb-16 shadow-sm">
          <div className="flex-shrink-0">
            <CheckCircle className="w-12 h-12 text-emerald-500" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-2xl font-medium text-emerald-900 mb-1">All Systems Operational</h2>
            <p className="text-emerald-700 font-light">Last updated: Just now</p>
          </div>
        </div>

        {/* Services */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold mb-6 px-4">Core Infrastructure</h3>
          {metrics.map((item, idx) => (
            <div key={idx} className="group p-6 rounded-2xl bg-white border border-neutral-100 hover:border-neutral-200 transition-all duration-300 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] flex items-center justify-between">
              <div className="flex items-center space-x-5">
                <div className="p-3 rounded-xl bg-neutral-50 text-neutral-600 group-hover:scale-105 group-hover:bg-neutral-100 transition-all">
                  <item.icon className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="font-medium text-neutral-900 text-lg mb-0.5">{item.name}</div>
                  <div className="text-sm text-neutral-500 font-light">Uptime: <span className="font-medium text-neutral-700">{item.uptime}</span> over last 90 days</div>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-sm font-medium">{item.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="mt-20 text-center flex flex-col items-center justify-center space-y-4">
          <div className="inline-flex items-center space-x-2 text-sm text-neutral-400">
            <RefreshCcw className="w-4 h-4" />
            <span>Metrics are updated in real-time</span>
          </div>
        </div>
      </div>
    </div>
  );
}
