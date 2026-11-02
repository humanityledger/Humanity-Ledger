"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { SystemsUtilityHeader } from './SystemsUtilityHeader';
import { useSystemTranslation } from '@/hooks/useSystemTranslation';
import { usePathname } from 'next/navigation';
import { HLLogo } from './HLLogo';

// MENU_ITEMS moved inside InstitutionalHeader to use translation hook.

function MegaMenuItem({ item }: { item: any }) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <div 
      className="relative group h-full flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        href={item.href}
        className="font-mono text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-300 flex items-center gap-1.5 py-2 px-3 rounded-lg hover:bg-black/5 text-[#050505]/80 hover:text-[#050505]"
      >
        <span>{item.label}</span>
        {item.subItems && <span className="opacity-30 text-[8px] mt-[1px]">+</span>}
      </Link>
      
      <AnimatePresence>
        {isHovered && (item.subItems || item.description) && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            className="absolute top-[100%] left-0 w-[220px] bg-white border border-[#EBEBEB] shadow-lg z-50 p-1 rounded-lg mt-2"
          >
              {item.subItems ? (
              <div className="flex flex-col">
                {item.subItems.map((sub: any, idx: number) => (
                  <Link key={idx} href={sub.href} className="flex flex-col px-4 py-3 hover:bg-[#F8F8F8] transition-colors rounded-md">
                    <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#0A0A0A]">{sub.label}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <Link href={item.href} className="block px-4 py-3 hover:bg-[#F8F8F8] transition-colors rounded-md">
                <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#0A0A0A] block">{item.label}</span>
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function InstitutionalHeader({ fixed = true, theme = 'dark' }: { fixed?: boolean, theme?: string }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { t } = useSystemTranslation();
    const pathname = usePathname() ?? '/';

    const MENU_ITEMS: Array<{ label: string; href: string; subItems?: Array<{ label: string; href: string }> }> = [
      { label: 'App Hub', href: "/hub" },
      { label: 'Portfolio', href: "/portfolio" },
      { label: 'LedgerChat', href: "/chat" }
    ];


    return (
        <header
            role="banner"
            className="relative flex items-center justify-between w-full border-b border-[#EBEBEB] sticky top-0 z-[100] bg-white shadow-[0_1px_0_rgba(0,0,0,0.05)]"
            style={{ minHeight: 'calc(64px + env(safe-area-inset-top, 0px))', paddingTop: 'env(safe-area-inset-top, 0px)', width: '100%' }}
        >
            {/* Inner container — centred, full-width up to 4K */}
            <div className="w-full max-w-[2560px] mx-auto px-6 lg:px-10 flex items-center justify-between h-full relative">
                {/* Paper grain texture overlay */}
                <div className="absolute inset-0 opacity-[0.035] pointer-events-none noise-bg" />

                {/* LEFT: Brand Identity */}
                <div className="flex items-center gap-5 relative z-10 flex-shrink-0 lg:flex-1">
                    <Link href="/" className="flex items-center group">
                        <motion.div
                            whileHover={{ scale: 1.03 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                        >
                            <HLLogo variant="full" theme="dark" size={30} />
                        </motion.div>
                    </Link>
                </div>

                {/* CENTER: Navigation Menu — perfectly centered */}
                <div className="hidden lg:flex items-center justify-center relative z-20 pointer-events-none lg:flex-[2]">
                    <nav className="flex items-center gap-1 h-full pointer-events-auto">
                        {MENU_ITEMS.map((item, index) => (
                            <MegaMenuItem key={index} item={item} />
                        ))}
                    </nav>
                </div>

                {/* RIGHT: Utility area */}
                <div className="flex items-center justify-end gap-4 relative z-10 flex-shrink-0 lg:flex-1">
                    <div className="hidden lg:flex items-center gap-4">
                        {pathname.startsWith('/forum') && (
                            <Link href="/forum/settings" className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center hover:bg-black/5 transition-colors text-black/60 hover:text-black">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            </Link>
                        )}
                        <SystemsUtilityHeader />
                    </div>

                    {/* Mobile hamburger */}
                    <motion.button
                        whileTap={{ scale: 0.93 }}
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="xl:hidden flex items-center justify-center w-9 h-9 rounded-xl border border-black/10 transition-all bg-transparent text-black"
                    >
                        {isMenuOpen ? <X size={16} /> : <Menu size={16} />}
                    </motion.button>
                </div>

                {/* MOBILE MENU DRAWER — positioned absolutely, inside inner container */}
                {isMenuOpen && (
                    <div className="absolute top-full left-0 right-0 z-[90] shadow-2xl bg-white border-b border-[#EBEBEB] overflow-hidden">
                        <div className="flex flex-col gap-1 p-4 max-h-[75vh] overflow-y-auto overscroll-contain">
                            {MENU_ITEMS.map((item, index) => (
                                <div key={index} className="flex flex-col">
                                    {item.subItems ? (
                                        <div className="py-2 px-4">
                                            <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-black/40 mb-2 block">
                                                {item.label}
                                            </span>
                                            <div className="flex flex-col gap-1 pl-2 border-l border-black/10">
                                                {item.subItems.map((sub: any, subIdx: number) => (
                                                    <Link
                                                        key={subIdx}
                                                        href={sub.href}
                                                        onClick={() => setIsMenuOpen(false)}
                                                        className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] py-2.5 px-3 text-[#0A0A0A] hover:bg-black/5 rounded-lg transition-colors"
                                                    >
                                                        {sub.label}
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <Link
                                            href={item.href}
                                            onClick={() => setIsMenuOpen(false)}
                                            className="font-mono text-[11px] font-black uppercase tracking-[0.2em] py-3 px-4 text-[#0A0A0A] hover:bg-black/5 rounded-lg transition-colors"
                                        >
                                            {item.label}
                                        </Link>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>{/* end inner container */}
        </header>
    );
}


