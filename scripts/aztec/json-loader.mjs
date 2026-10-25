// Node ESM loader hook used by the scripts in this folder.
//
// The Aztec browser bundle imports JSON artifacts without an import attribute,
// which bundlers accept and Node refuses. This hook adds `type: 'json'` so the
// same code runs under Node for the operator scripts.

export async function load(url, context, nextLoad) {
  if (url.endsWith('.json') && !(context.importAttributes && context.importAttributes.type)) {
    return nextLoad(url, { ...context, importAttributes: { ...(context.importAttributes || {}), type: 'json' } });
  }
  return nextLoad(url, context);
}
