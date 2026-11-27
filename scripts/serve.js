#!/usr/bin/env node
/**
 * scripts/serve.js — runs `next start` and shuts it down gracefully (27 Nov 2026).
 *
 * Before: start.sh ran `exec npx next start`. On every deploy Railway sends the previous
 * deployment SIGTERM once the new one is active; npm passed it on and Next.js exited at once,
 * cutting any request still in flight on the old container (and npm logged "command failed
 * signal SIGTERM" as an error each time). Under heavy traffic that is a burst of failed
 * requests per deploy.
 *
 * Now: Next.js runs as a direct child of this process (no npm in between). On SIGTERM/SIGINT the
 * child keeps serving for SHUTDOWN_GRACE_MS (default 15 s) while the platform routes new traffic
 * to the new deployment, then gets SIGTERM; if it has not exited SHUTDOWN_KILL_MS later (default
 * 10 s) it is killed. railway.toml's drainingSeconds must cover both (it is 30).
 * If the child exits on its own (a crash), this process exits with its code so Railway restarts.
 *
 * SERVE_CHILD (tests only): a JS file to run instead of Next.js.
 */
'use strict';

const { spawn } = require('node:child_process');

function nextBin() {
  try {
    return require.resolve('next/dist/bin/next', { paths: [process.cwd()] });
  } catch {
    return null;
  }
}

function main() {
  const port = process.env.PORT || '8080';
  const host = process.env.HOSTNAME_BIND || '0.0.0.0';
  const graceMs = Math.max(0, Number(process.env.SHUTDOWN_GRACE_MS ?? 15000) || 0);
  const killMs = Math.max(1000, Number(process.env.SHUTDOWN_KILL_MS ?? 10000) || 10000);

  const testChild = process.env.SERVE_CHILD;
  const bin = testChild || nextBin();
  const args = testChild ? [] : ['start', '-p', port, '-H', host];
  const child = bin
    ? spawn(process.execPath, [bin, ...args], { stdio: 'inherit', env: process.env })
    : spawn('npx', ['next', 'start', '-p', port, '-H', host], { stdio: 'inherit', env: process.env });

  let stopping = false;
  const stop = (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(`[serve] ${signal}: serving in-flight requests for ${Math.round(graceMs / 1000)} s, then stopping.`);
    setTimeout(() => {
      try { child.kill('SIGTERM'); } catch { /* already gone */ }
      setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* already gone */ }
      }, killMs).unref();
    }, graceMs).unref();
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));

  child.on('exit', (code, signal) => {
    if (stopping) {
      console.log('[serve] Stopped.');
      process.exit(0);
    }
    console.error(`[serve] next start exited unexpectedly (code ${code}, signal ${signal || 'none'}).`);
    process.exit(code == null ? 1 : code || 1);
  });
  child.on('error', (err) => {
    console.error(`[serve] could not start next: ${err && err.message ? err.message : err}`);
    process.exit(1);
  });
}

main();
