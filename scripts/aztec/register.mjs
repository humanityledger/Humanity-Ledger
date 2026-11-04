// Preloaded with `node --import ./scripts/aztec/register.mjs ...`.
//
// Lets the operator scripts reuse the browser build of the Aztec wallet under
// Node, which is the only build that runs on every operating system (the Node
// build needs a native module that is not published for Windows):
//   - JSON artifacts are loaded with the right import attribute;
//   - IndexedDB is provided in memory by fake-indexeddb.

import { register } from 'node:module';
import 'fake-indexeddb/auto';

// Node 20 polyfill for ECMAScript 2024 Set methods required by @aztec-labs/pxe
if (!Set.prototype.intersection) {
  Set.prototype.intersection = function (other) {
    const res = new Set();
    for (const elem of this) {
      if (other.has(elem)) res.add(elem);
    }
    return res;
  };
}
if (!Set.prototype.union) {
  Set.prototype.union = function (other) {
    const res = new Set(this);
    for (const elem of other) res.add(elem);
    return res;
  };
}
if (!Set.prototype.difference) {
  Set.prototype.difference = function (other) {
    const res = new Set();
    for (const elem of this) {
      if (!other.has(elem)) res.add(elem);
    }
    return res;
  };
}

register('./json-loader.mjs', import.meta.url);
