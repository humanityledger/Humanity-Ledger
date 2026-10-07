/**
 * server.js — Standalone Next.js server for the Electron app bundle.
 * Runs the pre-built Next.js app on a local port so Electron can load it.
 */
const { createServer } = require('http');
const { parse }        = require('url');
const next             = require('next');
const path             = require('path');

const port     = parseInt(process.env.PORT || '3456', 10);
const hostname = process.env.HOSTNAME || '127.0.0.1';

// When packaged by electron-builder, __dirname is inside the app.asar.
// process.resourcesPath points to the Resources folder containing app/.
const appDir = app && app.isPackaged
  ? path.join(process.resourcesPath, 'app')
  : path.join(__dirname);

let app;
try {
  // Try to get the Electron app reference (available when run via Electron main)
  app = require('electron').app;
} catch {
  app = null;
}

const nextApp = next({
  dev:      false,
  dir:      __dirname,
  hostname,
  port,
  // Tell Next.js where to find the pre-built output
  conf:     require(path.join(__dirname, 'next.config.js')),
});

const handle = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, hostname, () => {
    console.log(`> Ledger Chat Desktop ready on http://${hostname}:${port}`);
  });
}).catch(err => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
