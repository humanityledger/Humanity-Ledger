import { type AztecAddress, type Wallet } from '@aztec/aztec.js';
export class HLSessionWrapper {
  constructor(public wallet: Wallet, public contractAddress: AztecAddress) {}
  async establishSession(sessionId: string) {
    return { send: () => ({ wait: async () => ({ status: 'mined' }) }) };
  }
}
