"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Shield, UserCircle, Mail, Bell, Target, Users, Layout, Menu, Calendar } from 'lucide-react';

export default function PreferencesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { name: 'Account', href: '/forum/preferences/account', icon: <User size={14} /> },
    { name: 'Security', href: '/forum/preferences/security', icon: <Shield size={14} /> },
    { name: 'Profile', href: '/forum/preferences/profile', icon: <UserCircle size={14} /> },
    { name: 'Emails', href: '/forum/preferences/emails', icon: <Mail size={14} /> },
    { name: 'Notifications', href: '/forum/preferences/notifications', icon: <Bell size={14} /> },
    { name: 'Tracking', href: '/forum/preferences/tracking', icon: <Target size={14} /> },
    { name: 'Users', href: '/forum/preferences/users', icon: <Users size={14} /> },
    { name: 'Interface', href: '/forum/preferences/interface', icon: <Layout size={14} /> },
    { name: 'Navigation menu', href: '/forum/preferences/navigation', icon: <Menu size={14} /> },
    { name: 'Calendar', href: '/forum/preferences/calendar', icon: <Calendar size={14} /> },
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-4 py-8">
      
      {/* Top Banner (User Info) */}
      <div className="flex items-start gap-6 mb-8 border-b border-black/5 dark:border-white/10 pb-6">
        <div className="w-24 h-24 rounded-full overflow-hidden border border-black/10 dark:border-white/10 shrink-0">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Ledger" alt="Avatar" className="w-full h-full object-cover" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-black dark:text-white mb-1">humanityledger</h1>
          <p className="text-black/50 dark:text-white/50 text-sm font-semibold mb-3">People can mention you as @humanityledger</p>
          <div className="flex items-center gap-4 text-sm font-semibold">
            <Link href="/forum/u/humanityledger/summary" className="text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white flex items-center gap-2"><User size={14} /> Summary</Link>
            <Link href="/forum/u/humanityledger/activity" className="text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white flex items-center gap-2"><Activity size={14} /> Activity</Link>
            <Link href="/forum/u/humanityledger/notifications" className="text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white flex items-center gap-2"><Bell size={14} /> Notifications</Link>
          </div>
        </div>
        <div className="ml-auto">
          <button className="px-4 py-2 border border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5 rounded-full text-sm font-bold flex items-center gap-2 transition-colors">
            Expand
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-48 shrink-0">
          <nav className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible gap-1 pb-4 lg:pb-0 scrollbar-hide">
            {tabs.map(t => {
              const isActive = pathname === t.href || pathname?.startsWith(t.href + '/');
              return (
                <Link
                  key={t.name}
                  href={t.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                    isActive 
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' 
                      : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white'
                  }`}
                >
                  {t.icon}
                  {t.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0 pb-20">
          {children}
        </main>
      </div>
    </div>
  );
}
// Placeholder icon for Activity
const Activity = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
  </svg>
);

