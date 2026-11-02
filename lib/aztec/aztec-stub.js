/**
 * Universal stub for Aztec SDK modules.
 * Used during SSR / server-side compilation where the Aztec browser-only
 * WebAssembly and PXE packages must not be loaded or executed.
 */
function createProxy() {
  function Stub() {}
  const handler = {
    get: (target, prop) => {
      if (prop === '__esModule') return true;
      if (prop === 'then') return undefined; // Avoid Promise-like detection
      return createProxy();
    },
    apply: () => createProxy(),
    construct: () => createProxy(),
  };
  return new Proxy(Stub, handler);
}

module.exports = createProxy();
module.exports.default = createProxy();
