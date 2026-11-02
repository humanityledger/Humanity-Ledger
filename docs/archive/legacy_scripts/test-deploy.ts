import { Contract } from '@aztec/aztec.js/contracts';
import { AccountManager } from '@aztec/aztec.js/wallet';
import { SchnorrAccountContract } from '@aztec/accounts/schnorr';
import { Fr } from '@aztec/foundation/curves/bn254';
import { GrumpkinScalar } from '@aztec/foundation/curves/grumpkin';
import { createAztecNodeClient } from '@aztec/aztec.js/node';

async function main() {
    const pxe = createAztecNodeClient('http://localhost:8080');
    const secretKey = Fr.random();
    const signingKey = GrumpkinScalar.random();
    const accountContract = new SchnorrAccountContract(signingKey);
    
    // Test AccountManager.create()
    const accountManager = await AccountManager.create(pxe as any, secretKey, accountContract);
    console.log('Account manager created');
}
main().catch(console.error);
