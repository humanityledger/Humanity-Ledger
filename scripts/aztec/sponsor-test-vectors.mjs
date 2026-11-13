// Prints the test vectors in contracts/aztec/sponsor/src/test.nr (fixed test-only key 11..11), digest V2.
//
//   node scripts/aztec/sponsor-test-vectors.mjs <instance address> <chain id> <rollup version>
//
// The instance is the TXE address of the test sponsor (deterministic for a fresh TestEnvironment; the
// test the_binding_names_this_instance_and_network checks it), chain id and version are the TXE's.
import crypto from 'node:crypto';
const N = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
const [instance = '0x2c8dac6596b1ce2388c87d0a989c823d0a9ed527a9e18d6abdd5ee7daea4fab3', chain = '1', version = '1'] = process.argv.slice(2);
// Fixed test key (test-only, never used anywhere real).
const priv = Buffer.from('11'.repeat(32), 'hex');
const ecdh = crypto.createECDH('secp256k1'); ecdh.setPrivateKey(priv);
const pub = ecdh.getPublicKey(); const x = pub.subarray(1, 33), y = pub.subarray(33, 65);
const pkcs8 = Buffer.concat([Buffer.from('302e0201010420', 'hex'), priv, Buffer.from('a00706052b8104000a', 'hex')]);
const key = crypto.createPrivateKey({ key: pkcs8, format: 'der', type: 'sec1' });
const TAG = Buffer.from('HL-SPONSOR-V2\0\0\0', 'latin1');
const be = (v, n) => Buffer.from(BigInt(v).toString(16).padStart(n * 2, '0'), 'hex');
function voucher(id, exp) {
  const msg = Buffer.concat([TAG, be(instance, 32), be(chain, 32), be(version, 32), be(id, 32), be(exp, 8)]);
  const der = crypto.sign('sha256', msg, { key, dsaEncoding: 'ieee-p1363' });
  const r = BigInt('0x' + der.subarray(0, 32).toString('hex'));
  let s = BigInt('0x' + der.subarray(32).toString('hex'));
  if (s > N / 2n) s = N - s;
  return { digest: crypto.createHash('sha256').update(msg).digest('hex'), sig: Buffer.concat([be(r, 32), be(s, 32)]) };
}
const arr = (b) => '[' + [...b].map((v) => '0x' + v.toString(16).padStart(2, '0')).join(', ') + ']';
const v1 = voucher(1n, 4102444800n), v2 = voucher(2n, 1n);
console.log(`global SIG_V2: [u8; 64] = ${arr(v1.sig)};`);
console.log(`global SIG_V2_EXPIRED: [u8; 64] = ${arr(v2.sig)};`);
console.log('// digest v2', v1.digest);
