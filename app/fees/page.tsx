'use client';
import dynamic from 'next/dynamic';

const FeeSponsor = dynamic(() => import('@/components/zk/FeeSponsor').then((m) => m.FeeSponsor), { ssr: false });

/** /fees?to=<aztec address>&h=<secret hash> — pay a contact's Aztec network fees (Fee Juice). */
export default function FeesPage() {
  return (
    <main className="min-h-[100dvh] bg-[#f7f8fa] flex items-start sm:items-center justify-center p-4">
      <FeeSponsor />
    </main>
  );
}
