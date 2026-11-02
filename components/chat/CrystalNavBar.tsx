'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Phone, CircleDot, Users } from 'lucide-react';

export type NavTab = 'updates' | 'calls' | 'communities' | 'chats';

interface CrystalNavBarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unreadCounts?: Partial<Record<NavTab, number>>;
}

const TABS: { id: NavTab; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { id: 'chats', label: 'Chats', Icon: MessageCircle },
  { id: 'calls', label: 'Calls', Icon: Phone },
  { id: 'updates', label: 'Updates', Icon: CircleDot },
  { id: 'communities', label: 'Communities', Icon: Users },
];

/** The four sections of Ledger Chat, shown as tabs above the list. */
export const CrystalNavBar: React.FC<CrystalNavBarProps> = ({ activeTab, onTabChange, unreadCounts = {} }) => {
  return (
    <nav aria-label="Sections" className="relative z-10 shrink-0 bg-white border-b border-[#eceef2] px-2">
      <div className="flex" role="tablist">
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
              className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-1 h-[54px] text-[12px] font-medium transition-colors ${
                active ? 'text-[#15171c]' : 'text-[#727a88] hover:text-[#15171c]'
              }`}
            >
              <span className="relative shrink-0">
                <Icon size={18} strokeWidth={active ? 2.1 : 1.8} />
                {unread > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 bg-[#15171c] rounded-full text-white text-[10.5px] font-semibold tabular-nums flex items-center justify-center leading-none ring-2 ring-white">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </span>
              <span className="truncate max-w-full">{label}</span>
              {active && (
                <motion.span
                  layoutId="nav-indicator"
                  className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-[#15171c]"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
