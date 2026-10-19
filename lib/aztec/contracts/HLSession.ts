export type AztecAddress = any;
export type Wallet = any;

export class HLSessionWrapper {
  constructor(public wallet: Wallet, public contractAddress: AztecAddress) {}
  async establishSession(sessionId: string) {
    return { send: () => ({ wait: async () => ({ status: 'mined' }) }) };
  }
}
