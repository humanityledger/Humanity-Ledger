import { ReactNode } from "react";

// Cryptographic FIX: Use h-screen + overflow-hidden to prevent page-level
// scroll bleed from LedgerProShell's internal h-[100dvh] container.
export default function TerminalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-[100dvh] overflow-hidden bg-transparent text-[#050505]">
      {children}
    </div>
  );
}
