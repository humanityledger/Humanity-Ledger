/**
 * How many Barretenberg threads a proof may use on this device. Threads need
 * SharedArrayBuffer (a cross-origin isolated page); each one adds its own
 * stack and scratch memory, so low-RAM phones get fewer to avoid the OS
 * killing the tab (iOS Jetsam, Android LMK) in the middle of a proof.
 */
export interface DeviceCaps {
  crossOriginIsolated: boolean;
  hasSharedArrayBuffer: boolean;
  hardwareConcurrency: number;
  /** navigator.deviceMemory in GB (Chromium only); undefined elsewhere. */
  deviceMemoryGb?: number;
  mobile: boolean;
}

export function proverThreads(c: DeviceCaps): number {
  if (!c.crossOriginIsolated || !c.hasSharedArrayBuffer) return 1;
  const cores = Math.max(1, Math.floor(c.hardwareConcurrency || 1));
  const mem = c.deviceMemoryGb ?? (c.mobile ? 4 : 8);
  if (mem <= 2) return 1;
  if (mem <= 4) return Math.min(2, cores);
  if (c.mobile || mem < 8) return Math.min(4, cores);
  return Math.min(16, Math.max(1, cores - 1)); // leave a core for the UI
}

export function readDeviceCaps(): DeviceCaps {
  const g = globalThis as unknown as { crossOriginIsolated?: boolean; navigator?: Navigator & { deviceMemory?: number; userAgentData?: { mobile?: boolean } } };
  const nav = g.navigator;
  return {
    crossOriginIsolated: !!g.crossOriginIsolated,
    hasSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    hardwareConcurrency: nav?.hardwareConcurrency ?? 1,
    deviceMemoryGb: nav?.deviceMemory,
    mobile: !!nav?.userAgentData?.mobile || /Android|iPhone|iPad|iPod/i.test(nav?.userAgent ?? ''),
  };
}
