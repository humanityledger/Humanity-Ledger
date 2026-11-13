#!/usr/bin/env node
/**
 * scripts/aztec/fee-juice-slot.mjs — P-12.
 *
 *   node --import ./scripts/aztec/register.mjs scripts/aztec/fee-juice-slot.mjs <aztec address>
 *
 * Prints where an account's Fee Juice balance lives in public storage, as the Aztec SDK itself
 * computes it: getFeeJuiceBalance(owner, node) is called with a node that only records the
 * getPublicStorageAt(...) call it receives. Nothing about the slot (map slot number, hash,
 * separator) or the order of the RPC parameters is assumed here.
 *
 * Run once when LedgerSponsor is deployed and record the output in
 * deployments/aztec-mainnet.json → sponsoredFpc (address, feeJuiceContract, feeJuiceBalanceSlot).
 * /protocol then reads that slot with node_getPublicStorageAt; test/unit/protocol/
 * sponsor-balance-slot.test.ts checks the recorded slot against the SDK on every PR.
 */
import { AztecAddress } from '@aztec-labs/aztec.js/addresses';
import { Fr } from '@aztec-labs/aztec.js/fields';
import { getFeeJuiceBalance } from '@aztec-labs/aztec.js/utils';

/**
 * The owner as an AztecAddress. SDK v6 has no AztecAddress.fromString (CI printed its statics:
 * fromStringUnsafe, fromBuffer, fromFields, ...): fromStringUnsafe parses the hex without the curve
 * check, which a storage slot computation does not need.
 */
function toAztecAddress(owner) {
  if (typeof AztecAddress.fromStringUnsafe === 'function') return AztecAddress.fromStringUnsafe(owner);
  if (typeof AztecAddress.fromString === 'function') return AztecAddress.fromString(owner);
  throw new Error(`no AztecAddress parser (statics: ${Object.getOwnPropertyNames(AztecAddress).slice(0, 12).join(',')})`);
}

export async function captureFeeJuiceRead(owner) {
  const calls = [];
  const node = new Proxy(
    {},
    {
      get: (_t, prop) => prop === 'then' ? undefined : async (...args) => {
        calls.push({ method: String(prop), args });
        if (prop === 'getPublicStorageAt') return new Fr(0n);
        throw new Error(`unexpected node call ${String(prop)}`);
      },
    },
  );
  await getFeeJuiceBalance(toAztecAddress(owner), node);
  const read = calls.find((c) => c.method === 'getPublicStorageAt');
  if (!read || calls.length !== 1) throw new Error(`expected one getPublicStorageAt call, got ${calls.map((c) => c.method).join(', ')}`);
  const [block, contract, slot] = read.args;
  return { block: String(block), feeJuiceContract: contract.toString(), feeJuiceBalanceSlot: slot.toString() };
}

if (process.argv[1] && process.argv[1].endsWith('fee-juice-slot.mjs')) {
  const owner = process.argv[2];
  if (!/^0x[0-9a-fA-F]{64}$/.test(owner || '')) {
    console.error('Usage: fee-juice-slot.mjs <aztec address, 0x + 64 hex>');
    process.exit(2);
  }
  const r = await captureFeeJuiceRead(owner);
  console.log(JSON.stringify({ address: owner.toLowerCase(), feeJuiceContract: r.feeJuiceContract, feeJuiceBalanceSlot: r.feeJuiceBalanceSlot }, null, 2));
}
