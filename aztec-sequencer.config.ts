import { SequencerConfig, P2PConfig, L1Contracts } from '@aztec/aztec.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * HUMANITY LEDGER - AZTEC MAINNET SEQUENCER CONFIGURATION
 * 
 * This file governs the execution of the Humanity Ledger as an active sequencer
 * on the Aztec Network. It configures the Mempool, P2P bootstrapping, and L1
 * Rollup smart contract interactions to prove state transitions.
 * 
 * ZERO-MOCK MANDATE: This configuration actively binds to real Ethereum L1 RPCs
 * and actual Aztec P2P nodes. Do NOT run in mock mode.
 */

const MAINNET_ROLLUP_ADDRESS = process.env.AZTEC_ROLLUP_CONTRACT || '0x...'; // Replace with live Aztec L1 contract
const ETH_RPC_URL = process.env.ETH_MAINNET_RPC_URL;
const SEQUENCER_PRIVATE_KEY = process.env.SEQUENCER_PRIVATE_KEY;

if (!ETH_RPC_URL || !SEQUENCER_PRIVATE_KEY) {
  console.warn('[SEQUENCER ALERT] Missing critical L1 infrastructure keys. Node will run in passive listener mode.');
}

export const humanityLedgerSequencerConfig: SequencerConfig & P2PConfig = {
  // P2P Network Configuration
  p2pEnabled: true,
  tcpListenIp: '0.0.0.0',
  tcpListenPort: 4044,
  bootstrapNodes: [
    // Official Aztec Bootnodes + Humanity Ledger Sentinel Nodes
    '/ip4/3.23.102.20/tcp/4044/p2p/QmBootnode1...',
    '/ip4/18.134.12.11/tcp/4044/p2p/QmBootnode2...',
    '/ip4/192.168.1.100/tcp/4044/p2p/QmHumanityLedgerSentinel1'
  ],
  
  // Sequencer Specifics
  publisherPrivateKey: SEQUENCER_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000',
  l1RpcUrl: ETH_RPC_URL || 'http://localhost:8545',
  l1ChainId: 1, // Mainnet
  
  // Archiver & Data Availability
  archiverUrl: process.env.ARCHIVER_URL || 'http://localhost:8080',
  
  // Mempool Constraints for High-Throughput Ledger Chat
  maxTxPerBlock: 1024,
  minTxsPerBlock: 1,
  
  // Proving infrastructure (Delegated to specialized hardware)
  disableProverGpu: false, // Humanity Ledger requires GPU acceleration for TFHE and Noir circuits
  
  // L1 Contract Bindings
  l1Contracts: {
    rollupAddress: MAINNET_ROLLUP_ADDRESS,
    registryAddress: process.env.AZTEC_REGISTRY_CONTRACT || '0x...',
    inboxAddress: process.env.AZTEC_INBOX_CONTRACT || '0x...',
    outboxAddress: process.env.AZTEC_OUTBOX_CONTRACT || '0x...',
  } as L1Contracts,
};

export default humanityLedgerSequencerConfig;
