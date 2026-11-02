import React from 'react';
import { prisma } from '@/lib/prisma';
import { Metadata } from 'next';
import { Shield, Users, Lock, Globe, ArrowRight, XCircle } from 'lucide-react';
import Link from 'next/link';

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const code = resolvedParams.code.toUpperCase();
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
  const resolvedParams = await params;
  const code = resolvedParams.code.toUpperCase();

  const community = await (prisma as any).community.findUnique({
    where: { joinCode: code },
    include: { _count: { select: { members: true } } }
  }).catch(() => null);

  // ── CASE 1: Link doesn't exist (revoked / expired) ──────────────────────────
  if (!community) {
    return (
      <Layout>
        <div className="w-14 h-14 rounded-2xl bg-[#f2f4f7] flex items-center justify-center text-[#15171c] mb-6 mx-auto">
          <XCircle size={28} strokeWidth={2} />
        </div>
        <h1 className="text-[22px] font-bold text-[#15171c] mb-2 tracking-tight">Link Expired</h1>
        <p className="text-[14px] text-[#727a88] leading-relaxed mb-6 max-w-xs mx-auto">
          This invite link has expired or was revoked by the administrator. Ask the group admin for a new link.
        </p>
        <Link
          href="/chat"
          className="flex items-center justify-center gap-2 w-full max-w-xs mx-auto py-3 bg-[#15171c] hover:bg-black text-white rounded-xl font-semibold text-[14px] transition-all active:scale-95 shadow-sm"
        >
          Open Ledger Chat
        </Link>
      </Layout>
    );
  }

  const memberCount = community._count.members;

  // ── CASE 2: Private group — show locked state ─────────────────────────────────
  if (community.isPrivate) {
    return (
      <Layout>
        <div className="w-20 h-20 rounded-3xl bg-[#15171c] text-white text-3xl font-bold flex items-center justify-center shadow-sm mb-5 mx-auto">
          {community.name.slice(0, 2).toUpperCase()}
        </div>

        <div className="flex items-center gap-2 justify-center mb-1.5">
          <h1 className="text-[22px] font-bold text-[#15171c] tracking-tight">{community.name}</h1>
          <Lock size={16} className="text-[#727a88]" />
        </div>

        <p className="text-[14px] text-[#727a88] leading-relaxed mb-5 max-w-xs mx-auto">
          {community.description || 'An encrypted private community on Humanity Ledger.'}
        </p>

        <div className="flex items-center justify-center gap-2 mb-6 bg-[#f2f4f7] px-3.5 py-1.5 rounded-full border border-black/[0.04] w-fit mx-auto">
          <Users size={13} className="text-[#15171c]" />
          <span className="text-[12px] font-semibold text-[#15171c]">{memberCount} {memberCount === 1 ? 'Member' : 'Members'}</span>
        </div>

        <div className="w-full max-w-xs mx-auto space-y-3">
          <div className="bg-[#f2f4f7] border border-black/[0.05] rounded-2xl p-4 text-center">
            <p className="text-[12.5px] font-medium text-[#727a88] leading-relaxed">
              This group is private. New members must be invited directly by an administrator.
            </p>
          </div>
          <Link
            href="/chat"
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#15171c] hover:bg-black text-white rounded-xl font-semibold text-[14px] transition-all active:scale-95 shadow-sm"
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
      <div className="w-20 h-20 rounded-3xl bg-[#15171c] text-white text-3xl font-bold flex items-center justify-center shadow-sm mb-5 mx-auto">
        {community.name.slice(0, 2).toUpperCase()}
      </div>

      <div className="flex items-center gap-1.5 justify-center mb-1.5">
        <h1 className="text-[22px] font-bold text-[#15171c] tracking-tight">{community.name}</h1>
        <Globe size={16} className="text-[#727a88]" />
      </div>

      <p className="text-[14px] text-[#727a88] leading-relaxed mb-5 max-w-xs mx-auto">
        {community.description || 'A secure, cryptographically verified community on Humanity Ledger.'}
      </p>

      <div className="flex items-center gap-2 mb-6 bg-[#f2f4f7] px-3.5 py-1.5 rounded-full border border-black/[0.04] w-fit mx-auto">
        <Users size={13} className="text-[#15171c]" />
        <span className="text-[12px] font-semibold text-[#15171c]">{memberCount} {memberCount === 1 ? 'Member' : 'Members'}</span>
      </div>

      <div className="w-full max-w-xs mx-auto space-y-3">
        {/* This links to /chat?join=CODE — LedgerChatV2 reads this on mount and auto-joins */}
        <Link
          href={`/chat?join=${code}`}
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#15171c] hover:bg-black text-white rounded-xl font-semibold text-[15px] transition-all active:scale-95 shadow-sm"
        >
          Join Community <ArrowRight size={16} />
        </Link>
        <p className="text-[12px] text-[#727a88] text-center px-2">
          Connect with your Ethereum wallet. Messages and transactions are cryptographically signed.
        </p>
      </div>
    </Layout>
  );
}

// ── Shared Layout wrapper ────────────────────────────────────────────────────
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f2f4f7] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-sm border border-black/[0.06] flex flex-col items-center text-center relative z-10">
        {children}
      </div>

      <div className="mt-8 flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
        <Shield size={13} className="text-[#15171c]" />
        <Link href="/" className="text-[12px] font-semibold text-[#727a88] hover:text-[#15171c]">
          Humanity Ledger · Sovereign Protocol
        </Link>
      </div>
    </div>
  );
}
