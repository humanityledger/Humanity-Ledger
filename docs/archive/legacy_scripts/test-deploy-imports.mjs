// test-deploy-imports.mjs — Verify all imports work before running deploy
async function test() {
  try {
    console.log('Testing @aztec/aztec.js/node...');
    const { createAztecNodeClient } = await import('@aztec/aztec.js/node');
    console.log('✅ createAztecNodeClient OK');

    console.log('Testing @aztec/aztec.js/fields...');
    const { Fr } = await import('@aztec/aztec.js/fields');
    console.log('✅ Fr OK');

    console.log('Testing @aztec/stdlib/keys...');
    const { deriveSigningKey } = await import('@aztec/stdlib/keys');
    console.log('✅ deriveSigningKey OK');

    console.log('Testing @aztec/accounts/schnorr...');
    const { SchnorrAccountContract } = await import('@aztec/accounts/schnorr');
    console.log('✅ SchnorrAccountContract OK');

    console.log('Testing @aztec/aztec.js/wallet...');
    const walletMod = await import('@aztec/aztec.js/wallet');
    console.log('✅ wallet exports:', Object.keys(walletMod).join(', '));

    console.log('Testing @aztec/pxe/client/lazy...');
    const pxeMod = await import('@aztec/pxe/client/lazy');
    console.log('✅ pxe exports:', Object.keys(pxeMod).join(', '));

    console.log('Testing @aztec/foundation/json-rpc/client...');
    const rpcMod = await import('@aztec/foundation/json-rpc/client');
    console.log('✅ json-rpc exports:', Object.keys(rpcMod).join(', '));

    console.log('Testing @aztec/stdlib/aztec-address...');
    const addrMod = await import('@aztec/stdlib/aztec-address');
    console.log('✅ aztec-address exports:', Object.keys(addrMod).join(', '));

    console.log('Testing @aztec/aztec.js/fee...');
    const feeMod = await import('@aztec/aztec.js/fee');
    console.log('✅ fee exports:', Object.keys(feeMod).join(', '));

    console.log('Testing @aztec/noir-contracts.js/Token...');
    const tokenMod = await import('@aztec/noir-contracts.js/Token');
    console.log('✅ Token exports:', Object.keys(tokenMod).join(', '));

    console.log('\n🎉 All imports OK — deploy should work!');
  } catch(e) {
    console.error('❌ Import failed:', e.message);
  }
}
test();
