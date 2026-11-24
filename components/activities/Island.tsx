'use client';
/**
 * The island: one capsule at the top for the most important live activity, a small circle beside
 * it for the next one, and a count for the rest that opens the stack (rules in
 * lib/activities/priority.ts).
 *
 * Interaction
 *   tap / Enter / Space   expand or collapse the capsule; a message opens its chat; a short
 *                         notice with nothing more to show goes away
 *   swipe down            expand
 *   swipe up              collapse; on a compact capsule, put away what can be put away
 *   tap the small circle  bring that activity forward
 *   tap "+N"              the stack: every live activity, one row each
 *   Escape / outside tap  collapse
 *   pointer over / focus  notices wait (their countdowns stop) until the user is done reading
 * An incoming call opens expanded and moves focus to Answer; it is announced assertively and,
 * where the device has a motor, knocks twice.
 *
 * Look
 *   Always dark, like the hardware it comes from. A hairline catches the light at the edge; an
 *   aura in the activity's colour sits under it (green live, red recording or failure, violet
 *   private money). A new arrival lands with one small bounce. A call shows the other side's real
 *   voice level; a payment, a ring that fills one arc per step the wallet reports.
 *
 * A call drawn here shares its layoutId with the floating window, so moving between the two is one
 * continuous shape, not two surfaces swapping.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls, type PanInfo } from 'framer-motion';
import { ChevronUp, Layers, X } from 'lucide-react';
import { useActivities } from '@/lib/activities/store';
import { isDismissible, islandLayout } from '@/lib/activities/priority';
import { runAction, type ActionName } from '@/lib/activities/actions';
import { useCallMedia } from '@/lib/activities/call-media';
import { holdNotices } from '@/lib/activities/notice-clock';
import type { AnyActivity } from '@/lib/activities/types';
import { present, type PresentContext, type Tone } from './presentations';
import { useMotionPreset } from './motion';
import { useNow } from './useNow';
import { buzz, HAPTIC } from './haptics';
import s from './activities.module.css';

export const CALL_SURFACE_ID = 'live-call-surface';

const hasTimer = (a: AnyActivity | null) => !!a && ((a.kind === 'call' && !!a.state.connectedAt) || a.kind === 'recording');

/** How far (px) or how fast (px/s) a vertical swipe must go to count. */
const SWIPE_DISTANCE = 22;
const SWIPE_VELOCITY = 380;

const AURA: Record<Tone, string> = { live: s.auraLive, warn: s.auraWarn, danger: s.auraDanger, violet: s.auraViolet, neutral: s.auraNeutral };

export function Island({ quiet = false }: { quiet?: boolean }) {
  const activities = useActivities((st) => st.activities);
  const presentation = useActivities((st) => st.presentation);
  const expandedId = useActivities((st) => st.expandedId);
  const expand = useActivities((st) => st.expand);
  const dismiss = useActivities((st) => st.dismiss);
  const setPresentation = useActivities((st) => st.setPresentation);
  const controls = useCallMedia((st) => st.controls);
  const remote = useCallMedia((st) => st.remote);
  const motionPreset = useMotionPreset();
  const pop = useAnimationControls();

  // The small circle and the stack can bring any activity forward for as long as it exists.
  const [pinned, setPinned] = useState<string | null>(null);
  // Auto-expanded activities the user collapsed stay collapsed.
  const [collapsedAuto, setCollapsedAuto] = useState<Set<string>>(() => new Set());
  const [stackOpen, setStackOpen] = useState(false);

  const layout = useMemo(() => islandLayout(activities, presentation, { quiet }), [activities, presentation, quiet]);
  const pinnedActivity = pinned ? layout.all.find((a) => a.id === pinned) ?? null : null;
  const primary = pinnedActivity ?? layout.primary;
  const secondary = pinnedActivity ? (layout.primary?.id === pinned ? layout.secondary : layout.primary) : layout.secondary;
  const now = useNow(hasTimer(primary));

  useEffect(() => { if (pinned && !pinnedActivity) setPinned(null); }, [pinned, pinnedActivity]);
  useEffect(() => { if (stackOpen && layout.all.length < 2) setStackOpen(false); }, [stackOpen, layout.all.length]);

  const ctxFor = (a: AnyActivity | null): PresentContext => ({
    now,
    controls,
    remote,
    toWindow: () => setPresentation('window'),
    dismiss: () => a && dismiss(a.id),
    act: (name: ActionName, event?: unknown) => { if (a) runAction(a.id, name, event); },
  });
  const ctx = ctxFor(primary);
  const view = primary ? present(primary, ctx) : null;
  const auto = !!primary && primary.id === layout.primary?.id && layout.autoExpand && !collapsedAuto.has(primary.id);
  const expanded = !stackOpen && !!view?.expanded && (expandedId === primary?.id || auto);
  const open = expanded || stackOpen;

  const wrapRef = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);

  // Focus the first action of something that opened by itself (an incoming call: Answer).
  useEffect(() => {
    if (!expanded || !auto) return;
    const el = wrapRef.current?.querySelector<HTMLElement>('[data-autofocus]');
    el?.focus({ preventScroll: true });
  }, [expanded, auto, primary?.id]);

  // A new arrival (or a notice whose words changed) lands with one small bounce.
  const arrival = primary ? `${primary.id}|${primary.kind === 'notice' ? primary.state.title : ''}|${primary.kind === 'call' ? primary.state.phase : ''}` : '';
  const lastArrival = useRef('');
  useEffect(() => {
    const prev = lastArrival.current;
    lastArrival.current = arrival;
    if (!arrival || !prev || prev === arrival || motionPreset.reduced) return;
    void pop.start({ scale: [1, 1.045, 0.995, 1], transition: { duration: 0.48, times: [0, 0.32, 0.7, 1], ease: [0.2, 0.9, 0.3, 1] } });
  }, [arrival, pop, motionPreset.reduced]);

  // Haptics: an incoming call knocks once; a failure taps.
  const knocked = useRef('');
  useEffect(() => {
    if (!primary) return;
    const key = `${primary.id}|${primary.startedAt}`;
    if (knocked.current === key) return;
    if (primary.kind === 'call' && primary.state.phase === 'incoming') { knocked.current = key; buzz(HAPTIC.ring); }
    else if (primary.kind === 'notice' && primary.state.tone === 'error') { knocked.current = key; buzz(HAPTIC.error); }
  }, [primary]);

  const collapse = () => {
    if (stackOpen) { setStackOpen(false); return; }
    if (!primary) return;
    if (auto) setCollapsedAuto((prev) => new Set(prev).add(primary.id));
    expand(null);
  };

  // Escape and outside taps collapse.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') collapse(); };
    const onDown = (e: PointerEvent) => { if (!wrapRef.current?.contains(e.target as Node)) collapse(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, primary?.id, auto]);

  // Notices wait while the user is reading them: pointer over the island, or focus inside it.
  // A button that is removed while focused (the notice it closed) fires no blur, and an element
  // removed under a still pointer fires no pointerleave: both are re-checked on every change, so
  // a countdown can never stay frozen by something that is no longer there.
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (focused && !wrapRef.current?.contains(document.activeElement)) setFocused(false);
    if (hovering && !wrapRef.current?.querySelector(':hover')) setHovering(false);
  });
  const reading = (hovering || focused) && !!primary;
  useEffect(() => { holdNotices(reading); }, [reading]);
  useEffect(() => () => holdNotices(false), []);

  const onCapsule = () => {
    if (dragged.current) { dragged.current = false; return; }
    if (!primary || !view) return;
    if (primary.kind === 'message') {
      runAction(primary.id, 'open');
      dismiss(primary.id);
      return;
    }
    if (view.expanded) { expand(primary.id); return; }
    if (primary.kind === 'notice' && !primary.state.action) dismiss(primary.id);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const up = info.offset.y < -SWIPE_DISTANCE || info.velocity.y < -SWIPE_VELOCITY;
    const down = info.offset.y > SWIPE_DISTANCE || info.velocity.y > SWIPE_VELOCITY;
    if (!up && !down) return;
    dragged.current = true;
    // The click that ends a drag is not a tap.
    setTimeout(() => { dragged.current = false; }, 0);
    if (!primary || !view) return;
    if (up) {
      if (open) collapse();
      else if (isDismissible(primary)) { buzz(HAPTIC.tick); dismiss(primary.id); }
    } else if (!open && view.expanded) {
      expand(primary.id);
    } else if (!open && layout.all.length > 1) {
      setStackOpen(true);
    }
  };

  const isCall = primary?.kind === 'call';
  const radius = open ? 28 : view?.tall ? 22 : 999;
  const auraClass = view ? AURA[view.tone] : '';
  return (
    <div
      ref={wrapRef}
      className={s.islandWrap}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHovering(true); }}
      onPointerLeave={() => setHovering(false)}
      onFocusCapture={(e) => { if ((e.target as HTMLElement).matches?.(':focus-visible')) setFocused(true); }}
      onBlurCapture={(e) => { if (!wrapRef.current?.contains(e.relatedTarget as Node)) setFocused(false); }}
    >
      <motion.div className={s.pop} animate={pop}>
        <AnimatePresence>
          {primary && view && (
            <motion.div
              key={isCall ? CALL_SURFACE_ID : 'island-primary'}
              layout
              layoutId={isCall ? CALL_SURFACE_ID : 'island-primary'}
              className={`${s.island} ${auraClass} ${view.live && !open ? s.breathe : ''} ${open ? s.expanded : ''} ${stackOpen ? s.stackOpen : ''}`}
              style={{ borderRadius: radius }}
              transition={motionPreset.morph}
              initial={motionPreset.appear.initial}
              animate={motionPreset.appear.animate}
              exit={motionPreset.appear.exit}
              drag={motionPreset.reduced ? false : 'y'}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.14, bottom: 0.32 }}
              dragSnapToOrigin
              dragTransition={{ bounceStiffness: 520, bounceDamping: 32 }}
              onDragEnd={onDragEnd}
              role={open ? 'group' : undefined}
              aria-label={stackOpen ? `${layout.all.length} live activities` : expanded ? view.spoken : undefined}
            >
              <span className={s.sheen} aria-hidden="true" />
              <AnimatePresence mode="popLayout" initial={false}>
                {stackOpen ? (
                  <motion.div key="stack" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
                    <Stack
                      items={layout.all}
                      ctxFor={ctxFor}
                      onPick={(id) => { setPinned(id); setStackOpen(false); }}
                      onDismiss={(id) => dismiss(id)}
                      onClose={() => setStackOpen(false)}
                    />
                  </motion.div>
                ) : expanded ? (
                  <motion.div key={`x-${primary.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
                    {view.expanded}
                  </motion.div>
                ) : (
                  <motion.div
                    key={`c-${primary.id}`}
                    className={`${s.compact} ${view.tall ? s.compactTall : ''}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                  >
                    <button
                      type="button"
                      className={s.compactHit}
                      onClick={onCapsule}
                      aria-label={view.spoken}
                      aria-expanded={view.expanded ? false : undefined}
                    >
                      {view.leading}
                      <span className={`${s.label} ${primary.kind === 'notice' ? s.labelNotice : ''} ${view.tall ? s.labelTall : ''}`}>{view.label}</span>
                      {view.trailing}
                    </button>
                    {view.quick}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {primary && secondary && !open && (
            <motion.div
              key="island-minimal"
              layoutId="island-minimal"
              className={s.minimalGroup}
              transition={motionPreset.morph}
              initial={motionPreset.appear.initial}
              animate={motionPreset.appear.animate}
              exit={motionPreset.appear.exit}
            >
              <button
                type="button"
                className={`${s.minimal} ${AURA[present(secondary, ctxFor(secondary)).tone]}`}
                onClick={() => setPinned(secondary.id)}
                aria-label={`${present(secondary, ctxFor(secondary)).spoken}. Show`}
              >
                {present(secondary, ctxFor(secondary)).minimal}
              </button>
              {layout.overflow > 0 && (
                <button type="button" className={s.overflow} onClick={() => setStackOpen(true)} aria-label={`${layout.overflow} more. Show all ${layout.all.length}`}>
                  +{layout.overflow}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/** Every live activity, one row each: tap a row to bring it forward, the cross to put it away. */
function Stack({ items, ctxFor, onPick, onDismiss, onClose }: {
  items: AnyActivity[];
  ctxFor: (a: AnyActivity) => PresentContext;
  onPick: (id: string) => void;
  onDismiss: (id: string) => void;
  onClose: () => void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus({ preventScroll: true }); }, []);
  return (
    <div className={s.stack}>
      <div className={s.stackHead}>
        <span className={s.stackTitle}><Layers size={14} strokeWidth={2.2} aria-hidden="true" /> Live now · {items.length}</span>
        <button type="button" className={`${s.btn} ${s.btnIcon} ${s.btnSmall}`} onClick={onClose} aria-label="Close the list">
          <ChevronUp size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
      <ul className={s.stackList}>
        {items.map((a, i) => {
          const v = present(a, ctxFor(a));
          return (
            <li key={a.id} className={s.stackRow}>
              <button ref={i === 0 ? first : undefined} type="button" className={s.stackPick} onClick={() => onPick(a.id)} aria-label={`${v.spoken}. Bring forward`}>
                {v.leading}
                <span className={`${s.label} ${s.labelNotice}`}>{v.label}</span>
                {v.trailing}
              </button>
              {isDismissible(a) && (
                <button type="button" className={s.stackX} onClick={() => onDismiss(a.id)} aria-label={`Put away: ${v.spoken}`}>
                  <X size={13} strokeWidth={2.4} aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
