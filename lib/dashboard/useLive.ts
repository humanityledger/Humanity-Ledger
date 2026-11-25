'use client';

/**
 * lib/dashboard/useLive.ts — binds a LiveSource (lib/dashboard/live.ts) to the page: started while
 * `enabled`, paused while the tab is hidden, kicked when the browser comes back online. The read is
 * a private-wallet method running in this tab; nothing here talks to a server.
 */
import { useEffect, useRef, useState } from 'react';
import { LiveSource, type LiveOptions, type LiveState } from './live';

export function useLive<T>(enabled: boolean, opts: Omit<LiveOptions<T>, 'now' | 'setTimer' | 'clearTimer'>): [LiveState<T>, () => void] {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const src = useRef<LiveSource<T> | null>(null);
  const [state, setState] = useState<LiveState<T>>({ status: 'idle', failures: 0 });

  useEffect(() => {
    if (!enabled) return;
    const s = new LiveSource<T>({
      everyMs: optsRef.current.everyMs,
      maxBackoffMs: optsRef.current.maxBackoffMs,
      firstReadMs: optsRef.current.firstReadMs,
      read: () => optsRef.current.read(),
      canRead: () => (optsRef.current.canRead ? optsRef.current.canRead() : true),
    });
    src.current = s;
    const off = s.subscribe(setState);
    const vis = () => s.setVisible(document.visibilityState === 'visible');
    const on = () => s.setOnline(true);
    const offline = () => s.setOnline(false);
    vis();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) s.setOnline(false);
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('online', on);
    window.addEventListener('offline', offline);
    s.start();
    return () => {
      off();
      s.stop();
      src.current = null;
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', offline);
    };
  }, [enabled]);

  return [state, () => src.current?.kick()];
}
