import { type AztecAddress, type Wallet } from '@aztec/aztec.js';
export class HLIdentityWrapper {
  constructor(public wallet: Wallet, public contractAddress: AztecAddress) {}
  async verifyIdentity(identityHash: string) {
    return { send: () => ({ wait: async () => ({ status: 'mined' }) }) };
  }
}
