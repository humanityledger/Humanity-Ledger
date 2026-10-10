"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Hash, Plus, Search, Globe, Lock } from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-black font-sans pb-20">
      
      {/* Header */}
      <div className="bg-white border-b border-black/10 px-8 py-12 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black tracking-tighter mb-2">Communities</h1>
            <p className="text-[14px] text-black/60 font-mono">Discover public spaces, or create your own token-gated community.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40" size={18} />
              <input 
                type="text" 
                placeholder="Search communities..." 
                className="w-full md:w-64 pl-12 pr-4 py-3 bg-black/5 rounded-2xl text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#25D366]/50 transition-all border border-transparent"
              />
            </div>
            <button className="flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-2xl font-black text-[13px] uppercase tracking-widest hover:bg-[#20bd5a] transition-colors shadow-sm active:scale-95">
              <Plus size={18} /> Create
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-8 py-12">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-64 bg-black/5 rounded-[32px]"></div>
            ))}
          </div>
        ) : communities.length === 0 ? (
          <div className="text-center py-20">
            <Globe className="mx-auto text-black/20 mb-4" size={48} />
            <h3 className="text-xl font-bold text-black mb-2">No communities yet</h3>
            <p className="text-black/50 font-mono">Be the first to create one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {communities.map(c => (
              <Link href={`/communities/${c.slug}`} key={c.id}>
                <div className="bg-white rounded-[32px] p-6 border border-black/5 hover:border-[#25D366]/30 hover:shadow-xl hover:shadow-[#25D366]/5 transition-all group h-full flex flex-col cursor-pointer">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#25D366]/20 to-[#25D366]/5 flex items-center justify-center text-2xl font-black text-[#25D366]">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-[18px] font-black tracking-tight group-hover:text-[#25D366] transition-colors">{c.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-mono font-bold bg-black/5 px-2 py-0.5 rounded-lg text-black/60 flex items-center gap-1">
                          <Users size={12} /> {c._count?.members || 0}
                        </span>
                        <span className="text-[11px] font-mono font-bold bg-black/5 px-2 py-0.5 rounded-lg text-black/60 flex items-center gap-1">
                          <Hash size={12} /> {c._count?.channels || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[13px] text-black/60 leading-relaxed font-mono flex-1 line-clamp-3">
                    {c.description || 'Welcome to our community. Join us to chat and share.'}
                  </p>
                  <div className="mt-6 pt-6 border-t border-black/5 flex items-center justify-between">
                    <span className="text-[11px] font-black text-black/30 uppercase tracking-widest">ledger chat</span>
                    <span className="text-[12px] font-bold text-[#25D366] group-hover:translate-x-1 transition-transform">Join →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
