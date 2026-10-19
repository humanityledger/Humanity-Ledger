export type AztecAddress = any;
export type Wallet = any;

export class HLQDsWrapper {
  constructor(public wallet: Wallet, public contractAddress: AztecAddress) {}
  async transfer(to: AztecAddress, amount: number, nonce: number) {
    return { send: () => ({ wait: async () => ({ status: 'mined' }) }) };
  }
}
