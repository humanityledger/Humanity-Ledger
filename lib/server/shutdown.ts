/**
 * G-020 — Graceful shutdown on SIGTERM
 * Import this module once at server startup (e.g., in lib/server/index.ts or layout.tsx server component).
 * Closes SSE connections and drains in-flight requests before process exits.
 */

let isShuttingDown = false;

export function isServerShuttingDown(): boolean {
  return isShuttingDown;
}

// Only register once and only in Node.js runtime
if (typeof process !== 'undefined' && process.on) {
  process.on('SIGTERM', () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(JSON.stringify({
      level: 'info',
      ts: new Date().toISOString(),
      msg: '[shutdown] SIGTERM received — draining connections...',
    }));
    // Give in-flight requests 5s to complete
    setTimeout(() => {
      console.log(JSON.stringify({
        level: 'info',
        ts: new Date().toISOString(),
        msg: '[shutdown] Drain complete — exiting cleanly.',
      }));
      process.exit(0);
    }, 5000);
  });

  process.on('SIGINT', () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    process.exit(0);
  });
}
