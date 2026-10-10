"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Users, Hash, Lock, Globe, MessageCircle, ArrowLeft, Shield, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { SystemFooter } from '@/components/landing/SystemFooter';
import { HLLogo } from '@/components/shared/HLLogo';

export default function CommunityDetailPage() {
  const params = useParams();
  const [community, setCommunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(/api/communities/ + params.slug)
      .then(r => r.json())
      .then(d => {
        setCommunity(d.community);
        setLoading(false);
      });
  }, [params.slug]);

  const AVATAR_COLORS = ['#25D366','#34C759','#FF9500','#FF3B30','#AF52DE','#FF2D55', '#5856D6', '#007AFF'];
  const avatarColor = community ? (AVATAR_COLORS[parseInt(community.id.charCodeAt(0).toString(), 10) % AVATAR_COLORS.length] || '#25D366') : '#25D366';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F7F9] flex flex-col items-center justify-center">
        <span className="w-8 h-8 border-4 border-[#25D366]/20 border-t-[#25D366] rounded-full animate-spin" />
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-[#F6F7F9] flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Community not found</h1>
        <Link href="/communities" className="text-[#25D366] font-bold">? Back to Discover</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#1C1C1E] font-sans flex flex-col">
      <nav className="w-full bg-white/80 backdrop-blur-xl border-b border-black/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/communities" className="flex items-center gap-2 text-black/60 hover:text-black font-bold transition-colors">
            <ArrowLeft size={20} /> Back to Discover
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/chat" className="bg-[#1C1C1E] hover:bg-black text-white px-5 py-2.5 rounded-full text-[14px] font-bold shadow-md shadow-black/10 transition-all active:scale-95">
              Launch Client
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 md:py-20">
        <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-xl border border-black/[0.04]">
          <div className="flex flex-col md:flex-row gap-8 items-start mb-10">
            <div 
              className="w-32 h-32 md:w-40 md:h-40 rounded-[32px] flex items-center justify-center text-white font-black text-5xl md:text-6xl shrink-0 shadow-inner"
              style={{ background: avatarColor }}
            >
              {community.name.slice(0,2).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-5xl font-black tracking-tight">{community.name}</h1>
                {community.isPublic && (
                  <div className="bg-[#25D366]/10 text-[#25D366] px-3 py-1 rounded-full text-[12px] font-bold flex items-center gap-1.5 uppercase tracking-widest mt-2 md:mt-0">
                    <Globe size={14} /> Public
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <span className="bg-[#F6F7F9] px-4 py-1.5 rounded-xl text-[14px] font-bold text-black/60 flex items-center gap-2">
                  <Users size={16} /> {community._count?.members || 0} Members
                </span>
                <span className="bg-[#F6F7F9] px-4 py-1.5 rounded-xl text-[14px] font-bold text-black/60 flex items-center gap-2">
                  <Hash size={16} /> {community._count?.channels || 0} Channels
                </span>
                <span className="bg-[#F6F7F9] px-4 py-1.5 rounded-xl text-[14px] font-bold text-black/60 flex items-center gap-2">
                  <Shield size={16} /> E2E Encrypted
                </span>
              </div>
              <p className="text-[16px] md:text-[18px] text-[#1C1C1E]/70 font-medium leading-relaxed max-w-2xl">
                {community.description || 'This community has no description.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-10 border-t border-black/[0.04]">
            <div className="space-y-6">
              <h3 className="text-[20px] font-bold tracking-tight">Public Channels</h3>
              <div className="space-y-3">
                {community.channels?.length > 0 ? (
                  community.channels.map((ch: any) => (
                    <div key={ch.id} className="bg-[#F6F7F9] p-4 rounded-2xl flex items-center gap-3">
                      <Hash size={20} className="text-black/30" />
                      <div>
                        <p className="font-bold text-[15px]">{ch.name}</p>
                        <p className="text-[13px] text-black/50">{ch.isPrivate ? 'Private' : 'Public'} Channel</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-[#F6F7F9] p-4 rounded-2xl flex items-center gap-3">
                    <Hash size={20} className="text-black/30" />
                    <p className="font-bold text-[15px]"># general</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#F6F7F9] p-8 rounded-3xl flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm">
                <MessageCircle size={32} className="text-[#25D366]" />
              </div>
              <h3 className="text-[24px] font-bold mb-3">Join {community.name}</h3>
              <p className="text-[15px] text-[#1C1C1E]/60 font-medium mb-8 max-w-[250px]">
                Connect your wallet to join this community and start chatting securely.
              </p>
              <Link 
                href={/chat}
                className="w-full py-4 bg-[#25D366] hover:bg-[#20bd59] text-white rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/20 transition-all active:scale-95"
              >
                Launch Client to Join
              </Link>
              <div className="flex items-center gap-2 mt-5 text-[12px] font-bold text-black/40">
                <CheckCircle2 size={14} /> Free & Permissionless
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <SystemFooter />
    </div>
  );
}
