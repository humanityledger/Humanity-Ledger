import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHUNK_RELOAD_KEY, RELOAD_GAP_MS, isChunkLoadError, reloadAllowed } from '@/lib/errors/chunk-recovery';
import { canUseCssZoom } from '@/components/landing/v2/deviceScale';

const root = join(__dirname, '../../..');

describe('chunk load errors', () => {
  it('recognises the errors webpack and Safari raise', () => {
    // The one seen on iPhone, 14 Nov 2026.
    expect(isChunkLoadError(new Error('Loading chunk 72089 failed.\n(error: https://ledgerchat.org/_next/static/chunks/72089-1e68a9e8d5d11dad.js)'))).toBe(true);
    expect(isChunkLoadError({ name: 'ChunkLoadError', message: '' })).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /x.js'))).toBe(true);
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  it('reloads again after the gap, never twice inside it', () => {
    const t = 1_000_000;
    expect(reloadAllowed(null, t)).toBe(true);
    expect(reloadAllowed(t, t + 1000)).toBe(false);
    expect(reloadAllowed(t, t + RELOAD_GAP_MS + 1)).toBe(true);
    expect(reloadAllowed(Number.NaN, t)).toBe(true);
    // A clock set back must not lock reloads out.
    expect(reloadAllowed(t + 60_000, t)).toBe(true);
  });

  it('shares its key with the inline recovery script, so the two never reload in turn', () => {
    const layout = readFileSync(join(root, 'app/layout.tsx'), 'utf8');
    expect(layout).toContain(`'${CHUNK_RELOAD_KEY}'`);
  });

  it('never shows a stack trace or the old panic screen in production', () => {
    const globalError = readFileSync(join(root, 'app/global-error.tsx'), 'utf8');
    expect(globalError).not.toMatch(/Kernel Panic|Force Terminal Restart|error\.stack/i);
    expect(globalError).toMatch(/dev && error\?\.message/);
    const chatError = readFileSync(join(root, 'app/chat/error.tsx'), 'utf8');
    expect(chatError).not.toMatch(/error\.stack/);
    expect(chatError).not.toMatch(/__disconnected__/);
  });
});

describe('iPhone mockup scaling', () => {
  const ua = {
    iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
    macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
    chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    androidChrome: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
    firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  };

  it('uses the transform on WebKit (every iPhone browser, Safari on Mac)', () => {
    expect(canUseCssZoom(ua.iosSafari, true)).toBe(false);
    expect(canUseCssZoom(ua.iosChrome, true)).toBe(false);
    expect(canUseCssZoom(ua.macSafari, true)).toBe(false);
  });

  it('keeps CSS zoom on Blink and Gecko, and never without support', () => {
    expect(canUseCssZoom(ua.chrome, true)).toBe(true);
    expect(canUseCssZoom(ua.androidChrome, true)).toBe(true);
    expect(canUseCssZoom(ua.edge, true)).toBe(true);
    expect(canUseCssZoom(ua.firefox, true)).toBe(true);
    expect(canUseCssZoom(ua.chrome, false)).toBe(false);
  });
});
