// scripts/patch-cross-fetch.js
// Patches cross-fetch node-ponyfill.js files across node_modules to use globalThis.fetch
// instead of require('node-fetch') which throws ERR_REQUIRE_ESM on Node.js with node-fetch v3.

const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.resolve(__dirname, '../node_modules/cross-fetch/dist/node-ponyfill.js'),
  path.resolve(__dirname, '../node_modules/@walletconnect/jsonrpc-http-connection/node_modules/cross-fetch/dist/node-ponyfill.js'),
  path.resolve(__dirname, '../node_modules/@trufflesuite/eth-json-rpc-infura/node_modules/cross-fetch/dist/node-ponyfill.js'),
  path.resolve(__dirname, '../node_modules/@trufflesuite/web3-provider-engine/node_modules/cross-fetch/dist/node-ponyfill.js'),
];

const patchedContent = `const realFetch = globalThis.fetch || (function() {
  try {
    const nf = require('node-fetch');
    return nf.default || nf;
  } catch {
    return globalThis.fetch;
  }
})();

const fetch = function (url, options) {
  if (/^\\/\\//.test(url)) {
    url = 'https:' + url;
  }
  return realFetch.call(this, url, options);
};

fetch.ponyfill = true;

module.exports = exports = fetch;
exports.fetch = fetch;
exports.Headers = globalThis.Headers || (realFetch && realFetch.Headers);
exports.Request = globalThis.Request || (realFetch && realFetch.Request);
exports.Response = globalThis.Response || (realFetch && realFetch.Response);
exports.default = fetch;
`;

let patchedCount = 0;
for (const file of targetFiles) {
  try {
    if (fs.existsSync(file)) {
      const current = fs.readFileSync(file, 'utf8');
      if (!current.includes('globalThis.fetch')) {
        fs.writeFileSync(file, patchedContent, 'utf8');
        patchedCount++;
      }
    }
  } catch (err) {
    console.warn('[Patch cross-fetch] Error patching', file, err.message);
  }
}

if (patchedCount > 0) {
  console.log(`[Patch cross-fetch] Successfully patched ${patchedCount} cross-fetch file(s) to use globalThis.fetch.`);
}
