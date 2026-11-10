/**
 * A wallet signature request that never answers (WalletConnect relay drop,
 * Safari iOS suspending the tab) must not hang sign-in forever. The message
 * says "expired" so the caller does not retry it: the user starts over with a
 * fresh nonce. A late answer to an expired request resolves nothing.
 */
export function withSignTimeout<T>(request: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    request,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('signature request expired')), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
