'use client';
/**
 * The live-activity layer, mounted once in the root layout so it survives every route change.
 * It draws the island and the floating call window over the app, announces changes to screen
 * readers, and gives the call to the browser's media controls.
 *
 * Architecture
 *   lib/activities/store.ts       ActivityManager (zustand): the activities and the call presentation
 *   lib/activities/priority.ts    pure rules: what the island and the window show
 *   lib/activities/call-media.ts  the call's streams and controls, registered by the call engine
 *   lib/activities/notices.ts     toasts -> notices (pure); ToastBridge.tsx mirrors sonner into them
 *   presentations.tsx             how each kind is drawn (ActivityKit regions)
 *   Island.tsx / CallWindow.tsx   the two surfaces, sharing one layoutId for the call
 * Every toast() in the app is drawn here too (ToastBridge), so there is one place at the top of
 * the screen where Ledger Chat speaks: calls, money, recordings, messages, missed calls, the
 * session and every confirmation or error.
 * The call itself is never duplicated: one 'call' activity, one presentation value
 * (stage, window or island), one set of streams.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { AnimatePresence, LayoutGroup } from 'framer-motion';
import { Toaster } from 'sonner';
import { useActivities } from '@/lib/activities/store';
import { windowCall } from '@/lib/activities/priority';
import { useCallMedia } from '@/lib/activities/call-media';
import { Island } from './Island';
import { ToastBridge } from './ToastBridge';
import { CallWindow } from './CallWindow';
import { present } from './presentations';
import { clearCallSession, setCallSession } from './mediaSession';
import s from './activities.module.css';

/** Routes where the island shows only a call and the app's notices (landing, sign-in, docs). */
const QUIET_ROUTES = [/^\/$/, /^\/connect/, /^\/docs/, /^\/privacy/, /^\/terms/, /^\/legal/];

/**
 * The island belongs to Ledger Chat. Anywhere else (docs, dashboard, landing, sign-in) it is not
 * drawn, except for a live call kept alive off /chat; the app's toasts there use the plain toaster.
 */
export const LEDGER_CHAT_ROUTES = [/^\/chat(\/|$)/, /^\/studio(\/|$)/];
export const isLedgerChatRoute = (pathname: string) => LEDGER_CHAT_ROUTES.some((r) => r.test(pathname));

/**
 * Light by default (the brand is white mode). Dark when the document says so, by either of the two
 * conventions in use: data-theme="dark" or the "dark" class (ThemeApplier).
 */
function useTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.dataset.theme === 'dark' || root.classList.contains('dark') ? 'dark' : 'light');
    read();
    const mo = new MutationObserver(read);
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

/** Two live regions: polite for everything, assertive only for an incoming call. */
function useAnnouncer() {
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');
  const say = useCallback((text: string, urgent = false) => {
    const set = urgent ? setAssertive : setPolite;
    set('');
    // A new node each time, so the same sentence twice is read twice.
    requestAnimationFrame(() => set(text));
  }, []);
  return { polite, assertive, say };
}

export function LiveActivityLayer() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const pathname = usePathname() ?? '/';
  const theme = useTheme();
  const activities = useActivities((st) => st.activities);
  const presentation = useActivities((st) => st.presentation);
  const controls = useCallMedia((st) => st.controls);
  const { polite, assertive, say } = useAnnouncer();

  const call = activities.find((a) => a.kind === 'call');
  const quiet = QUIET_ROUTES.some((r) => r.test(pathname));
  const inChat = isLedgerChatRoute(pathname);
  const liveCall = !!call && call.kind === 'call' && call.state.phase !== 'ended';

  // Leaving Ledger Chat: notices mirrored from toasts go with it (the plain toaster takes over).
  useEffect(() => {
    if (inChat) return;
    const st = useActivities.getState();
    for (const a of st.activities) if (a.kind === 'notice') st.dismiss(a.id);
  }, [inChat]);

  // Announce each activity when it starts and whenever its phase or step changes.
  const spoken = useRef(new Map<string, string>());
  useEffect(() => {
    const seen = new Set<string>();
    for (const a of activities) {
      seen.add(a.id);
      const p = present(a, { now: Date.now(), controls: null, toWindow: () => undefined, dismiss: () => undefined });
      if (spoken.current.get(a.id) !== p.announce) {
        spoken.current.set(a.id, p.announce);
        say(p.announce, !!p.assertive);
      }
    }
    for (const id of [...spoken.current.keys()]) if (!seen.has(id)) spoken.current.delete(id);
  }, [activities, say]);

  // The browser's media controls follow the live call.
  const live = call && call.kind === 'call' && call.state.phase !== 'incoming' && call.state.phase !== 'ended' ? call : null;
  useEffect(() => {
    if (!live || !controls) { clearCallSession(); return; }
    setCallSession(live.attributes.peer, { hangup: controls.end, toggleMic: controls.toggleMic, toggleCamera: controls.toggleCamera }, live.state);
  }, [live, controls]);
  useEffect(() => () => clearCallSession(), []);

  if (!mounted) return null;
  const inWindow = !!windowCall(activities, presentation);

  return createPortal(
    <div className={s.layer} data-theme={theme} data-live-activities="">
      <LayoutGroup id="live-activities">
        {(inChat || liveCall) && <Island quiet={quiet} callOnly={!inChat} />}
        <AnimatePresence>{inWindow && <CallWindow key="call-window" announce={say} />}</AnimatePresence>
      </LayoutGroup>
      {inChat ? <ToastBridge /> : <Toaster position="top-center" closeButton theme={theme} />}
      <div className={s.srOnly} aria-live="polite" aria-atomic="true">{polite}</div>
      <div className={s.srOnly} aria-live="assertive" aria-atomic="true">{assertive}</div>
    </div>,
    document.body,
  );
}

export default LiveActivityLayer;
