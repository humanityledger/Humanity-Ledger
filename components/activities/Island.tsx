'use client';
/**
 * The island: one capsule at the top for the most important live activity, a small circle beside
 * it for the next one, and a count for the rest (rules in lib/activities/priority.ts).
 *
 * Interaction
 *   tap / Enter / Space   expand or collapse the capsule (or run its action, for a message)
 *   tap the small circle  bring that activity forward
 *   Escape                collapse
 *   outside tap           collapse
 * An incoming call opens expanded and moves focus to Answer; it is announced assertively.
 *
 * A call drawn here shares its layoutId with the floating window, so moving between the two is one
 * continuous shape, not two surfaces swapping.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useActivities } from '@/lib/activities/store';
import { islandLayout } from '@/lib/activities/priority';
import { runOpenAction } from '@/lib/activities/actions';
import { useCallMedia } from '@/lib/activities/call-media';
import type { AnyActivity } from '@/lib/activities/types';
import { present } from './presentations';
import { useMotionPreset } from './motion';
import { useNow } from './useNow';
import s from './activities.module.css';

export const CALL_SURFACE_ID = 'live-call-surface';

const hasTimer = (a: AnyActivity | null) => !!a && ((a.kind === 'call' && !!a.state.connectedAt) || a.kind === 'recording');

export function Island() {
  const activities = useActivities((st) => st.activities);
  const presentation = useActivities((st) => st.presentation);
  const expandedId = useActivities((st) => st.expandedId);
  const expand = useActivities((st) => st.expand);
  const dismiss = useActivities((st) => st.dismiss);
  const setPresentation = useActivities((st) => st.setPresentation);
  const controls = useCallMedia((st) => st.controls);
  const motionPreset = useMotionPreset();

  // The small circle can bring the second activity forward for as long as it exists.
  const [pinned, setPinned] = useState<string | null>(null);
  // Auto-expanded activities the user collapsed stay collapsed.
  const [collapsedAuto, setCollapsedAuto] = useState<Set<string>>(() => new Set());

  const layout = useMemo(() => islandLayout(activities, presentation), [activities, presentation]);
  const pinnedActivity = pinned ? activities.find((a) => a.id === pinned) ?? null : null;
  const primary = pinnedActivity ?? layout.primary;
  const secondary = pinnedActivity ? (layout.primary?.id === pinned ? layout.secondary : layout.primary) : layout.secondary;
  const now = useNow(hasTimer(primary));

  useEffect(() => { if (pinned && !pinnedActivity) setPinned(null); }, [pinned, pinnedActivity]);

  const ctx = useMemo(
    () => ({
      now,
      controls,
      toWindow: () => setPresentation('window'),
      dismiss: () => primary && dismiss(primary.id),
    }),
    [now, controls, setPresentation, dismiss, primary],
  );
  const view = primary ? present(primary, ctx) : null;
  const auto = !!primary && primary.id === layout.primary?.id && layout.autoExpand && !collapsedAuto.has(primary.id);
  const expanded = !!view?.expanded && (expandedId === primary?.id || auto);

  const wrapRef = useRef<HTMLDivElement>(null);

  // Focus the first action of something that opened by itself (an incoming call: Answer).
  useEffect(() => {
    if (!expanded || !auto) return;
    const el = wrapRef.current?.querySelector<HTMLElement>('[data-autofocus]');
    el?.focus({ preventScroll: true });
  }, [expanded, auto, primary?.id]);

  const collapse = () => {
    if (!primary) return;
    if (auto) setCollapsedAuto((prev) => new Set(prev).add(primary.id));
    expand(null);
  };

  // Escape and outside taps collapse.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') collapse(); };
    const onDown = (e: PointerEvent) => { if (!wrapRef.current?.contains(e.target as Node)) collapse(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, primary?.id, auto]);

  const onCapsule = () => {
    if (!primary || !view) return;
    if (primary.kind === 'message') {
      runOpenAction(primary.id);
      dismiss(primary.id);
      return;
    }
    if (view.expanded) expand(primary.id);
  };

  const isCall = primary?.kind === 'call';
  return (
    <div ref={wrapRef} className={s.islandWrap}>
      <AnimatePresence>
      {primary && view && (
      <motion.div
        key={isCall ? CALL_SURFACE_ID : 'island-primary'}
        layout
        layoutId={isCall ? CALL_SURFACE_ID : 'island-primary'}
        className={`${s.island} ${expanded ? s.expanded : ''}`}
        style={{ borderRadius: expanded ? 28 : 999 }}
        transition={motionPreset.morph}
        initial={motionPreset.appear.initial}
        animate={motionPreset.appear.animate}
        exit={motionPreset.appear.exit}
        role={expanded ? 'group' : undefined}
        aria-label={expanded ? view.spoken : undefined}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {expanded ? (
            <motion.div key={`x-${primary.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
              {view.expanded}
            </motion.div>
          ) : (
            <motion.button
              key={`c-${primary.id}`}
              type="button"
              className={s.compact}
              onClick={onCapsule}
              aria-label={view.spoken}
              aria-expanded={view.expanded ? false : undefined}
              style={{ background: 'transparent', border: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', width: '100%' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              {view.leading}
              <span className={s.label}>{view.label}</span>
              {view.trailing}
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
      )}
      </AnimatePresence>

      <AnimatePresence>
        {primary && secondary && !expanded && (
          <motion.button
            key="island-minimal"
            layoutId="island-minimal"
            type="button"
            className={s.minimal}
            onClick={() => setPinned(secondary.id)}
            aria-label={`${present(secondary, ctx).spoken}. Show`}
            transition={motionPreset.morph}
            initial={motionPreset.appear.initial}
            animate={motionPreset.appear.animate}
            exit={motionPreset.appear.exit}
          >
            {present(secondary, ctx).minimal}
            {layout.overflow > 0 && <span className={s.overflow} aria-hidden="true">+{layout.overflow}</span>}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
