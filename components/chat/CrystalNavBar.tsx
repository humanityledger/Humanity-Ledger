'use client';
import React from 'react';
import { motion } from 'framer-motion';

export type NavTab = 'updates' | 'calls' | 'communities' | 'chats';

interface CrystalNavBarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unreadCounts?: Partial<Record<NavTab, number>>;
}

const tabs: { id: NavTab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  {
    id: 'updates',
    label: 'Updates',
    icon: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={active ? '#007AFF' : '#8E8E93'} strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4" fill={active ? '#007AFF' : '#8E8E93'} />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.64 5.64l1.41 1.41M16.95 16.95l1.41 1.41M5.64 18.36l1.41-1.41M16.95 7.05l1.41-1.41"
          stroke={active ? '#007AFF' : '#8E8E93'} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 'calls',
    label: 'Calls',
    icon: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.6 4.35 2 2 0 0 1 3.57 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.1 6.1l.9-.9a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"
          fill={active ? '#007AFF' : 'none'} stroke={active ? '#007AFF' : '#8E8E93'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    id: 'communities',
    label: 'Communities',
    icon: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={active ? '#007AFF' : '#8E8E93'} strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="9" cy="7" r="4" stroke={active ? '#007AFF' : '#8E8E93'} strokeWidth="1.8" fill={active ? '#007AFF22' : 'none'} />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={active ? '#007AFF' : '#8E8E93'} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 'chats',
    label: 'Chats',
    icon: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          fill={active ? '#007AFF' : 'none'} stroke={active ? '#007AFF' : '#8E8E93'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
];

export const CrystalNavBar: React.FC<CrystalNavBarProps> = ({ activeTab, onTabChange, unreadCounts = {} }) => {
  return (
    <nav
      className="relative z-50 shrink-0"
      style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '0.5px solid rgba(0,0,0,0.1)',
        boxShadow: '0 -1px 0 rgba(0,0,0,0.06)'
      }}
    >
      <div className="flex items-end pb-safe">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const unread = unreadCounts[tab.id] ?? 0;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 relative"
            >
              {/* Active indicator pill */}
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[#007AFF]"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}

              {/* Icon + badge */}
              <div className="relative">
                {tab.icon(isActive)}
                {unread > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 bg-[#FF3B30] rounded-full text-white text-[10px] font-bold flex items-center justify-center leading-none border-2 border-white">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className="text-[10px] font-semibold tracking-wide"
                style={{ color: isActive ? '#007AFF' : '#8E8E93' }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
