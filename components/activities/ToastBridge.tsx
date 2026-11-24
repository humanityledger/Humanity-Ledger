'use client';
/**
 * Every toast in Ledger Chat, drawn by the island.
 *
 * The app keeps calling toast(), toast.success(), toast.loading(…, { id }), toast.promise() and
 * toast.dismiss() exactly as before; nothing at the ~390 call sites changes. This component reads
 * sonner's state (useSonner) and mirrors each toast into a 'notice' activity:
 *
 *   toast appears or changes   -> start/update notice:<id> (a loading toast that later succeeds is
 *                                 one notice that changes tone, never two)
 *   its time runs out          -> onAutoClose, then toast.dismiss(id)
 *   the user swipes it away    -> onDismiss, then toast.dismiss(id)
 *   app calls toast.dismiss()  -> the notice leaves
 *   action / cancel buttons    -> run the toast's own onClick; it closes unless the handler called
 *                                 event.preventDefault() (sonner's rule)
 *
 * sonner stays the source of truth, so code that reads or dismisses toasts keeps working. The
 * root <Toaster> is gone (app/layout.tsx): one surface, never two.
 */
import { useEffect, useRef } from 'react';
import { toast as sonner, useSonner } from 'sonner';
import { useActivities } from '@/lib/activities/store';
import { setAction } from '@/lib/activities/actions';
import { noticeDuration, noticeId, noticeSignature, noticeState, type ToastLike } from '@/lib/activities/notices';
import { cancelNotice, scheduleNotice } from '@/lib/activities/notice-clock';

interface Known {
  toast: ToastLike & { onDismiss?: (t: unknown) => void; onAutoClose?: (t: unknown) => void };
  sig: string;
}

type Clickable = { onClick?: (e: unknown) => void };

export function ToastBridge() {
  const { toasts } = useSonner();
  const known = useRef(new Map<string, Known>());
  // Ids this bridge is removing itself, so the store subscription below does not echo them.
  const leaving = useRef(new Set<string>());

  useEffect(() => {
    const store = useActivities.getState();
    const seen = new Set<string>();
    for (const raw of toasts) {
      const t = raw as unknown as Known['toast'];
      const st = noticeState(t);
      if (!st) continue;
      const id = noticeId(t.id);
      seen.add(id);
      const duration = noticeDuration(t, st.tone);
      const sig = noticeSignature(st, duration);
      const prev = known.current.get(id);
      known.current.set(id, { toast: t, sig });
      if (prev?.sig === sig) continue;

      store.start('notice', { source: 'toast' }, st, { id });
      const runButton = (button: unknown) => (event?: unknown) => {
        const e = (event ?? { defaultPrevented: false, preventDefault() { (this as { defaultPrevented: boolean }).defaultPrevented = true; } }) as { defaultPrevented?: boolean };
        (button as Clickable)?.onClick?.(e);
        if (!e.defaultPrevented) close(id, 'dismiss');
      };
      setAction(id, 'action', st.action ? runButton(t.action) : undefined);
      setAction(id, 'cancel', st.cancel ? runButton(t.cancel) : undefined);
      scheduleNotice(id, duration, () => close(id, 'auto'));
    }
    // Dismissed through sonner (toast.dismiss(id) in app code, or by this bridge).
    for (const id of [...known.current.keys()]) {
      if (seen.has(id)) continue;
      known.current.delete(id);
      cancelNotice(id);
      leaving.current.add(id);
      store.dismiss(id);
      leaving.current.delete(id);
    }
  }, [toasts]);

  // Removed from the island by the user (swipe, close button, Escape on the stack).
  useEffect(() => useActivities.subscribe((state, prevState) => {
    if (state.activities === prevState.activities) return;
    const ids = new Set(state.activities.map((a) => a.id));
    for (const a of prevState.activities) {
      if (a.kind !== 'notice' || ids.has(a.id) || leaving.current.has(a.id)) continue;
      const k = known.current.get(a.id);
      if (!k) continue;
      cancelNotice(a.id);
      try { k.toast.onDismiss?.(k.toast); } catch { /* app callback */ }
      sonner.dismiss(k.toast.id);
    }
  }), []);

  /** Ends a notice the way sonner would: callback first, then dismiss through sonner. */
  function close(id: string, why: 'auto' | 'dismiss') {
    const k = known.current.get(id);
    cancelNotice(id);
    if (!k) { useActivities.getState().dismiss(id); return; }
    try {
      if (why === 'auto') k.toast.onAutoClose?.(k.toast);
      else k.toast.onDismiss?.(k.toast);
    } catch { /* app callback */ }
    // sonner's state drops it; the effect above then removes the notice.
    leaving.current.add(id);
    sonner.dismiss(k.toast.id);
    queueMicrotask(() => leaving.current.delete(id));
  }

  // Leave nothing behind on unmount (hot reload).
  useEffect(() => () => { for (const id of known.current.keys()) cancelNotice(id); }, []);

  return null;
}

export default ToastBridge;
