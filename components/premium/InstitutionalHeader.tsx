"use client";

import { useState } from 'react';
import { Search, Bell, Clock, Eye, Settings, User, Wallet } from 'lucide-react';
import { useNativeWallet } from '@/hooks/useNativeWallet';
import { useSystemSignOut } from '@/hooks/useSystemSignOut';
import { HLLogo } from '@/components/shared/HLLogo';

export default function InstitutionalHeader() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const { address, isConnecting, connect, formatAddress } = useNativeWallet();
  const { nuclearDisconnect } = useSystemSignOut();

  const handleDisconnect = async () => {
    await nuclearDisconnect();
  };

  const handleMenuAction = async (actionId: string, payload?: any) => {
    try {
      const res = await fetch('/api/sovereign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionId, payload }),
      });
      const data = await res.json();
      console.log('Protocol Action:', data.message);
      setActiveMenu(null);
    } catch (e) {
      console.error('Failed to communicate with the Humanity Ledger backend.', e);
    }
  };

  return (
    <div className="w-full flex flex-col font-sans uppercase tracking-[0.15em] text-[10px] text-[#0A0A0A] bg-[#FFFFFF] border-b border-black/5 relative z-50 selection:bg-black/10">
      
      {/* Layer 1: Protocol Menu & Connectivity Status */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-black/5 bg-white/50 backdrop-blur-md">
        <div className="flex items-center gap-6 font-black">
          <div className="relative" onMouseLeave={() => setActiveMenu(null)}>
            <button 
              onMouseEnter={() => setActiveMenu('file')}
              className="hover:text-black opacity-40 hover:opacity-100 transition-opacity"
            >
              Protocol
            </button>
            {activeMenu === 'file' && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-black/10 shadow-2xl py-2 z-50 rounded-xl overflow-hidden">
                <button onClick={() => handleMenuAction('file_save')} className="w-full text-left px-5 py-3 hover:bg-[#FFFFFF] transition-colors text-[9px]">Commit State</button>
                <button onClick={() => handleMenuAction('file_export')} className="w-full text-left px-5 py-3 hover:bg-[#FFFFFF] transition-colors text-[9px]">Export Ledger</button>
              </div>
            )}
          </div>
          
          <div className="relative" onMouseLeave={() => setActiveMenu(null)}>
            <button 
              onMouseEnter={() => setActiveMenu('edit')}
              className="hover:text-black opacity-40 hover:opacity-100 transition-opacity"
            >
              Edit
            </button>
            {activeMenu === 'edit' && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-black/10 shadow-2xl py-2 z-50 rounded-xl overflow-hidden">
                <button onClick={() => handleMenuAction('edit_preferences')} className="w-full text-left px-5 py-3 hover:bg-[#FFFFFF] transition-colors text-[9px]">Preferences</button>
              </div>
            )}
          </div>

          <div className="relative" onMouseLeave={() => setActiveMenu(null)}>
             <button 
               onMouseEnter={() => setActiveMenu('view')}
               className="hover:text-black opacity-40 hover:opacity-100 transition-opacity"
             >
               View
             </button>
             {activeMenu === 'view' && (
               <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-black/10 shadow-2xl py-2 z-50 rounded-xl overflow-hidden">
                 <button onClick={() => handleMenuAction('view_toggle_mode', 'sovereign')} className="w-full text-left px-5 py-3 hover:bg-[#FFFFFF] transition-colors text-[9px]">Forensic Mode</button>
                 <button onClick={() => handleMenuAction('view_toggle_mode', 'standard')} className="w-full text-left px-5 py-3 hover:bg-[#FFFFFF] transition-colors text-[9px]">Standard Mode</button>
               </div>
             )}
          </div>

          <div className="relative" onMouseLeave={() => setActiveMenu(null)}>
             <button 
               onMouseEnter={() => setActiveMenu('analytics')}
               className="hover:text-black opacity-40 hover:opacity-100 transition-opacity"
             >
               Analytics
             </button>
             {activeMenu === 'analytics' && (
               <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-black/10 shadow-2xl py-2 z-50 rounded-xl overflow-hidden">
                 <button onClick={() => handleMenuAction('analytics_generate')} className="w-full text-left px-5 py-3 hover:bg-[#FFFFFF] transition-colors text-[9px]">Run Deterministic Scan</button>
               </div>
             )}
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-[9px] font-black">
          <span className="text-black/30">IDENTIFIER: {address ? `${address.slice(0, 10)}...${address.slice(-4)}` : 'NULL'}</span>
          <div className="flex items-center gap-1.5 bg-black/5 px-2.5 py-1 rounded-full border border-black/5">
            <div className="w-1 h-1 rounded-full bg-black/40" />
            <span className="text-black/60 tracking-[0.2em]">{address ? 'ESTABLISHED' : 'VOID'}</span>
          </div>
        </div>
      </div>

      {/* Layer 2: Core Navigation & Utilities */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-black/5">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <HLLogo variant="mark" size={28} />
              <span className="font-black text-lg tracking-tight">Humanity Ledger NETWORK</span>
            </div>
            <nav className="flex items-center gap-8 font-black">
              <button className="hover:text-black transition-opacity text-black">TELEMETRY</button>
              <button className="hover:text-black opacity-30 hover:opacity-100 transition-opacity">NETWORK</button>
              <button className="hover:text-black opacity-30 hover:opacity-100 transition-opacity">LEDGER</button>
            </nav>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-5 opacity-30">
            <Search size={16} className="hover:opacity-100 cursor-pointer transition-opacity" />
            <div className="relative">
              <Bell size={16} className="hover:opacity-100 cursor-pointer transition-opacity" />
              <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-black rounded-full" />
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-black/5 rounded-lg border border-black/5">
              <span className="text-[8px] font-black">USD</span>
              <Settings size={10} />
            </div>
            <Clock size={16} className="hover:opacity-100 cursor-pointer transition-opacity" />
            <Eye size={16} className="hover:opacity-100 cursor-pointer transition-opacity" />
            <Settings size={16} className="hover:opacity-100 cursor-pointer transition-opacity" />
          </div>

          {address ? (
            <div 
              onClick={handleDisconnect}
              className="flex items-center gap-4 bg-black text-white px-5 py-2.5 rounded-2xl shadow-xl shadow-black/10 cursor-pointer hover:bg-black/80 transition-all active:scale-95 group"
            >
              <div className="flex flex-col text-right">
                 <span className="font-mono font-bold text-[10px] leading-tight opacity-90">{formatAddress(address)}</span>
                 <span className="font-black text-[8px] leading-tight opacity-40 group-hover:opacity-100 transition-opacity">TERMINATE SESSION</span>
              </div>
              <div className="bg-white/10 p-1.5 rounded-xl">
                 <User size={14} className="text-white" />
              </div>
            </div>
          ) : (
            <button 
              onClick={connect}
              disabled={isConnecting}
              className="flex items-center gap-3 bg-black text-white px-7 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-black/80 transition-all active:scale-95 disabled:opacity-20 shadow-xl shadow-black/10"
            >
              {isConnecting ? <Clock size={16} className="animate-spin" /> : <Wallet size={16} />}
              <span>{isConnecting ? 'Authenticating...' : 'Connect Identity'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Layer 3: Global Metrics Bar */}
      <div className="flex items-center gap-12 px-6 py-2.5 font-black text-[9px] overflow-x-auto whitespace-nowrap scrollbar-hide bg-white/30 backdrop-blur-sm">
        <div className="flex items-center gap-2">
            <span className="text-black/20">TOTAL CAPITALIZATION</span>
            <span className="text-black">$4.27T</span>
            <span className="text-black/40 font-serif italic">+0.82%</span>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-black/20">AGGREGATE VOLUME</span>
            <span className="text-black">$182.4B</span>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-black/20">VERIFIED IDENTITIES</span>
            <span className="text-black">1,240,891</span>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-black/20">PROTOCOL STABILITY</span>
            <span className="text-black">100.00%</span>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-black/20">NETWORK LATENCY</span>
            <span className="text-black">12MS</span>
        </div>
      </div>
    </div>
  );
}
