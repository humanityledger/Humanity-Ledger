/**
 * A wallet signature request that never answers (WalletConnect relay drop,
 * Safari iOS suspending the tab) must not hang sign-in forever. The message
 * says "expired" so the caller does not retry it: the user starts over with a
 * fresh nonce. A late answer to an expired request resolves nothing.
 *
 * pauseWhileHidden (phone browsers): the clock stops while the tab is hidden,
 * which is when the person is in the wallet app approving. iOS freezes the
 * tab's timers there and fires every overdue one the moment the person comes
 * back, before the relay socket has reconnected and delivered the wallet's
 * answer; a wall-clock timer then failed sign-ins the wallet had approved.
 * On return the request gets at least `graceMs` more for that answer to arrive.
 */
export interface SignTimeoutOptions {
  pauseWhileHidden?: boolean;
  /** Minimum time left after the tab becomes visible again. Default 30 s. */
  graceMs?: number;
  /** For tests; the page's document otherwise. */
  doc?: VisibilitySource;
}

export interface VisibilitySource {
  readonly visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export function withSignTimeout<T>(request: Promise<T>, ms: number, opts: SignTimeoutOptions = {}): Promise<T> {
  const doc: VisibilitySource | undefined = opts.pauseWhileHidden ? opts.doc ?? (typeof document !== 'undefined' ? document : undefined) : undefined;

  if (!doc) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('signature request expired')), ms);
      }),
    ]).finally(() => clearTimeout(timer));
  }

  const grace = Math.max(0, opts.graceMs ?? 30_000);
  return new Promise<T>((resolve, reject) => {
    let remaining = ms;
    let startedAt = 0;
    let visibleSince = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;

    const stop = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };
    const finish = () => {
      settled = true;
      stop();
      doc.removeEventListener('visibilitychange', onVisibility);
    };
    const run = (budget: number) => {
      stop();
      startedAt = Date.now();
      remaining = budget;
      timer = setTimeout(fire, budget);
    };
    function fire() {
      timer = undefined;
      if (settled) return;
      // A timer iOS held while the tab was frozen and fires on return, without a "hidden" event
      // having been seen: still give the answer its grace period.
      const sinceVisible = Date.now() - visibleSince;
      if (doc!.visibilityState !== 'visible') {
        remaining = 0;
        return; // resumes with the grace period when the tab is visible again
      }
      if (sinceVisible < grace) {
        run(grace - sinceVisible);
        return;
      }
      finish();
      reject(new Error('signature request expired'));
    }
    function onVisibility() {
      if (settled) return;
      if (doc!.visibilityState === 'visible') {
        visibleSince = Date.now();
        if (timer === undefined) run(Math.max(remaining, grace));
      } else if (timer !== undefined) {
        remaining = Math.max(0, remaining - (Date.now() - startedAt));
        stop();
      }
    }

    doc.addEventListener('visibilitychange', onVisibility);
    if (doc.visibilityState === 'visible') run(ms);

    request.then(
      (v) => {
        if (settled) return;
        finish();
        resolve(v);
      },
      (e) => {
        if (settled) return;
        finish();
        reject(e);
      },
    );
  });
}
