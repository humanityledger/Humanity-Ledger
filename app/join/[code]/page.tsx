import React from 'react';
import { prisma } from '@/lib/prisma';
import { Metadata } from 'next';
import { Shield, Users, Lock, Globe, ArrowRight, XCircle } from 'lucide-react';
import Link from 'next/link';

interface Props {
  params: { code: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = params.code.toUpperCase();
  const community = await (prisma as any).community.findUnique({
    where: { joinCode: code },
    include: { _count: { select: { members: true } } }
  }).catch(() => null);

  if (!community) {
    return {
      title: 'Invite Link Expired | Humanity Ledger',
      description: 'This invite link has expired or been revoked.',
    };
  }

  const title = community.isPrivate
    ? `${community.name} (Private Group) | Humanity Ledger`
    : `Join "${community.name}" on Humanity Ledger`;

  const description = community.isPrivate
    ? `${community.name} is a private group on Humanity Ledger. Entry requires admin approval.`
    : `${community._count.members} members. Join this secure, end-to-end encrypted community on Humanity Ledger.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: 'Humanity Ledger',
      type: 'website',
      url: `https://humanidfi.com/join/${code}`,
      images: [{
        url: `https://humanidfi.com/og-community.png`,
        width: 1200,
        height: 630,
        alt: community.name,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function JoinCommunityPage({ params }: Props) {
  const code = params.code.toUpperCase();

  const community = await (prisma as any).community.findUnique({
    where: { joinCode: code },
    include: { _count: { select: { members: true } } }
  }).catch(() => null);

  const AVATAR_COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#FF2D55'];

  // ── CASE 1: Link doesn't exist (revoked / expired) ──────────────────────────
  if (!community) {
    return (
      <Layout>
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-6 mx-auto">
          <XCircle size={36} />
        </div>
        <h1 className="text-[24px] font-black text-[#1C1C1E] mb-3 tracking-tight">Link Expired</h1>
        <p className="text-[14px] text-black/50 leading-relaxed mb-8 max-w-xs mx-auto">
          This invite link has expired or was revoked by the administrator. Ask the group admin for a new link.
        </p>
        <Link
          href="/chat"
          className="flex items-center justify-center gap-2 w-full max-w-xs mx-auto py-3.5 bg-[#1C1C1E] text-white rounded-2xl font-bold text-[15px] hover:bg-black/80 transition-all active:scale-95 shadow-lg"
        >
          Open Ledger Chat
        </Link>
      </Layout>
    );
  }

  const avatarColor = AVATAR_COLORS[parseInt(community.id.charCodeAt(0).toString(), 10) % AVATAR_COLORS.length];
  const memberCount = community._count.members;

  // ── CASE 2: Private group — show locked state ─────────────────────────────────
  if (community.isPrivate) {
    return (
      <Layout>
        <div
          className="w-28 h-28 rounded-[28px] flex items-center justify-center text-white text-4xl font-black shadow-[0_12px_24px_rgba(0,0,0,0.15)] mb-6 mx-auto"
          style={{ background: avatarColor }}
        >
          {community.name.slice(0, 2).toUpperCase()}
        </div>

        <div className="flex items-center gap-2 justify-center mb-2">
          <h1 className="text-[26px] font-black text-[#1C1C1E] tracking-tight">{community.name}</h1>
          <Lock size={18} className="text-black/30" />
        </div>

        <p className="text-[14px] text-black/50 leading-relaxed mb-5 max-w-xs mx-auto">
          {community.description || 'An encrypted private community on Humanity Ledger.'}
        </p>

        <div className="flex items-center justify-center gap-2 mb-8 bg-[#FAFAFA] px-4 py-2 rounded-xl border border-black/5 w-fit mx-auto">
          <Users size={14} className="text-black/40" />
          <span className="text-[13px] font-bold text-black/40">{memberCount} Members</span>
        </div>

        <div className="w-full max-w-xs mx-auto space-y-3">
          <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl px-5 py-4">
            <Lock size={20} className="text-red-400 shrink-0" />
            <p className="text-[13px] font-bold text-red-500 text-left leading-snug">
              This group is closed. New members cannot join via link. Contact the administrator to request access.
            </p>
          </div>
          <Link
            href="/chat"
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#1C1C1E] text-white rounded-2xl font-bold text-[15px] hover:bg-black/80 transition-all active:scale-95 shadow-lg"
          >
            Open Ledger Chat
          </Link>
        </div>
      </Layout>
    );
  }

  // ── CASE 3: Public group — allow joining ────────────────────────────────────
  return (
    <Layout>
      <div
        className="w-28 h-28 rounded-[28px] flex items-center justify-center text-white text-4xl font-black shadow-[0_12px_24px_rgba(0,0,0,0.15)] mb-6 mx-auto hover:rotate-0 rotate-3 transition-transform duration-500"
        style={{ background: avatarColor }}
      >
        {community.name.slice(0, 2).toUpperCase()}
      </div>

      <div className="flex items-center gap-1.5 justify-center mb-2">
        <h1 className="text-[26px] font-black text-[#1C1C1E] tracking-tight">{community.name}</h1>
        <Globe size={18} className="text-black/30" />
      </div>

      <p className="text-[15px] text-black/50 leading-relaxed mb-5 max-w-xs mx-auto">
        {community.description || 'A secure, end-to-end encrypted community on Humanity Ledger.'}
      </p>

      <div className="flex items-center gap-2 mb-8 bg-[#FAFAFA] px-4 py-2.5 rounded-xl border border-black/5 w-fit mx-auto">
        <Users size={16} className="text-[#007AFF]" />
        <span className="text-[14px] font-bold text-[#1C1C1E]">{memberCount} {memberCount === 1 ? 'Member' : 'Members'}</span>
      </div>

      <div className="w-full max-w-xs mx-auto space-y-3">
        {/* This links to /chat?join=CODE — LedgerChatV2 reads this on mount and auto-joins */}
        <Link
          href={`/chat?join=${code}`}
          className="flex items-center justify-center gap-2 w-full py-4 bg-[#007AFF] hover:bg-[#0062CC] text-white rounded-2xl font-black text-[16px] transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/25"
        >
          Join Community <ArrowRight size={18} />
        </Link>
        <p className="text-[12px] text-black/35 text-center px-2">
          You will need a Web3 wallet or email account. Your messages are end-to-end encrypted.
        </p>
      </div>
    </Layout>
  );
}

// ── Shared Layout wrapper ────────────────────────────────────────────────────
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-emerald-400/8 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full bg-white/95 backdrop-blur-xl rounded-[36px] px-8 py-10 shadow-[0_32px_80px_rgba(0,0,0,0.08)] flex flex-col items-center text-center border border-white/80 relative z-10">
        {children}
      </div>

      <div className="absolute bottom-8 flex items-center gap-2 opacity-35 hover:opacity-80 transition-opacity">
        <Shield size={13} className="text-black/50" />
        <Link href="/" className="text-[12px] font-bold text-black/50">Humanity Ledger · End-to-End Encrypted</Link>
      </div>
    </div>
  );
}
