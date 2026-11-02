import Link from 'next/link';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { AztecSequencerDashboard } from '@/components/terminal/sequencer';
import { getSequencerOverview } from '@/lib/aztec/sequencer/client';
import type { SequencerOverview } from '@/lib/aztec/sequencer/types';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Aztec sequencer | Humanity Ledger',
  description: 'Live status of the Humanity Ledger Aztec sequencer: network, node, stake, committee duties and publisher gas.',
  robots: { index: false, follow: false },
};

async function firstOverview(): Promise<SequencerOverview | null> {
  try {
    const o = await getSequencerOverview();
    // The node's private address never reaches the browser.
    return { ...o, ownNode: { ...o.ownNode, url: o.ownNode.url ? 'configured' : null } };
  } catch {
    return null; // the client retries on its own
  }
}

export default async function SequencerPage() {
  const initialData = await firstOverview();
  return (
    <div className="min-h-screen bg-[#f7f8fa] text-[#15171c] px-4 py-6 md:px-8 md:py-8">
      <header className="max-w-6xl mx-auto mb-6 flex items-center justify-between gap-3">
        <Link
          href="/chat"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white border border-[#e4e7ec] hover:bg-[#f2f4f7] text-[13px] font-medium"
        >
          <ArrowLeft size={14} /> Back to Ledger Chat
        </Link>
        <a
          href="https://docs.aztec.network/operate/operators/setup/sequencer_management"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white border border-[#e4e7ec] hover:bg-[#f2f4f7] text-[13px] font-medium"
        >
          <BookOpen size={14} /> Operator docs
        </a>
      </header>
      <main className="max-w-6xl mx-auto">
        <AztecSequencerDashboard initialData={initialData} />
      </main>
    </div>
  );
}
