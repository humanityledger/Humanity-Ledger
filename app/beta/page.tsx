/**
 * /beta: joining the closed cUSDC beta (components/beta/BetaGateView.tsx, docs/beta/CUSDC_BETA.md).
 * Signed-out visitors are sent to /connect?redirect=/beta by the middleware and come back here.
 */
import type { Metadata } from 'next';
import BetaGateView from '@/components/beta/BetaGateView';

export const metadata: Metadata = {
  title: 'Closed Beta · Ledger Chat',
  robots: { index: false, follow: false },
};

export default function CusdcBetaPage() {
  return <BetaGateView />;
}
