import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Railway passes a service variable to a Dockerfile build only when the Dockerfile declares it with
// ARG. A NEXT_PUBLIC_* value the client reads must therefore be declared, or it is never inlined.
const dockerfile = readFileSync(path.join(process.cwd(), 'Dockerfile'), 'utf8');
const declared = new Set([...dockerfile.matchAll(/^ARG\s+([A-Z0-9_]+)/gm)].map((m) => m[1]));

describe('Dockerfile build arguments for calls', () => {
  it.each([
    'NEXT_PUBLIC_LEDGER_RELAY',
    'NEXT_PUBLIC_LEDGER_RELAYS',
    'NEXT_PUBLIC_LEDGER_RELAY_PIN',
    'NEXT_PUBLIC_PEERJS_HOST',
    'NEXT_PUBLIC_PEERJS_PORT',
    'NEXT_PUBLIC_PEERJS_PATH',
    'NEXT_PUBLIC_PEERJS_KEY',
  ])('declares %s', (name) => {
    expect(declared.has(name)).toBe(true);
  });
});
