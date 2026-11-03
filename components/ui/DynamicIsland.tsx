"use client";

/**
 * The Dynamic Island: one capsule at the top of the app for live activity.
 * It only says what its caller knows. A call shows "Calling", "Ringing" or
 * "Connecting" until it connects, then the time since it connected. A
 * recording shows its own elapsed time. There are no simulated waveforms,
 * progress bars or network-health dots.
 *
 * Tap or Enter/Space expands and collapses it; Escape collapses it.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { useDynamicIsland, type DynamicIslandPayload } from '@/lib/store/dynamic-island-store';
import { Phone, PhoneOff, Wallet, Loader2, Bell, CheckCircle2, ChevronRight } from 'lucide-react';
import { usePathname } from 'next/navigation';

const ISLAND_ALLOWLIST = ['/chat', '/portfolio', '/studio', '/settings', '/hub', '/ledger', '/terminal', '/scan', '/passport'];

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** Ticks once a second while `since` is set, so the shown time stays current. */
function useElapsed(since: number | undefined): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  return since ? formatElapsed(now - since) : null;
}

function safeIcon(src: string | undefined): string | null {
  if (!src) return null;
  if (src.startsWith('data:image/')) return src;
  if (src.startsWith('/') && !src.startsWith('//')) return src;
  return null;
}

function callLabel(p: DynamicIslandPayload | undefined, elapsed: string | null): string {
  if (p?.subtitle && !p.phase) return p.subtitle; // group calls set their own line
  switch (p?.phase) {
    case 'ringing': return 'Incoming call';
    case 'connecting': return 'Connecting';
    case 'active': return elapsed ?? 'Connected';
    case 'calling':
    default: return 'Calling';
  }
}

export function DynamicIsland() {
  const { activeState, payload, expanded, setExpanded, dismiss } = useDynamicIsland();
  const pathname = usePathname();
  const elapsed = useElapsed(
    activeState === 'recording' ? payload?.startedAt
      : activeState === 'calling' && payload?.phase === 'active' ? payload?.startedAt
      : undefined,
  );

  const isAppRoute = ISLAND_ALLOWLIST.some(r => pathname?.startsWith(r));
  if (!isAppRoute) return null;

  const toggle = () => { if (activeState !== 'idle') setExpanded(!expanded); };
  const open = (e: React.MouseEvent) => {
    e.stopPropagation();
    payload?.onOpen?.();
    dismiss();
  };

  let width = 200;
  let height = 36;
  if (activeState !== 'idle') {
    width = expanded ? 340 : 200;
    height = expanded ? 64 : 36;
    if (activeState === 'notification' && expanded) height = 72;
  }

  const title = payload?.title?.trim() || '';
  const iconSrc = safeIcon(payload?.icon);
  // What a screen reader hears; the capsule itself is a live region.
  const spoken =
    activeState === 'calling' ? `${callLabel(payload, elapsed)}${title ? `, ${title}` : ''}`
    : activeState === 'recording' ? `Recording${elapsed ? `, ${elapsed}` : ''}`
    : [title, payload?.subtitle].filter(Boolean).join('. ');

  return (
    <MotionConfig reducedMotion="user">
      <div className="fixed top-2 md:top-3 left-0 right-0 z-[9999] flex justify-center pointer-events-none" role="status" aria-live="polite" aria-atomic="true">
        <span className="sr-only">{activeState === 'idle' ? '' : spoken}</span>
        <AnimatePresence>
          {activeState !== 'idle' && (
            <motion.div
              layout
              role="button"
              tabIndex={0}
              aria-expanded={expanded}
              aria-label={spoken || 'Activity'}
              onClick={toggle}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
                if (e.key === 'Escape' && expanded) { e.preventDefault(); setExpanded(false); }
              }}
              initial={{ y: -40, opacity: 0, scale: 0.92 }}
              animate={{ y: 0, opacity: 1, scale: 1, width, height, borderRadius: 22 }}
              exit={{ y: -40, opacity: 0, scale: 0.92, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
              className="relative max-w-[calc(100vw-24px)] bg-[#0b0c0e] text-white overflow-hidden flex items-center pointer-events-auto cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              style={{ boxShadow: '0 10px 32px -10px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.08)' }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {activeState === 'calling' && (
                  <motion.div key="calling" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex items-center justify-between gap-3 px-3.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-[#30a46c]/20 text-[#3dd68c] flex items-center justify-center shrink-0" aria-hidden="true">
                        <Phone size={12} strokeWidth={2.25} />
                      </span>
                      {expanded ? (
                        <span className="flex flex-col min-w-0">
                          <span className="text-[13px] font-medium truncate">{title || 'Call'}</span>
                          <span className="text-[12px] text-white/60 tabular-nums">{callLabel(payload, elapsed)}</span>
                        </span>
                      ) : (
                        <span className="text-[12.5px] text-white/80 truncate">{title || 'Call'}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!expanded && <span className="text-[12.5px] tabular-nums text-[#3dd68c]">{callLabel(payload, elapsed)}</span>}
                      {expanded && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.dispatchEvent(new CustomEvent('ledger_end_active_call'));
                            dismiss();
                          }}
                          className="w-8 h-8 rounded-full bg-[#e5484d] hover:bg-[#d93036] flex items-center justify-center text-white transition-colors active:scale-95"
                          aria-label="End call"
                        >
                          <PhoneOff size={14} strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeState === 'recording' && (
                  <motion.div key="recording" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex items-center justify-between gap-3 px-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-[#e5484d] animate-pulse motion-reduce:animate-none shrink-0" aria-hidden="true" />
                      <span className="text-[12.5px] text-white/85 truncate">{expanded && title ? `Recording for ${title}` : 'Recording'}</span>
                    </div>
                    {elapsed && <span className="text-[12.5px] tabular-nums text-[#ff8b8b] shrink-0">{elapsed}</span>}
                  </motion.div>
                )}

                {(activeState === 'syncing' || activeState === 'tx_processing') && (
                  <motion.div key="working" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex items-center gap-2.5 px-4 min-w-0">
                    <Loader2 size={14} className="text-white/80 animate-spin motion-reduce:animate-none shrink-0" aria-hidden="true" />
                    <span className="flex flex-col min-w-0">
                      <span className="text-[12.5px] font-medium truncate">{title || 'Working'}</span>
                      {expanded && payload?.subtitle && <span className="text-[12px] text-white/60 truncate">{payload.subtitle}</span>}
                    </span>
                  </motion.div>
                )}

                {(activeState === 'tx_success' || activeState === 'wallet_connected') && (
                  <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex items-center gap-2.5 px-4 min-w-0">
                    {activeState === 'wallet_connected'
                      ? <Wallet size={14} className="text-white/85 shrink-0" aria-hidden="true" />
                      : <CheckCircle2 size={14} className="text-[#3dd68c] shrink-0" aria-hidden="true" />}
                    <span className="flex flex-col min-w-0">
                      <span className="text-[12.5px] font-medium truncate">{title || 'Done'}</span>
                      {expanded && payload?.subtitle && <span className="text-[12px] text-white/60 truncate">{payload.subtitle}</span>}
                    </span>
                  </motion.div>
                )}

                {activeState === 'notification' && (
                  <motion.div key="notification" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex items-center gap-2.5 px-3">
                    <span className="w-7 h-7 rounded-full bg-white/10 shrink-0 flex items-center justify-center overflow-hidden" aria-hidden="true">
                      {iconSrc ? <img src={iconSrc} alt="" className="w-full h-full object-cover" /> : <Bell size={13} className="text-white/85" />}
                    </span>
                    <span className="flex flex-col flex-1 min-w-0">
                      <span className="text-[13px] font-medium truncate">{title || 'New message'}</span>
                      {expanded && payload?.subtitle && <span className="text-[12.5px] text-white/65 truncate">{payload.subtitle}</span>}
                    </span>
                    {expanded && payload?.onOpen && (
                      <button
                        type="button"
                        onClick={open}
                        className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 hover:bg-white/20 transition-colors"
                        aria-label={title ? `Open chat with ${title}` : 'Open'}
                      >
                        <ChevronRight size={16} className="text-white" />
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
