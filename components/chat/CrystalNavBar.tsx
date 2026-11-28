'use client';

/**
 * Ledger Chat's phone navigation: a floating Liquid Porcelain Glass dock.
 *
 * The dock carries the three pillars exactly as in the reference — Chats | Calls | Stories — with a
 * recessed pearl capsule under the active tab that glides between tabs (Framer layoutId, transform
 * and opacity only). Communities sits in a separate crystal orb to the right, the same optics as
 * the composer's "+" circle: one tap away, without changing the dock's three-tab proportions.
 * Unread counts appear on the tab (or the orb) they belong to. "Stories" is the 'updates' tab.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n/client';

export type NavTab = 'updates' | 'calls' | 'communities' | 'chats';

interface CrystalNavBarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unreadCounts?: Partial<Record<NavTab, number>>;
}

type IconP = { className?: string };

/** Solid speech bubble, short tail at the bottom left. */
const ChatsSolid = ({ className }: IconP) => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <path fill="currentColor" d="M12 2.6c5.3 0 9.4 3.86 9.4 8.65s-4.1 8.65-9.4 8.65c-1.2 0-2.35-.19-3.4-.55l-4.2 1.98c-.62.29-1.27-.32-1.01-.95l1.25-3.06C3.36 15.75 2.6 13.6 2.6 11.25 2.6 6.46 6.7 2.6 12 2.6Z" />
  </svg>
);
/** Solid handset, tilted 45°. */
const CallsSolid = ({ className }: IconP) => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <path fill="currentColor" d="M6.62 2.9c.53-.53 1.4-.5 1.9.07l2.3 2.62c.43.5.45 1.23.04 1.75L9.6 8.9a.9.9 0 0 0-.06 1.03 13.6 13.6 0 0 0 4.53 4.53.9.9 0 0 0 1.03-.06l1.56-1.26c.52-.41 1.26-.39 1.75.04l2.62 2.3c.57.5.6 1.37.07 1.9l-1.5 1.5c-.86.86-2.13 1.2-3.3.8C10.4 17.67 6.33 13.6 4.32 7.7c-.4-1.17-.06-2.44.8-3.3l1.5-1.5Z" />
  </svg>
);
/** Two upright cards, the back one peeking out tilted to the left. */
const StoriesSolid = ({ className }: IconP) => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <path fill="currentColor" opacity=".9" d="M5.06 5.62a1.6 1.6 0 0 1 1.9-1.23l1.2.25v14.9l-1.98.42a1.6 1.6 0 0 1-1.9-1.24L3.2 9.1a1.6 1.6 0 0 1 .05-.86l1.81-2.62Z" />
    <rect x="8.9" y="2.6" width="11.9" height="18.8" rx="2.6" fill="currentColor" />
  </svg>
);
/** Three people, solid. */
const CommunitiesSolid = ({ className }: IconP) => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <circle cx="12" cy="7.6" r="3.3" fill="currentColor" />
    <circle cx="5.4" cy="9.4" r="2.3" fill="currentColor" opacity=".85" />
    <circle cx="18.6" cy="9.4" r="2.3" fill="currentColor" opacity=".85" />
    <path fill="currentColor" d="M12 12.4c3.4 0 6 2 6 4.6v.9c0 .7-.56 1.2-1.25 1.2H7.25C6.56 19.1 6 18.6 6 17.9v-.9c0-2.6 2.6-4.6 6-4.6Z" />
    <path fill="currentColor" opacity=".85" d="M4.9 13.1c-1.95.2-3.4 1.45-3.4 3v.6c0 .5.4.9.9.9h2.4v-.6c0-1.2.4-2.2 1.1-3.03-.3-.03-.6-.05-1-.07Zm14.2 0c.4.02.7.04 1 .07 1.95.2 3.4 1.45 3.4 3v.6c0 .5-.4.9-.9.9h-2.4v-.6c0-1.2-.4-2.2-1.1-3.03Z" />
  </svg>
);

const TABS: { id: NavTab; label: string; Icon: (p: IconP) => React.ReactElement }[] = [
  { id: 'chats', label: 'Chats', Icon: ChatsSolid },
  { id: 'calls', label: 'Calls', Icon: CallsSolid },
  { id: 'updates', label: 'Stories', Icon: StoriesSolid },
];

const Badge = ({ n }: { n: number }) => (
  <span className="lg-badge absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full text-white text-[10.5px] font-semibold tabular-nums flex items-center justify-center leading-none">
    {n > 99 ? '99+' : n}
  </span>
);

export const CrystalNavBar: React.FC<CrystalNavBarProps> = ({ activeTab, onTabChange, unreadCounts = {} }) => {
  const t = useT();
  const commUnread = unreadCounts.communities ?? 0;
  const commActive = activeTab === 'communities';
  return (
    <nav
      aria-label={t('Sections')}
      data-hl-dock=""
      className="fixed inset-x-0 bottom-0 z-[60] flex justify-center pointer-events-none px-3.5"
      style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center gap-2.5 w-[min(calc(100vw-28px),432px)] pointer-events-auto">
        <div className="lg-dock relative flex-1 min-w-0 h-[64px] rounded-full p-1.5 flex" role="tablist">
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            const unread = unreadCounts[id] ?? 0;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(id)}
                className="relative flex-1 min-w-0 rounded-full flex flex-col items-center justify-center gap-[3px] outline-none focus-visible:ring-2 focus-visible:ring-[#15171c]/30"
              >
                {active && (
                  <motion.span
                    layoutId="lg-dock-capsule"
                    className="lg-dock-capsule absolute inset-0 rounded-full"
                    transition={{ type: 'spring', stiffness: 520, damping: 40, mass: 0.9 }}
                    aria-hidden="true"
                  />
                )}
                <span className="relative z-[1] text-[#17181c]">
                  <Icon />
                  {unread > 0 && <Badge n={unread} />}
                </span>
                <span className={`relative z-[1] truncate max-w-full text-[11.75px] tracking-[-0.015em] leading-none ${active ? 'font-semibold text-[#15171c]' : 'font-medium text-[#2c2e33]'}`}>
                  {t(label)}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          role="tab"
          aria-selected={commActive}
          aria-label={t('Communities')}
          title={t('Communities')}
          onClick={() => onTabChange('communities')}
          className={`lg-orb relative w-[64px] h-[64px] shrink-0 rounded-full flex items-center justify-center text-[#17181c] active:scale-95 transition-transform ${commActive ? 'lg-orb-active' : ''}`}
        >
          <CommunitiesSolid />
          {commUnread > 0 && <span className="absolute top-2 right-2"><Badge n={commUnread} /></span>}
        </button>
      </div>
    </nav>
  );
};
