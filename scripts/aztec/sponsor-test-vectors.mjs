// Prints the test vectors in contracts/aztec/sponsor/src/test.nr (fixed test-only key 11..11).
import crypto from 'node:crypto';
const N = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
// Fixed test key (test-only, never used anywhere real).
const priv = Buffer.from('11'.repeat(32), 'hex');
const ecdh = crypto.createECDH('secp256k1'); ecdh.setPrivateKey(priv);
const pub = ecdh.getPublicKey(); const x = pub.subarray(1, 33), y = pub.subarray(33, 65);
const pkcs8 = Buffer.concat([Buffer.from('302e0201010420', 'hex'), priv, Buffer.from('a00706052b8104000a', 'hex')]);
const key = crypto.createPrivateKey({ key: pkcs8, format: 'der', type: 'sec1' });
const TAG = Buffer.from('HL-SPONSOR-V1\0\0\0', 'latin1');
function voucher(id, exp) {
  const idb = Buffer.from(id.toString(16).padStart(64, '0'), 'hex');
  const eb = Buffer.alloc(8); eb.writeBigUInt64BE(BigInt(exp));
  const msg = Buffer.concat([TAG, idb, eb]);
  const der = crypto.sign('sha256', msg, { key, dsaEncoding: 'ieee-p1363' });
  let r = BigInt('0x' + der.subarray(0, 32).toString('hex')), s = BigInt('0x' + der.subarray(32).toString('hex'));
  if (s > N / 2n) s = N - s;
  const sig = Buffer.concat([Buffer.from(r.toString(16).padStart(64, '0'), 'hex'), Buffer.from(s.toString(16).padStart(64, '0'), 'hex')]);
  return { digest: crypto.createHash('sha256').update(msg).digest('hex'), sig };
}
const arr = (b) => '[' + [...b].map((v) => '0x' + v.toString(16).padStart(2, '0')).join(', ') + ']';
const f4 = (b) => [b.subarray(0, 16), b.subarray(16, 32)].map((h) => '0x' + h.toString('hex'));
const v1 = voucher(1n, 4102444800n), v2 = voucher(2n, 1n);
console.log(`global SIGNER_X: [u8; 32] = ${arr(x)};\nglobal SIGNER_Y: [u8; 32] = ${arr(y)};`);
console.log(`global SIGNER_FIELDS: [Field; 4] = [${[...f4(x), ...f4(y)].join(', ')}];`);
console.log(`global SIG_V1: [u8; 64] = ${arr(v1.sig)};`);
console.log(`global SIG_EXPIRED: [u8; 64] = ${arr(v2.sig)};`);
console.log('// digest v1', v1.digest);
