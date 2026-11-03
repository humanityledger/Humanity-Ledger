// lib/cross-fetch-ponyfill.js
// Universal CommonJS fetch ponyfill using native globalThis.fetch (Node.js 18+).
// Resolves ERR_REQUIRE_ESM caused by CJS dependencies (e.g., @walletconnect) requiring 'node-fetch'.

const nativeFetch = typeof globalThis !== 'undefined' && globalThis.fetch
  ? globalThis.fetch.bind(globalThis)
  : () => Promise.reject(new Error('native fetch is not available'));

const fetch = function (url, options) {
  if (typeof url === 'string' && /^\/\//.test(url)) {
    url = 'https:' + url;
  }
  return nativeFetch(url, options);
};

fetch.fetch = fetch;
fetch.default = fetch;
fetch.ponyfill = true;
if (typeof globalThis !== 'undefined') {
  fetch.Headers = globalThis.Headers;
  fetch.Request = globalThis.Request;
  fetch.Response = globalThis.Response;
}

module.exports = fetch;
module.exports.default = fetch;
module.exports.fetch = fetch;
if (typeof globalThis !== 'undefined') {
  module.exports.Headers = globalThis.Headers;
  module.exports.Request = globalThis.Request;
  module.exports.Response = globalThis.Response;
}
