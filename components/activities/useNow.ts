'use client';
/**
 * One shared clock for every timer on screen (call, recording). It ticks on the second boundary,
 * only while something subscribes, so two timers never disagree by a second.
 */
import { useSyncExternalStore } from 'react';

let now = Date.now();
const subs = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function tick() {
  now = Date.now();
  subs.forEach((f) => f());
  timer = setTimeout(tick, 1000 - (now % 1000) + 5);
}

function subscribe(f: () => void) {
  subs.add(f);
  if (!timer) { now = Date.now(); timer = setTimeout(tick, 1000 - (now % 1000) + 5); }
  return () => {
    subs.delete(f);
    if (!subs.size && timer) { clearTimeout(timer); timer = null; }
  };
}

const noop = () => () => undefined;

/** Current time in ms, updated every second while `active`. */
export function useNow(active = true): number {
  return useSyncExternalStore(active ? subscribe : noop, () => (active ? now : 0), () => 0);
}
