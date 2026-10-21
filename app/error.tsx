'use client';
import React from 'react';
import { HLLogo } from '@/components/shared/HLLogo';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <HLLogo size={48} className="mb-6" />
      <h1 className="text-2xl font-bold text-[#0A0A0A] mb-2">System Interruption</h1>
      <p className="text-sm text-neutral-500 mb-6">A recoverable error occurred in the client state.</p>
      <button onClick={reset} className="px-6 py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 transition">
        Retry Session
      </button>
    </div>
  );
}
