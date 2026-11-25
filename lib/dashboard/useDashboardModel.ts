'use client';

/**
 * lib/dashboard/useDashboardModel.ts — runs computeModel in a Web Worker, on the main thread when
 * a worker cannot start (old Safari, a CSP that refuses it, a crashed worker). Only the latest
 * request's answer is kept, so typing in a filter never shows an older result.
 */
import { useEffect, useRef, useState } from 'react';
import { computeModel, type DashInputs, type DashModel } from './model';

export function useDashboardModel(input: DashInputs | null): { model: DashModel | null; worker: boolean } {
  const [model, setModel] = useState<DashModel | null>(null);
  const [worker, setWorker] = useState(false);
  const ref = useRef<Worker | null>(null);
  const seq = useRef(0);
  const failed = useRef(false);

  useEffect(() => {
    if (typeof Worker === 'undefined') return;
    try {
      const w = new Worker(new URL('./model.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<{ id: number; model?: DashModel; error?: string }>) => {
        if (e.data.id !== seq.current) return;
        if (e.data.model) setModel(e.data.model);
      };
      w.onerror = () => {
        failed.current = true;
        setWorker(false);
      };
      ref.current = w;
      setWorker(true);
      return () => {
        w.terminate();
        ref.current = null;
      };
    } catch {
      failed.current = true;
    }
  }, []);

  useEffect(() => {
    if (!input) {
      setModel(null);
      return;
    }
    const id = ++seq.current;
    const w = ref.current;
    if (w && !failed.current) {
      try {
        w.postMessage({ id, input });
        return;
      } catch {
        failed.current = true;
      }
    }
    setModel(computeModel(input));
  }, [input, worker]);

  return { model, worker: worker && !failed.current };
}
