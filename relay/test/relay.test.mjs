// Standalone: cd relay && npm test   (node --test test/relay.test.mjs)
import { test } from 'node:test';
import { CASES } from './cases.mjs';

for (const c of CASES) test(c.name, c.fn);
