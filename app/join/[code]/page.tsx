import React from 'react';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { Shield, Users, Lock, Globe, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface Props {
  params: { code: string };
}

// Generate rich OpenGraph metadata for iMessage / Twitter / Telegram
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = params.code.toUpperCase();
  const community = await (prisma as any).community.findUnique({
    where: { joinCode: code },
    include: { _count: { select: { members: true } } }
  });

  if (!community) {
    return { title: 'Link Expired | Humanity Ledger' };
  }

  return {
    title: `Join "${community.name}" on Humanity Ledger`,
    description: community.isPrivate 
      ? `You have been invited to a private end-to-end encrypted group.` 
      : `${community._count.members} members are in this community. Join the conversation securely.`,
    openGraph: {
      title: `Join ${community.name}`,
      description: community.description || 'Secure End-to-End Encrypted Community',
      siteName: 'Humanity Ledger',
      images: ['/social-invite-bg.jpg'],
    },
  };
}

export default async function JoinCommunityPage({ params }: Props) {
  const code = params.code.toUpperCase();
  const community = await (prisma as any).community.findUnique({
    where: { joinCode: code },
    include: { _count: { select: { members: true } } }
  });

  if (!community) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center border border-black/5">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-6">
            <Shield size={32} />
          </div>
          <h1 className="text-[22px] font-black text-[#1C1C1E] mb-2 tracking-tight">Link Invalid</h1>
          <p className="text-[14px] text-black/50 leading-relaxed mb-8">
            This invitation link has expired, was revoked by the administrator, or the community no longer exists.
          </p>
          <Link href="/chat" className="w-full py-3.5 bg-black text-white rounded-xl font-bold text-[15px] hover:bg-black/80 transition-transform active:scale-95 shadow-lg">
            Return to App
          </Link>
        </div>
      </div>
    );
  }

  const AVATAR_COLORS = ['#007AFF','#34C759','#FF9500','#FF3B30','#AF52DE','#FF2D55'];
  const avatarColor = AVATAR_COLORS[parseInt(community.id.charCodeAt(0).toString(), 10) % AVATAR_COLORS.length];

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full bg-white/90 backdrop-blur-xl rounded-[32px] p-8 shadow-2xl flex flex-col items-center text-center border border-white relative z-10">
        
        {/* Avatar */}
        <div 
          className="w-28 h-28 rounded-[28px] flex items-center justify-center text-white text-4xl font-black shadow-[0_12px_24px_rgba(0,0,0,0.15)] mb-6 rotate-3 hover:rotate-0 transition-transform duration-500"
          style={{ background: avatarColor }}
        >
          {community.name.slice(0, 2).toUpperCase()}
        </div>

        <div className="flex items-center gap-1.5 justify-center mb-2">
          <h1 className="text-[26px] font-black text-[#1C1C1E] tracking-tight">{community.name}</h1>
          {community.isPrivate ? <Lock size={18} className="text-black/30" /> : <Globe size={18} className="text-black/30" />}
        </div>

        <p className="text-[15px] text-black/50 leading-relaxed mb-6">
          {community.description || 'Welcome to our secure end-to-end encrypted community on Humanity Ledger.'}
        </p>

        <div className="flex items-center gap-2 mb-8 bg-[#FAFAFA] px-4 py-2 rounded-xl border border-black/5">
          <Users size={16} className="text-[#007AFF]" />
          <span className="text-[14px] font-bold text-[#1C1C1E]">{community._count.members} Members</span>
        </div>

        <div className="w-full space-y-3">
          <Link 
            href={`/chat?join=${code}`} 
            className="w-full flex items-center justify-center gap-2 py-4 bg-[#007AFF] hover:bg-[#0066CC] text-white rounded-2xl font-black text-[16px] transition-transform active:scale-[0.98] shadow-lg shadow-blue-500/25"
          >
            Join Community <ArrowRight size={18} />
          </Link>
          
          <p className="text-[12px] text-black/40 px-4">
            If you don't have an account, you will be prompted to connect your Web3 wallet or Email first.
          </p>
        </div>

      </div>

      {/* Powered by tag */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center opacity-40 hover:opacity-100 transition-opacity">
        <Link href="/" className="flex items-center gap-2 text-[12px] font-bold text-black/50">
          <Shield size={14} /> Powered by Humanity Ledger
        </Link>
      </div>
    </div>
  );
}
