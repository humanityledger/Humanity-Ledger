import React from 'react';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Users, Hash, Lock, Star, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function DirectoryPage() {
  let communities: any[] = [];
  try {
    communities = await prisma.community.findMany({
      where: { isPublic: true } as any,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { _count: { select: { members: true, channels: true } } }
    });
  } catch {
    communities = [];
  }

  return (
    <main className="min-h-screen bg-[#F2F2F7] py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-[32px] font-black text-[#1C1C1E] tracking-tight">Ledger Directory</h1>
          <p className="text-[16px] text-[#8E8E93] mt-2">Discover public communities and users on Humanity Ledger</p>
        </div>

        {/* Communities Grid */}
        <section>
          <h2 className="text-[20px] font-bold text-[#1C1C1E] mb-4">Public Communities</h2>
          {communities.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center">
              <Hash size={40} className="mx-auto text-[#C7C7CC] mb-4" />
              <p className="text-[#8E8E93] text-[15px]">No public communities yet. Be the first!</p>
              <Link href="/chat" className="mt-4 inline-block px-6 py-3 bg-[#25D366] text-white font-bold rounded-2xl hover:bg-[#128C7E] transition-colors">
                Create Community
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {communities.map((c) => (
                <div key={c.id} className="bg-white rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    {c.avatarUrl ? (
                      <img src={c.avatarUrl} alt="" className="w-12 h-12 rounded-2xl object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 flex items-center justify-center">
                        <Hash size={20} className="text-[#25D366]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[16px] font-bold text-[#1C1C1E] truncate">{c.name}</h3>
                        {c.isTokenGated && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 rounded-full text-[10px] font-bold text-amber-700">
                            <Lock size={9} /> Token-Gated
                          </span>
                        )}
                      </div>
                      {c.description && (
                        <p className="text-[13px] text-[#8E8E93] mt-0.5 line-clamp-2">{c.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1 text-[12px] text-[#8E8E93]">
                          <Users size={12} /> {c._count.members} members
                        </span>
                        <span className="flex items-center gap-1 text-[12px] text-[#8E8E93]">
                          <Hash size={12} /> {c._count.channels} channels
                        </span>
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/chat?community=${c.id}`}
                    className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-[#25D366]/10 hover:bg-[#25D366] text-[#25D366] hover:text-white font-semibold rounded-2xl text-[13px] transition-all"
                  >
                    <ExternalLink size={14} /> Join Community
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Call to action */}
        <div className="mt-12 bg-[#1C1C1E] rounded-3xl p-8 text-center">
          <h3 className="text-[22px] font-black text-white mb-2">Start your own community</h3>
          <p className="text-[14px] text-white/60 mb-6">Token-gated, private, or public. No App Store fees. Your rules.</p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold rounded-2xl text-[15px] transition-colors"
          >
            Open Ledger Chat
          </Link>
        </div>
      </div>
    </main>
  );
}
