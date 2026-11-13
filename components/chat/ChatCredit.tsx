import React from 'react';
import { HLLogo } from '@/components/shared/HLLogo';
import { EXTERNAL_LINKS } from '@/lib/constants/links';
import { LEGAL_ENTITY } from '@/lib/constants/legalEntity';

/**
 * ChatCredit — the site footer's credit, set small for the bottom right of /chat.
 *
 * Same words and same rule as components/landing/v2/SiteFooter.tsx: Humanity Ledger makes Ledger
 * Chat; it is built on Aztec Network, which does not make, endorse or operate it, so Aztec is a text
 * link and its logo is not drawn. The mark is /worldmap.png at 1024 px, drawn at 20 px, so it stays
 * sharp on 2x and 3x screens.
 */

const MAKER = LEGAL_ENTITY.kind === 'company' ? LEGAL_ENTITY.name : LEGAL_ENTITY.tradingName;

export function ChatCredit({ align = 'start', className = '' }: { align?: 'start' | 'end'; className?: string }) {
  const end = align === 'end';
  return (
    <footer className={`flex flex-col gap-2 ${end ? 'items-end text-right' : 'items-start'} ${className}`}>
      <p className="m-0 text-[12.5px] leading-[1.5] text-[#475467]">
        <span className="font-semibold text-[#15171c]">Ledger Chat</span>, made by {MAKER}. Built on{' '}
        <a
          href={EXTERNAL_LINKS.aztec}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[#15171c] underline decoration-[rgba(16,24,40,0.25)] underline-offset-[3px] hover:decoration-current"
        >
          Aztec Network
        </a>
        .
      </p>
      <p className="m-0 inline-flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#475467]">
        <HLLogo size={20} variant="mark" />
        <span>© 2026 {LEGAL_ENTITY.tradingName}</span>
      </p>
    </footer>
  );
}

export default ChatCredit;
