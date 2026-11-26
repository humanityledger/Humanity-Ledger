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

/** iPadOS Safari reports a Mac user agent; a touch screen gives it away. */
export function isAppleTouch(ua: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
}

export interface ProverProfile {
  threads: number;
  /** G1 points for the Chonk SRS: 2^18 (~16.7 MB) on constrained devices, else 2^19. */
  srsSize: number;
  /** WebAssembly page cap (64 KiB pages) on constrained devices; undefined = bb.js default. */
  memoryMaxPages?: number;
  constrained: boolean;
}

export const SRS_SMALL = 2 ** 18;
export const SRS_FULL = 2 ** 19;

/**
 * bb.js only shrinks the SRS for /iPad|iPhone/: iPadOS (Mac UA), Android
 * phones with 2–4 GB and low-RAM laptops still reserved the full 2^19 SRS and
 * its FFT mirrors. Constrained devices get 2^18 and a 1.5 GiB memory ceiling;
 * if a transaction ever needs the larger SRS, the prover retries once with it.
 */
export function proverProfile(c: DeviceCaps & { userAgent?: string; maxTouchPoints?: number }): ProverProfile {
  const apple = isAppleTouch(c.userAgent ?? '', c.maxTouchPoints ?? 0);
  const mem = c.deviceMemoryGb ?? (c.mobile || apple ? 4 : 8);
  const constrained = apple || c.mobile || mem <= 4;
  return {
    threads: proverThreads({ ...c, mobile: c.mobile || apple }),
    srsSize: constrained ? SRS_SMALL : SRS_FULL,
    memoryMaxPages: constrained ? 24_576 : undefined, // 24,576 × 64 KiB = 1.5 GiB
    constrained,
  };
}

export function readProverCaps(): DeviceCaps & { userAgent: string; maxTouchPoints: number } {
  const nav = (globalThis as { navigator?: Navigator }).navigator;
  return { ...readDeviceCaps(), userAgent: nav?.userAgent ?? '', maxTouchPoints: nav?.maxTouchPoints ?? 0 };
}
