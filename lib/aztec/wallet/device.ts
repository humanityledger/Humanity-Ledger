/**
 * R-16: proving an Aztec transaction in the browser peaks at about 1.8 GB of
 * memory (UltraHonk in bb.js), above what Safari on iPhone and iPad gives one
 * tab (about 1.5 GB). Not validated on real devices yet. This only decides
 * whether to warn; it never blocks (testnet and capable devices keep working).
 * A proof that runs out of memory sends nothing.
 */
export interface DeviceHints {
  userAgent?: string;
  maxTouchPoints?: number;
  /** navigator.deviceMemory (Chromium only), in GB, rounded down by the browser. */
  deviceMemory?: number;
}

export function provingMemoryAtRisk(d: DeviceHints): boolean {
  const ua = d.userAgent ?? '';
  // iPadOS reports a Mac user agent; touch support tells them apart.
  const apple = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (d.maxTouchPoints ?? 0) > 1);
  if (apple) return true;
  return typeof d.deviceMemory === 'number' && d.deviceMemory > 0 && d.deviceMemory <= 4;
}

export function currentDeviceHints(): DeviceHints {
  if (typeof navigator === 'undefined') return {};
  return { userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints, deviceMemory: (navigator as any).deviceMemory };
}

export const PROVING_MEMORY_WARNING =
  'Proving needs about 1.8 GB of memory. On this device it may fail or reload the page; if it does, nothing is sent. A computer is more reliable for this step.';
