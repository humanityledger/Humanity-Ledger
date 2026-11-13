"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Users, Hash, Search, ChevronRight } from 'lucide-react';
import { SystemFooter } from '@/components/landing/SystemFooter';
import { HLLogo } from '@/components/shared/HLLogo';
import { formatCount } from '@/lib/communities/analytics';

interface PublicCommunity {
  id: string;
  name: string;
  description?: string | null;
  joinCode?: string | null;
  slug?: string | null;
  _count?: { members?: number; channels?: number };
}

type LoadState = 'loading' | 'ready' | 'error';

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<PublicCommunity[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/communities', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        setCommunities(Array.isArray(d?.communities) ? d.communities : []);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q),
    );
  }, [communities, search]);

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#15171C] flex flex-col">
      <nav className="w-full bg-white border-b border-[#E4E7EC] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HLLogo size={24} theme="dark" />
            <span className="font-semibold text-[15px] tracking-tight">Ledger Chat</span>
            <span className="text-[15px] text-[#A3A9B4]">/</span>
            <span className="text-[15px] text-[#475061]">Communities</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/protocol"
              className="h-9 px-3 inline-flex items-center text-[13px] font-medium text-[#475061] hover:text-[#15171C] transition-colors duration-150 ease-out"
            >
              Protocol
            </Link>
            <Link
              href="/chat"
              className="h-9 px-4 inline-flex items-center bg-[#15171C] hover:bg-[#2B2F38] text-white rounded-xl text-[13px] font-medium transition-colors duration-150 ease-out"
            >
              Open Ledger Chat
            </Link>
          </div>
        </div>
      </nav>

      <header className="bg-white border-b border-[#E4E7EC]">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <h1 className="text-[28px] font-semibold tracking-tight">Public communities</h1>
          <p className="mt-1 text-[14px] text-[#727A88] max-w-xl">
            Communities that chose to be listed. Joining opens Ledger Chat and requires signing in with your wallet.
          </p>
          <div className="mt-6 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#727A88]" size={16} strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Search by name or description"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 bg-white border border-[#E4E7EC] rounded-xl text-[14px] outline-none focus:border-[#2754D6] transition-colors duration-150 ease-out placeholder:text-[#A3A9B4]"
            />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {state === 'loading' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-44 bg-[#EFF1F4] rounded-2xl" aria-hidden />
            ))}
          </div>
        ) : state === 'error' ? (
          <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 max-w-md">
            <h2 className="text-[14px] font-semibold">The list could not be read</h2>
            <p className="mt-1 text-[13px] text-[#475061]">The server did not answer. Try again in a moment.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 max-w-md">
            <h2 className="text-[14px] font-semibold">No public communities</h2>
            <p className="mt-1 text-[13px] text-[#475061]">
              {search ? 'Nothing matches this search.' : 'No community is listed yet. You can create one in Ledger Chat.'}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/chat?join=${encodeURIComponent(c.joinCode || c.slug || c.id)}`}
                  className="group h-full flex flex-col bg-white rounded-2xl border border-[#E4E7EC] hover:border-[#D0D5DD] p-5 transition-colors duration-150 ease-out"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#15171C] text-white text-[13px] font-semibold flex items-center justify-center shrink-0">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold truncate">{c.name}</h3>
                      <div className="mt-0.5 flex items-center gap-3 text-[12px] text-[#727A88] tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Users size={12} strokeWidth={1.5} /> {formatCount(c._count?.members)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Hash size={12} strokeWidth={1.5} /> {formatCount(c._count?.channels)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] text-[#475061] leading-relaxed flex-1 line-clamp-3">
                    {c.description || 'No description.'}
                  </p>
                  <div className="mt-4 pt-3 border-t border-[#E4E7EC] flex items-center justify-between text-[13px]">
                    <span className="text-[#727A88]">Public</span>
                    <span className="inline-flex items-center gap-0.5 font-medium text-[#15171C]">
                      Open <ChevronRight size={14} strokeWidth={1.5} />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <SystemFooter />
    </div>
  );
}
