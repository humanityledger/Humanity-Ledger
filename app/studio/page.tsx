'use client';

/**
 * /studio: Ledger Studio on its own page (also opened from inside Ledger Chat).
 * The middleware already requires a session for this path.
 */

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useSystemAccount } from '@/hooks/useSystemAccount';

const LedgerStudio = dynamic(() => import('@/components/studio/LedgerStudio').then(m => ({ default: m.LedgerStudio })), {
  ssr: false,
  loading: () => <div className="h-[100dvh] flex items-center justify-center bg-white"><Loader2 className="animate-spin text-[#727a88]" /></div>,
});

function StudioPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { address, isChecking } = useSystemAccount();
  const prompt = params?.get('q')?.slice(0, 8000) ?? undefined;

  if (isChecking && !address) {
    return <div className="h-[100dvh] flex items-center justify-center bg-white"><Loader2 className="animate-spin text-[#727a88]" /></div>;
  }
  if (!address) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        <p className="text-[15px] text-[#15171c]">Open Ledger Chat and unlock your wallet to use Ledger Studio.</p>
        <button type="button" onClick={() => router.push('/chat')} className="h-10 px-4 rounded-xl bg-[#15171c] text-white text-[14px]">Ledger Chat</button>
      </div>
    );
  }
  // Fixed to the viewport so the app shell's own layout and scrolling never crop it.
  return (
    <div className="fixed inset-0 z-[60] bg-white">
      <LedgerStudio key={address.toLowerCase()} wallet={address} initialPrompt={prompt} onExit={() => router.push('/chat')} />
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <StudioPageInner />
    </Suspense>
  );
}
