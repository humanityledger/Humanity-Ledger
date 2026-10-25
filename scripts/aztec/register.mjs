// Preloaded with `node --import ./scripts/aztec/register.mjs ...`.
//
// Lets the operator scripts reuse the browser build of the Aztec wallet under
// Node, which is the only build that runs on every operating system (the Node
// build needs a native module that is not published for Windows):
//   - JSON artifacts are loaded with the right import attribute;
//   - IndexedDB is provided in memory by fake-indexeddb.

import { register } from 'node:module';
import 'fake-indexeddb/auto';

register('./json-loader.mjs', import.meta.url);
