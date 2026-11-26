/**
 * lib/chat/poll-runner.ts — a periodic job that never overlaps itself.
 *
 * The chat's global sync (LedgerChatV2) is started by a 10 s interval, by the page becoming
 * visible and by the network coming back. A run can take longer than the interval, and each start
 * used to begin another run on the same conversations. Here a start during a run records that one
 * more run is wanted; it begins when the current run ends. Any number of starts during a run give
 * one follow-up run, so a burst of events never queues a burst of runs.
 */
export function createSingleFlightRunner(run: () => Promise<void>, isStopped: () => boolean = () => false): () => Promise<void> {
  let running: Promise<void> | null = null;
  let again = false;
  const start = (): Promise<void> => {
    if (isStopped()) return Promise.resolve();
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          again = false;
          try { await run(); } catch { /* a failed run is followed by the next one as usual */ }
        } while (again && !isStopped());
      } finally {
        running = null;
      }
    })();
    return running;
  };
  return start;
}
