"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Hash, Plus, Search, Globe, ChevronRight, Compass } from 'lucide-react';
import { SystemFooter } from '@/components/landing/SystemFooter';
import { HLLogo } from '@/components/shared/HLLogo';

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/communities')
      .then(r => r.json())
      .then(d => {
        setCommunities(d.communities || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = communities.filter(c => 
    !search.trim() ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#f2f4f7] text-[#15171c] font-sans flex flex-col">
      
      {/* ── Navbar ── */}
      <nav className="w-full bg-white/90 backdrop-blur-xl border-b border-black/[0.06] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HLLogo size={28} theme="dark" />
            <span className="font-bold text-[17px] text-[#15171c] tracking-tight">Ledger Communities</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/chat" className="text-[13.5px] font-semibold text-[#727a88] hover:text-[#15171c] transition-colors">
              Open Web App
            </Link>
            <Link href="/chat" className="bg-[#15171c] hover:bg-black text-white px-5 py-2.5 rounded-full text-[13.5px] font-semibold shadow-sm transition-all active:scale-95">
              Launch Client
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Header ── */}
      <div className="bg-white px-6 py-16 border-b border-black/[0.06]">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="w-14 h-14 mx-auto bg-[#f2f4f7] rounded-2xl flex items-center justify-center text-[#15171c] shadow-xs">
            <Compass size={26} strokeWidth={2} />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-[#15171c]">
            Discover Communities
          </h1>
          <p className="text-[16px] text-[#727a88] font-normal max-w-xl mx-auto leading-relaxed">
            Explore sovereign, cryptographically secured spaces. Join groups, DAOs, and developer teams built on Humanity Ledger.
          </p>
          
          <div className="max-w-lg mx-auto relative pt-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 mt-1 text-[#727a88]" size={18} />
            <input 
              type="text" 
              placeholder="Search public communities..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-5 py-3.5 bg-[#f2f4f7] rounded-2xl text-[14px] font-medium text-[#15171c] outline-none border border-transparent focus:border-[#15171c] focus:bg-white transition-all shadow-inner placeholder:text-[#a3a9b4]"
            />
          </div>
        </div>
      </div>

      {/* ── Grid: Group Previews ── */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-12">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-52 bg-white rounded-3xl border border-black/[0.04]"></div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-black/[0.06] p-8 max-w-md mx-auto shadow-sm">
            <Globe className="mx-auto text-[#727a88] mb-3" size={40} strokeWidth={1.5} />
            <h3 className="text-lg font-bold text-[#15171c] mb-1">No public communities found</h3>
            <p className="text-[#727a88] text-sm leading-relaxed">
              {search ? 'Try adjusting your search terms.' : 'Open Ledger Chat to create the first sovereign community.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(c => (
              <Link href={`/chat?join=${c.joinCode || c.slug || c.id}`} key={c.id}>
                <div className="bg-white rounded-3xl p-6 border border-black/[0.06] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group h-full flex flex-col cursor-pointer">
                  
                  {/* Top: Avatar & Name */}
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="w-13 h-13 rounded-2xl bg-[#15171c] text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-sm">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[17px] font-bold text-[#15171c] truncate group-hover:text-black transition-colors">
                        {c.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-semibold bg-[#f2f4f7] px-2.5 py-0.5 rounded-lg text-[#15171c] flex items-center gap-1 font-mono">
                          <Users size={11} /> {c._count?.members || 1}
                        </span>
                        <span className="text-[11px] font-semibold bg-[#f2f4f7] px-2.5 py-0.5 rounded-lg text-[#15171c] flex items-center gap-1 font-mono">
                          <Hash size={11} /> {c._count?.channels || 1}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-[13.5px] text-[#727a88] leading-relaxed flex-1 line-clamp-3 mb-5">
                    {c.description || 'Welcome to this sovereign community on Humanity Ledger.'}
                  </p>
                  
                  <div className="pt-4 border-t border-black/[0.04] flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#727a88] uppercase tracking-wider flex items-center gap-1">
                      <Globe size={12} /> Public
                    </span>
                    <span className="text-[13px] font-semibold text-[#15171c] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      View Community <ChevronRight size={15} />
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
