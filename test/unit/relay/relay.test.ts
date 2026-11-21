/**
 * Ledger Relay (relay/): the same cases as `npm test` in relay/, run in the repository suite so CI
 * covers the relay without a workflow of its own. Signalling over a real WebSocket needs the `ws`
 * package and is covered by the hub's protocol cases here.
 */
import { describe, it } from 'vitest';
// @ts-expect-error plain ESM with JSDoc types, no declaration file
import { CASES } from '../../../relay/test/cases.mjs';

describe('Ledger Relay v0', () => {
  for (const c of CASES as { name: string; fn: () => Promise<void> | void }[]) it(c.name, c.fn, 20_000);
});
