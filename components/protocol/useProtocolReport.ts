'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Metric } from '@/lib/protocol/metrics';

export interface ProtocolReportView {
  schema: string;
  generatedAt: string;
  network: { name: string; l1ChainId: number; rollupVersion: number };
  anchorBlock: number | null;
  metrics: Metric[];
  digest: string;
}

export type ProtocolReportState =
  | { kind: 'loading' }
  | { kind: 'ready'; report: ProtocolReportView }
  | { kind: 'error'; at: number };

const POLL_MS = 30_000;
const TIMEOUT_MS = 10_000;

/**
 * GET /api/protocol/metrics, polled every 30 s while the tab is visible. A request that does not
 * answer within 10 s is an error, and an error replaces the figures: the last good report is never
 * shown as current (fail closed).
 */
export function useProtocolReport(): { state: ProtocolReportState; reading: boolean; reload: () => void } {
  const [state, setState] = useState<ProtocolReportState>({ kind: 'loading' });
  const [reading, setReading] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setReading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch('/api/protocol/metrics', { cache: 'no-store', signal: ctrl.signal });
      if (!res.ok) throw new Error(String(res.status));
      const report = (await res.json()) as ProtocolReportView;
      if (!Array.isArray(report?.metrics) || typeof report.digest !== 'string') throw new Error('shape');
      setState({ kind: 'ready', report });
    } catch {
      setState({ kind: 'error', at: Date.now() });
    } finally {
      clearTimeout(timer);
      inFlight.current = false;
      setReading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') void load();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  return { state, reading, reload: load };
}
