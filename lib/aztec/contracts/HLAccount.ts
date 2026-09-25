import { type AztecAddress, type Wallet } from '@aztec/aztec.js';

export class HLAccountWrapper {
  constructor(public wallet: Wallet, public contractAddress: AztecAddress) {}

  async session_ping(sessionId: string) {
    // Stubs the call to the HLAccount session_ping function
    return { send: () => ({ wait: async () => ({ status: 'mined' }) }) };
  }
}

