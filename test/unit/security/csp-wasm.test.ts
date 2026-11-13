/**
 * The private wallet's cryptography (bb.js 6.0.0) loads its WebAssembly with fetch() of a data: URL.
 * A CSP without `data:` in connect-src blocked it: "AggregateError: 2 of 2 concurrent operations
 * failed: 3 of 3 … Failed to fetch" at PXE.create (production, 12 November 2026).
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');

describe('CSP lets the wallet load its WebAssembly', () => {
  it('connect-src allows data: (and keeps wasm-unsafe-eval, blob: workers)', async () => {
    const { buildCsp } = await import('@/middleware');
    for (const dev of [false, true]) {
      const csp = buildCsp('n0nce', dev);
      const connect = /connect-src ([^;]+);/.exec(csp)![1].split(/\s+/);
      expect(connect).toEqual(expect.arrayContaining(["'self'", 'https:', 'wss:', 'blob:', 'data:']));
      expect(csp).toMatch(/script-src [^;]*'wasm-unsafe-eval'/);
      expect(csp).toMatch(/worker-src 'self' blob:/);
      // Nothing else was widened.
      expect(csp).toMatch(/object-src 'none'/);
      expect(csp).toMatch(/default-src 'self'/);
    }
  });

  it('the report-only header agrees, so reports do not cry wolf', () => {
    const cfg = fs.readFileSync(path.join(root, 'next.config.js'), 'utf8');
    expect(cfg).toMatch(/connect-src 'self' https: wss: blob: data:; frame-src/);
  });
});
