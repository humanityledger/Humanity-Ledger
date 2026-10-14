/**
 * Universal Aztec SDK Root Stub for Next.js Webpack Bundler
 * Resolves root "@aztec/aztec.js" imports during build and SSR.
 */

class MockPXEClient {
  constructor(url) {
    this.url = url || 'https://v5.testnet.rpc.aztec-labs.com';
  }
  async getNotes() { return []; }
  async getBlockNumber() { return 14824; }
  async isAccountSynchronized() { return true; }
  async registerSender() { return true; }
  async addNote() { return true; }
}

function createPXEClient(url) {
  return new MockPXEClient(url);
}

module.exports = {
  createPXEClient,
  MockPXEClient,
};
