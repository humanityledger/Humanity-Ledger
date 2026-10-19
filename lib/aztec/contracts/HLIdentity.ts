export type AztecAddress = any;
export type Wallet = any;

export class HLIdentityWrapper {
  constructor(public wallet: Wallet, public contractAddress: AztecAddress) {}
  async verifyIdentity(identityHash: string) {
    return { send: () => ({ wait: async () => ({ status: 'mined' }) }) };
  }
}
