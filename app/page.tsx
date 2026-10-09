
import { ClientRootRouter } from '@/components/landing/ClientRootRouter';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div className="w-full flex-1 flex flex-col">
      <ClientRootRouter />
    </div>
  );
}
