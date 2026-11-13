import type { Metadata } from 'next';
import { ProtocolDashboard } from '@/components/protocol/ProtocolDashboard';

export const metadata: Metadata = {
  title: 'Protocol metrics · Ledger Chat',
  description:
    'Aggregate figures for Ledger Chat on Aztec Alpha, read from the network when the page loads. Nothing is estimated.',
};

/** /protocol — public protocol dashboard. Figures come from GET /api/protocol/metrics. */
export default function ProtocolPage() {
  return <ProtocolDashboard />;
}
