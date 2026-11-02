'use client';
import React, { useEffect } from 'react';
import Link from 'next/link';
import { HLLogo } from '@/components/shared/HLLogo';

/**
 * Route error boundary. It logs the real error so it can be traced, shows
 * the message while developing, and offers a way back.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[HL] Page error:', error);
  }, [error]);

  const dev = process.env.NODE_ENV !== 'production';

  return (
    <div className="min-h-screen bg-[#f2f3f5] flex items-center justify-center p-6">
      <div className="w-full max-w-[440px] rounded-[28px] bg-white border border-black/[0.06] shadow-[0_1px_2px_rgba(16,24,40,0.04)] px-8 py-10 text-center">
        <HLLogo size={44} className="mx-auto mb-6" />
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#0A0A0A]">Something went wrong</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-500">
          This page hit an unexpected error. Your wallet, keys and messages are not affected.
        </p>
        {dev && error?.message ? (
          <p className="mt-4 rounded-xl bg-neutral-50 border border-neutral-200 px-3 py-2 text-left font-mono text-[12px] text-neutral-600 break-words">
            {error.message}
            {error.digest ? ` (digest ${error.digest})` : ''}
          </p>
        ) : null}
        <div className="mt-7 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="h-11 px-5 rounded-full bg-[#0A0A0A] text-white text-[15px] font-semibold hover:bg-neutral-800 transition"
          >
            Try again
          </button>
          <Link
            href="/"
            className="h-11 px-5 inline-flex items-center rounded-full border border-neutral-200 text-[15px] font-semibold text-[#0A0A0A] hover:bg-neutral-50 transition"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
