import React from 'react';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ForumGroupsPage() {
  let groupsData = { ELITE: 0, PRO: 0, STANDARD: 0, FREE: 0, TOTAL: 0 };

  try {
    const groupCounts = await (prisma as any).user.groupBy({
      by: ['tier'],
      _count: { id: true },
    });
    let total = 0;
    groupCounts.forEach((g: any) => {
      const t = g.tier || 'FREE';
      if (t in groupsData) (groupsData as any)[t] += g._count.id;
      total += g._count.id;
    });
    groupsData.TOTAL = total;
  } catch {
    // tier column may not exist yet  silently show zero counts
    // (run /api/admin/sync-db to apply schema and reload)
  }

  const groups = [
    { id: 'ELITE',    label: 'Cryptographic Members',    sub: 'Full platform access  all features unlocked',  count: groupsData.ELITE    },
    { id: 'PRO',      label: 'Professional Members',  sub: 'Advanced analytics and real-time data access',  count: groupsData.PRO      },
    { id: 'STANDARD', label: 'Explorer Members',      sub: 'Market data and community access',               count: groupsData.STANDARD },
    { id: 'FREE',     label: 'Free Members',           sub: 'Forum and news access',                          count: groupsData.FREE     },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAF9] text-slate-900 w-full min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 py-10">

        {/* Breadcrumb & Header */}
        <div className="mb-8 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-2 text-[12px] font-sans font-bold text-slate-500">
            <Link href="/forum" className="transition-colors hover:text-[#0088cc]">Forum</Link>
            <span>/</span>
            <span className="text-slate-900">Groups</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[28px] md:text-[36px] font-black tracking-tight text-slate-900 leading-none mb-2">Member Groups</h1>
              <p className="text-[14px] text-slate-500 font-medium">Access levels and roles across the community.</p>
            </div>
            <div className="text-[14px] font-sans text-slate-500 hidden sm:block">
              Total: <span className="font-bold text-slate-900">{groupsData.TOTAL} Members</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
           {groups.map(g => (
             <div
               key={g.id}
               className="flex items-center py-5 px-6 rounded-xl transition-all duration-200 bg-white border border-slate-200 hover:border-[#0088cc] hover:shadow-sm"
             >
               <div className="flex-1 min-w-0">
                 <div className="text-[16px] font-sans font-bold transition-colors text-slate-900">
                   {g.label}
                 </div>
                 <div className="text-[13px] font-sans mt-1 text-slate-500">{g.sub}</div>
               </div>
               <div className="w-24 flex items-center justify-end gap-3">
                 <span className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400">Members</span>
                 <div className="text-[18px] font-sans font-black text-slate-900">
                   {g.count}
                 </div>
               </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}
