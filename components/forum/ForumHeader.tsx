"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, Search, Menu, User, Bell, PauseCircle, Activity, Edit3, Settings, LogOut } from 'lucide-react';
import Link from 'next/link';

export function ForumHeader() {
  const [theme, setTheme] = useState<'light'|'dark'|'auto'>('light');
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="w-full bg-white  border-b border-black/5  relative z-50">
      <div className="max-w-[1440px] mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <Link href="/forum" className="flex items-center gap-2">
            <span className="text-xl font-black text-black  uppercase tracking-tighter">System Forum</span>
          </Link>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          
          {/* Theme Toggle */}
          <div className="relative">
            <button 
              onClick={() => setShowThemeSelector(!showThemeSelector)}
              className="p-2 text-black/50 hover:text-black hover:bg-black/5    rounded-full transition-colors"
            >
              {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <AnimatePresence>
              {showThemeSelector && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full right-0 mt-2 w-32 bg-white  shadow-xl border border-black/5  rounded-lg overflow-hidden"
                >
                  {['Light', 'Dark', 'Auto'].map((t) => (
                    <button
                      key={t}
                      onClick={() => { setTheme(t.toLowerCase() as any); setShowThemeSelector(false); }}
                      className="w-full px-4 py-2 text-left text-sm font-semibold text-black/70 hover:bg-black/5  "
                    >
                      {t}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Search */}
          <div className="relative">
            <button 
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 text-black/50 hover:text-black hover:bg-black/5    rounded-full transition-colors"
            >
              <Search size={20} />
            </button>
            <AnimatePresence>
              {showSearch && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full right-0 mt-2 w-80 bg-white  shadow-2xl border border-black/5  rounded-xl overflow-hidden p-3"
                >
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search (# filters by category or tag)"
                    className="w-full bg-black/5  border border-transparent focus:border-[#25D366] rounded-lg px-3 py-2 text-sm text-black  outline-none"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Hamburger (Categories placeholder) */}
          <button className="p-2 text-black/50 hover:text-black hover:bg-black/5    rounded-full transition-colors">
            <Menu size={20} />
          </button>

          {/* User Menu */}
          <div className="relative">
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 rounded-full bg-blue-100 text-blue-600   flex items-center justify-center font-bold overflow-hidden"
            >
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Ledger" alt="Avatar" className="w-full h-full object-cover" />
            </button>
            <AnimatePresence>
              {showUserMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full right-0 mt-2 w-72 bg-white  shadow-2xl border border-black/5  rounded-xl overflow-hidden flex flex-row"
                >
                  {/* Left Column (Actions) */}
                  <div className="flex-1 border-r border-black/5  py-2">
                    <button className="w-full px-4 py-2 text-left text-sm font-semibold flex items-center gap-3 hover:bg-black/5  text-black ">
                      <div className="w-2.5 h-2.5 bg-[#25D366] rounded-full" />
                      Online
                    </button>
                    <button className="w-full px-4 py-2 text-left text-sm font-semibold flex items-center gap-3 hover:bg-black/5  text-black/60 ">
                      <PauseCircle size={16} /> Pause notifications
                    </button>
                    <div className="h-px bg-black/5  my-2" />
                    <button className="w-full px-4 py-2 text-left text-sm font-semibold flex items-center gap-3 hover:bg-black/5  text-black/70 ">
                      <User size={16} /> Summary
                    </button>
                    <button className="w-full px-4 py-2 text-left text-sm font-semibold flex items-center gap-3 hover:bg-black/5  text-black/70 ">
                      <Activity size={16} /> Activity
                    </button>
                    <button className="w-full px-4 py-2 text-left text-sm font-semibold flex items-center gap-3 hover:bg-black/5  text-black/70 ">
                      <Edit3 size={16} /> Drafts
                    </button>
                    <Link href="/forum/preferences/account" onClick={() => setShowUserMenu(false)} className="w-full px-4 py-2 text-left text-sm font-semibold flex items-center gap-3 hover:bg-black/5  text-black/70 ">
                      <Settings size={16} /> Preferences
                    </Link>
                    <button className="w-full px-4 py-2 text-left text-sm font-semibold flex items-center gap-3 hover:bg-black/5  text-black/70 ">
                      <LogOut size={16} /> Log Out
                    </button>
                  </div>
                  {/* Right Column (Icons) */}
                  <div className="w-12 bg-black/5  py-2 flex flex-col items-center gap-4">
                    <button className="text-black/40 hover:text-black  "><Bell size={16} /></button>
                    <button className="text-black/40 hover:text-black  "><Activity size={16} /></button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </header>
  );
}

