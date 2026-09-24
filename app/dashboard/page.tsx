import React from 'react';
import { IdentityZkPortal } from '@/components/mini-apps/IdentityZkPortal';
import { GovernanceDao } from '@/components/mini-apps/GovernanceDao';
import { StudioProvenance } from '@/components/mini-apps/StudioProvenance';
import { RegistryRWA } from '@/components/mini-apps/RegistryRWA';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#FDFDFD] text-black font-sans flex flex-col md:flex-row">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 border-r border-black/5 bg-white flex flex-col p-6 sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-8 h-8 bg-black rounded-full"></div>
          <h1 className="font-bold text-lg tracking-tight">Humanity Ledger</h1>
        </div>
        
        <nav className="flex flex-col gap-2 flex-1">
          <a href="#" className="px-4 py-2.5 rounded-xl bg-black text-white text-sm font-medium">Dashboard</a>
          <a href="/chat" className="px-4 py-2.5 rounded-xl hover:bg-black/5 text-black/60 text-sm font-medium transition-colors">Ledger Chat</a>
          <a href="#" className="px-4 py-2.5 rounded-xl hover:bg-black/5 text-black/60 text-sm font-medium transition-colors">Portfolio & Markets</a>
          <a href="#" className="px-4 py-2.5 rounded-xl hover:bg-black/5 text-black/60 text-sm font-medium transition-colors">Network & Nodes</a>
        </nav>
        
        <div className="mt-auto pt-6 border-t border-black/5">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-400 to-blue-500"></div>
            <div>
              <p className="text-xs font-bold">Stefan's Vault</p>
              <p className="text-[10px] text-black/40">Secured by TuringShield</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 lg:p-14 overflow-y-auto">
        <header className="mb-10">
          <h2 className="text-3xl font-bold tracking-tight mb-2">Sovereign Ecosystem</h2>
          <p className="text-black/60">Manage your identity, governance, and assets across the AppChain.</p>
        </header>

        {/* Masonry Grid for Mini-Apps */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <IdentityZkPortal />
          <GovernanceDao />
          <RegistryRWA />
          <StudioProvenance />
        </div>
      </main>
      
    </div>
  );
}
