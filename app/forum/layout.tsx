import { TelemetryTracker } from '@/components/forum/TelemetryTracker';
import { MobileBottomNav } from '@/components/forum/MobileBottomNav';
import { ForumGate } from '@/components/forum/ForumGate';

export default async function ForumLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col bg-white text-slate-900">
      <TelemetryTracker />

      <main className="flex-1 w-full overflow-x-hidden">
        <ForumGate>
          {children}
        </ForumGate>
      </main>

      <footer className="w-full py-6 mt-auto flex flex-col items-center justify-center border-t border-slate-200/60">
        <span className="text-[9px] font-sans font-bold uppercase tracking-[0.2em] mb-1 text-slate-400">
          powered by
        </span>
        <div className="flex items-baseline text-slate-900">
          <span className="text-[20px] leading-none font-black">A</span>
          <span className="text-[13px] font-serif font-black uppercase tracking-[0.15em] leading-none ml-[2px]">ztec</span>
        </div>
      </footer>

      <div className="lg:hidden w-full" style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px))' }} />
      <MobileBottomNav />
    </div>
  );
}
