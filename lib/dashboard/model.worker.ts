/**
 * lib/dashboard/model.worker.ts — the dashboard's arithmetic off the main thread. It receives the
 * device's own records from the page and returns the computed model; it has no network access of
 * its own to use, and reads nothing else.
 */
import { computeModel, type DashInputs } from './model';

const scope = self as unknown as { onmessage: ((e: MessageEvent<{ id: number; input: DashInputs }>) => void) | null; postMessage: (m: unknown) => void };

scope.onmessage = (e) => {
  const { id, input } = e.data;
  try {
    scope.postMessage({ id, model: computeModel(input) });
  } catch (err) {
    scope.postMessage({ id, error: String((err as Error)?.message ?? err) });
  }
};
