import React from 'react';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';

export function LedgerChatLink() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 my-12">
      <Link href="/chat" className="group flex flex-col md:flex-row items-center justify-between bg-white border border-[#E5E5E5] rounded-3xl p-6 md:p-8 hover:shadow-lg transition-all duration-300">
        <div className="flex items-center gap-6 mb-4 md:mb-0">
          <div className="w-14 h-14 bg-[#FFFFFF] border border-[#E5E5E5] rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <MessageSquare size={24} className="text-[#050505]" />
          </div>
          <div>
            <h3 className="text-xl font-black text-[#050505] tracking-tight mb-1">Join LedgerChat</h3>
            <p className="text-sm font-bold text-[#888888]">Connect and talk directly with the community.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-[#050505] text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest group-hover:bg-[#333333] transition-colors w-full md:w-auto justify-center">
          Open Chat
        </div>
      </Link>
    </div>
  );
}
