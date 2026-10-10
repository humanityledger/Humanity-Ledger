"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Hash, Plus, Search, Globe, ChevronRight, Compass, Shield } from 'lucide-react';
import { SystemFooter } from '@/components/landing/SystemFooter';
import { HLLogo } from '@/components/shared/HLLogo';

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/communities')
      .then(r => r.json())
      .then(d => {
        setCommunities(d.communities || []);
        setLoading(false);
      });
  }, []);

  const AVATAR_COLORS = ['#25D366','#34C759','#FF9500','#FF3B30','#AF52DE','#FF2D55', '#5856D6', '#007AFF'];
  const avatarColor = (id: string) => AVATAR_COLORS[parseInt(id.charCodeAt(0).toString(), 10) % AVATAR_COLORS.length] || '#25D366';

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#1C1C1E] font-sans flex flex-col">
      
      {/* ── Navbar ── */}
      <nav className="w-full bg-white/80 backdrop-blur-xl border-b border-black/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <HLLogo size={28} theme="dark" />
            <span className="font-bold text-[18px] tracking-tight">Ledger Chat</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/chat" className="text-[14px] font-bold text-black/60 hover:text-black transition-colors">Open Web App</Link>
            <Link href="/chat" className="bg-[#1C1C1E] hover:bg-black text-white px-5 py-2.5 rounded-full text-[14px] font-bold shadow-md shadow-black/10 transition-all active:scale-95">
              Launch Client
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Header ── */}
      <div className="bg-white px-6 py-20 border-b border-black/[0.04]">
        <div className="max-w-6xl mx-auto text-center">
          <div className="w-16 h-16 mx-auto bg-[#F6F7F9] rounded-2xl flex items-center justify-center mb-6">
            <Compass size={32} className="text-[#25D366]" />
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4">Discover Communities</h1>
          <p className="text-[18px] text-[#1C1C1E]/50 font-medium max-w-2xl mx-auto mb-10">
            Explore sovereign, end-to-end encrypted spaces. Join DAOs, projects, and groups building on the Humanity Ledger protocol.
          </p>
          
          <div className="max-w-xl mx-auto relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-black/40 group-focus-within:text-[#25D366] transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Search public communities..." 
              className="w-full pl-14 pr-6 py-4 bg-[#F6F7F9] rounded-2xl text-[16px] font-medium outline-none border border-transparent focus:border-[#25D366]/30 focus:bg-white focus:ring-4 focus:ring-[#25D366]/10 transition-all shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-16">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-48 bg-black/5 rounded-3xl"></div>
            ))}
          </div>
        ) : communities.length === 0 ? (
          <div className="text-center py-20">
            <Globe className="mx-auto text-black/20 mb-4" size={48} />
            <h3 className="text-xl font-bold text-black mb-2">No public communities yet</h3>
            <p className="text-black/50 font-medium">Open Ledger Chat to create the first public space.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {communities.map(c => (
              <Link href={`/communities/${c.slug}`} key={c.id}>
                <div className="bg-white rounded-3xl p-6 border border-black/[0.04] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group h-full flex flex-col cursor-pointer">
                  <div className="flex items-center gap-4 mb-4">
                    <div 
                      className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shrink-0 shadow-inner"
                      style={{ background: avatarColor(c.id) }}
                    >
                      {c.name.slice(0,2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-[18px] font-bold text-[#1C1C1E] truncate group-hover:text-[#25D366] transition-colors">{c.name}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold bg-[#F6F7F9] px-2 py-1 rounded-md text-black/60 flex items-center gap-1.5">
                          <Users size={12} /> {c._count?.members || 0}
                        </span>
                        <span className="text-[12px] font-bold bg-[#F6F7F9] px-2 py-1 rounded-md text-black/60 flex items-center gap-1.5">
                          <Hash size={12} /> {c._count?.channels || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-[14px] text-[#1C1C1E]/60 leading-relaxed font-medium flex-1 line-clamp-3 mb-6">
                    {c.description || 'Welcome to our secure public community on Ledger Chat.'}
                  </p>
                  
                  <div className="pt-5 border-t border-black/[0.04] flex items-center justify-between">
                    <span className="text-[11px] font-bold text-black/30 uppercase tracking-widest flex items-center gap-1">
                      <Globe size={12} /> Public Space
                    </span>
                    <span className="text-[14px] font-bold text-[#25D366] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      View Profile <ChevronRight size={16} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <SystemFooter />
    </div>
  );
}
