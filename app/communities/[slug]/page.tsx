"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Users, Hash, Lock, ChevronLeft, MessageSquare, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function CommunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [community, setCommunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetch(`/api/communities/${params.slug}`)
      .then(r => r.json())
      .then(d => {
        setCommunity(d.community);
        setLoading(false);
      });
  }, [params.slug]);

  const handleJoin = async () => {
    setJoining(true);
    await fetch(`/api/communities/${params.slug}/join`, { method: 'POST' });
    router.push('/chat'); // For now, joining just returns to chat
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <Loader2 className="animate-spin text-black/20" size={32} />
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center">
        <h1 className="text-2xl font-black text-black mb-4">Community not found</h1>
        <Link href="/communities" className="text-[#25D366] font-bold">← Back to explorer</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-black font-sans flex flex-col md:flex-row">
      
      {/* Sidebar Channels */}
      <div className="w-full md:w-80 bg-white border-r border-black/10 flex flex-col shrink-0 min-h-screen">
        
        {/* Header */}
        <div className="p-6 border-b border-black/10">
          <Link href="/communities" className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-black/40 hover:text-black transition-colors mb-6">
            <ChevronLeft size={14} /> Back
          </Link>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#25D366]/10 flex items-center justify-center text-xl font-black text-[#25D366]">
              {community.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight leading-tight">{community.name}</h1>
              <span className="text-[11px] font-mono font-bold text-black/40 flex items-center gap-1 mt-1">
                <Users size={12} /> {community._count?.members || 0} members
              </span>
            </div>
          </div>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
          <div className="text-[10px] font-black uppercase tracking-widest text-black/30 mb-2 px-3">Channels</div>
          
          {community.channels?.map((channel: any) => {
            const isLocked = channel.accessType !== 'free';
            return (
              <button 
                key={channel.id}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group
                  ${isLocked ? 'hover:bg-black/5 opacity-70' : 'hover:bg-black/5'}
                `}
              >
                <div className="flex items-center gap-3">
                  {isLocked ? (
                    <Lock size={16} className="text-black/40" />
                  ) : (
                    <Hash size={16} className="text-black/40 group-hover:text-black transition-colors" />
                  )}
                  <span className={`text-[13px] font-bold ${isLocked ? 'text-black/60' : 'text-black'}`}>
                    {channel.name}
                  </span>
                </div>
                {isLocked && channel.priceUsd && (
                  <span className="text-[10px] font-black bg-[#25D366]/10 text-[#25D366] px-2 py-0.5 rounded-md">
                    ${channel.priceUsd}
                  </span>
                )}
              </button>
            );
          })}
        </div>

      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#F8F9FA]">
        <div className="max-w-md w-full bg-white rounded-[32px] p-8 border border-black/5 shadow-xl shadow-black/5 text-center">
          <div className="w-20 h-20 rounded-full bg-[#25D366]/10 flex items-center justify-center mx-auto mb-6">
            <MessageSquare size={32} className="text-[#25D366]" />
          </div>
          <h2 className="text-2xl font-black mb-3">Join {community.name}</h2>
          <p className="text-[14px] text-black/60 font-mono leading-relaxed mb-8">
            {community.description || 'Join this community to access channels, chat with members, and discover exclusive content.'}
          </p>
          
          <button 
            onClick={handleJoin}
            disabled={joining}
            className="w-full py-4 rounded-2xl bg-[#25D366] text-white text-[13px] font-black uppercase tracking-widest hover:bg-[#20bd5a] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {joining ? <Loader2 className="animate-spin" size={18} /> : 'Join Community'}
          </button>
        </div>
      </div>

    </div>
  );
}
