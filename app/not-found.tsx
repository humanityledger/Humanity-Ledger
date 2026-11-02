'use client';
import React from 'react';
import Link from 'next/link';
import { HLLogo } from '@/components/shared/HLLogo';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <HLLogo size={48} className="mb-6" />
      <h1 className="text-4xl font-extrabold text-[#0A0A0A] tracking-tight mb-2">404</h1>
      <p className="text-sm text-neutral-500 mb-6">The sovereign path you requested does not exist.</p>
      <Link href="/" className="px-6 py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 transition">
        Return Home
      </Link>
    </div>
  );
}
