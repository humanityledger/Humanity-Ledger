import React from 'react';
import { Metadata } from 'next';
import DocLayout from '@/components/layout/DocLayout';

export const metadata: Metadata = {
  title: 'API Documentation | Aztec L2 SDK',
  description: 'Massively exhaustive documentation for Aztec Network L2 SDK and Noir integration.',
};

export default function ApiDocsPage() {
  return (
    <DocLayout title="Developer SDK & API Reference" category="Developers" description="The definitive, exhaustive guide for integrating with the Humanity Ledger PXE, writing Noir circuits, and deploying Aztec L2 privacy-preserving smart contracts." lastUpdated="August 2026">
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-slate-300">
        
        <h1 className="text-5xl font-extrabold mb-8 text-white tracking-tight">Humanity Ledger API & Aztec SDK</h1>
        
        <p className="text-xl text-slate-400 mb-12 leading-relaxed">
          Welcome to the developer documentation for the Humanity Ledger. Building on Aztec requires a paradigm shift from traditional EVM development. Here, state is private by default, computation is proven client-side, and data availability is bifurcated between L1 and L2. This guide provides the <strong className="text-emerald-400">trillions of parameters</strong> of technical depth required by senior protocol engineers.
        </p>

        {/* 1. ARCHITECTURE */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-6 border-b border-slate-700 pb-4">1. The Privacy Architecture</h2>
          <p className="mb-4 text-lg">
            Unlike Ethereum, where state is stored in a public Patricia Trie, Aztec state is stored in two primary data structures: the <strong>Note Hash Tree</strong> (append-only commitments) and the <strong>Nullifier Tree</strong> (spent note hashes). You interact with this state via the Private Execution Environment (PXE).
          </p>
          <div className="bg-[#0d1117] p-6 rounded-xl border border-slate-700 font-mono text-sm shadow-inner mb-6">
            <span className="text-purple-400">const</span> <span className="text-emerald-400">pxe</span> = <span className="text-pink-400">await</span> <span className="text-emerald-400">createPXEClient</span>(PXE_URL);<br/>
            <span className="text-slate-500">// The PXE handles note decryption, witness generation, and proving locally.</span>
          </div>
        </section>

        {/* 2. NOIR CIRCUITS */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-6 border-b border-slate-700 pb-4">2. Authoring Noir Contracts</h2>
          <p className="mb-4 text-lg">
            Aztec contracts are written in Noir, a Rust-like domain-specific language for ZK circuits. A contract defines the state structure (using Macros) and the functions (private or public) that mutate that state.
          </p>
          
          <h3 className="text-xl font-bold text-emerald-400 mt-8 mb-4">Example: Private Token Transfer Circuit</h3>
          <div className="bg-[#0d1117] rounded-xl overflow-hidden border border-slate-700">
            <div className="bg-[#161b22] px-4 py-2 border-b border-slate-700 text-xs font-mono text-slate-400">src/main.nr</div>
            <div className="p-4 overflow-x-auto">
              <pre className="text-sm font-mono leading-relaxed">
<span className="text-pink-400">contract</span> <span className="text-amber-300">PrivateToken</span> {'{'}
  <span className="text-pink-400">use</span> dep::aztec::prelude::AztecAddress;
  <span className="text-pink-400">use</span> dep::aztec::prelude::NoteHeader;
  <span className="text-pink-400">use</span> dep::value_note::value_note::ValueNote;

  <span className="text-slate-500">#[aztec(storage)]</span>
  <span className="text-pink-400">struct</span> <span className="text-amber-300">Storage</span> {'{'}
    balances: Map&lt;AztecAddress, PrivateSet&lt;ValueNote&gt;&gt;,
  {'}'}

  <span className="text-slate-500">#[aztec(private)]</span>
  <span className="text-pink-400">fn</span> <span className="text-emerald-400">transfer</span>(
    to: AztecAddress,
    amount: <span className="text-teal-300">Field</span>
  ) {'{'}
    <span className="text-slate-500">// 1. Identify the caller</span>
    <span className="text-pink-400">let</span> sender = context.msg_sender();

    <span className="text-slate-500">// 2. Retrieve sender's notes and nullify them (destroy them)</span>
    <span className="text-pink-400">let</span> options = NoteGetterOptions::new().select(ValueNote::properties().value, Comparator.GTE, amount);
    <span className="text-pink-400">let</span> notes = storage.balances.at(sender).get_notes(options);
    
    <span className="text-pink-400">let</span> <span className="text-pink-400">mut</span> sum = 0;
    <span className="text-pink-400">for</span> i <span className="text-pink-400">in</span> 0..notes.len() {'{'}
      <span className="text-pink-400">if</span> (notes[i].is_some()) {'{'}
        sum += notes[i].unwrap_unchecked().value;
        storage.balances.at(sender).remove(notes[i].unwrap_unchecked());
      {'}'}
    {'}'}

    <span className="text-slate-500">// 3. Enforce conservation of value</span>
    <span className="text-pink-400">assert</span>(sum &gt;= amount, <span className="text-green-300">"Insufficient balance"</span>);

    <span className="text-slate-500">// 4. Create new note for the recipient</span>
    <span className="text-pink-400">let</span> <span className="text-pink-400">mut</span> recipient_note = ValueNote::new(amount, to);
    storage.balances.at(to).insert(&amp;<span className="text-pink-400">mut</span> recipient_note, <span className="text-pink-400">true</span>);

    <span className="text-slate-500">// 5. Return change to the sender if necessary</span>
    <span className="text-pink-400">if</span> (sum &gt; amount) {'{'}
      <span className="text-pink-400">let</span> <span className="text-pink-400">mut</span> change_note = ValueNote::new(sum - amount, sender);
      storage.balances.at(sender).insert(&amp;<span className="text-pink-400">mut</span> change_note, <span className="text-pink-400">true</span>);
    {'}'}
  {'}'}
{'}'}
              </pre>
            </div>
          </div>
        </section>

        {/* 3. TYPESCRIPT SDK */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-6 border-b border-slate-700 pb-4">3. TypeScript Integration (Aztec.js)</h2>
          <p className="mb-4 text-lg">
            Once compiled, your Noir contract generates a JSON artifact containing the ABI and Verification Key. You use <code className="bg-slate-800 px-1 rounded text-sm text-pink-400">@aztec/aztec.js</code> to deploy and interact with the contract from the browser or Node.js.
          </p>

          <h3 className="text-xl font-bold text-emerald-400 mt-8 mb-4">Deploying and Executing</h3>
          <div className="bg-[#0d1117] rounded-xl overflow-hidden border border-slate-700">
            <div className="bg-[#161b22] px-4 py-2 border-b border-slate-700 text-xs font-mono text-slate-400">app/sdk.ts</div>
            <div className="p-4 overflow-x-auto">
              <pre className="text-sm font-mono leading-relaxed">
<span className="text-pink-400">import</span> {'{'} Contract, Wallet, AztecAddress {'}'} <span className="text-pink-400">from</span> <span className="text-green-300">'@aztec/aztec.js'</span>;
<span className="text-pink-400">import</span> PrivateTokenArtifact <span className="text-pink-400">from</span> <span className="text-green-300">'./artifacts/PrivateToken.json'</span>;

<span className="text-pink-400">export async function</span> <span className="text-emerald-400">executeTransfer</span>(
  wallet: Wallet, 
  contractAddress: AztecAddress, 
  recipient: AztecAddress, 
  amount: <span className="text-teal-300">bigint</span>
) {'{'}
  <span className="text-slate-500">// 1. Instantiate the contract instance</span>
  <span className="text-pink-400">const</span> token = <span className="text-pink-400">await</span> Contract.<span className="text-emerald-400">at</span>(contractAddress, PrivateTokenArtifact, wallet);

  <span className="text-pink-400">console</span>.<span className="text-emerald-400">log</span>(<span className="text-green-300">"Simulating transaction locally in PXE..."</span>);
  
  <span className="text-slate-500">// 2. Call the function. This triggers local witness generation and Barretenberg proving.</span>
  <span className="text-slate-500">// It takes 1-3 seconds depending on the device.</span>
  <span className="text-pink-400">const</span> tx = token.<span className="text-emerald-400">methods</span>.<span className="text-emerald-400">transfer</span>(recipient, amount).<span className="text-emerald-400">send</span>();

  <span className="text-slate-500">// 3. Wait for L2 block inclusion</span>
  <span className="text-pink-400">const</span> receipt = <span className="text-pink-400">await</span> tx.<span className="text-emerald-400">wait</span>();
  
  <span className="text-pink-400">console</span>.<span className="text-emerald-400">log</span>(<span className="text-green-300">{"`"}Transfer successful! Tx Hash: ${"{receipt.txHash}"}{"`"}</span>);
  <span className="text-pink-400">return</span> receipt;
{'}'}
              </pre>
            </div>
          </div>
        </section>

        {/* 4. IDENTITY & KEY DERIVATION */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-6 border-b border-slate-700 pb-4">4. Identity & Key Derivation (SIWE)</h2>
          <p className="mb-4 text-lg">
            Humanity Ledger doesn't force users to save new seed phrases. We derive Grumpkin curve keys deterministically from the user's Ethereum wallet via EIP-4361 (Sign-In with Ethereum).
          </p>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl mb-6">
            <h4 className="text-white font-bold mb-2">The Derivation Path</h4>
            <ol className="list-decimal pl-5 space-y-2 text-slate-400 text-sm">
              <li>Request a personal_sign on the string: <code className="bg-slate-800 px-1 rounded text-pink-400">"Humanity Ledger: Sovereign Identity v1.0"</code></li>
              <li>Hash the 65-byte ECDSA signature using <code className="bg-slate-800 px-1 rounded text-pink-400">Poseidon2</code> to produce a 254-bit scalar.</li>
              <li>This scalar acts as the Master Secret for the Grumpkin HD derivation tree.</li>
              <li>Derive: <strong>Signing Key</strong>, <strong>Nullifier Key</strong>, <strong>Incoming Viewing Key</strong>, and <strong>Outgoing Viewing Key</strong>.</li>
            </ol>
          </div>
        </section>

        {/* 5. REST API */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-6 border-b border-slate-700 pb-4">5. REST API Endpoints</h2>
          <p className="mb-4 text-lg">
            While execution is peer-to-peer and decentralized, the Humanity Ledger indexer provides Web2-friendly endpoints to query public commitments and metadata.
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-left bg-slate-900">
              <thead>
                <tr className="bg-slate-800 text-slate-300 text-sm">
                  <th className="p-4 font-semibold border-b border-slate-700">Endpoint</th>
                  <th className="p-4 font-semibold border-b border-slate-700">Method</th>
                  <th className="p-4 font-semibold border-b border-slate-700">Description</th>
                  <th className="p-4 font-semibold border-b border-slate-700">Auth</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-400">
                <tr className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="p-4 font-mono text-emerald-400">/api/registry/blocks</td>
                  <td className="p-4"><span className="bg-emerald-900/50 text-emerald-400 px-2 py-1 rounded text-xs">GET</span></td>
                  <td className="p-4">Fetch the latest Aztec L2 block roots and state tree sizes.</td>
                  <td className="p-4 text-slate-500">None</td>
                </tr>
                <tr className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="p-4 font-mono text-emerald-400">/api/auth/nonce</td>
                  <td className="p-4"><span className="bg-emerald-900/50 text-emerald-400 px-2 py-1 rounded text-xs">GET</span></td>
                  <td className="p-4">Request a secure 256-bit nonce for SIWE login.</td>
                  <td className="p-4 text-slate-500">None</td>
                </tr>
                <tr className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="p-4 font-mono text-emerald-400">/api/provenance/register</td>
                  <td className="p-4"><span className="bg-amber-900/50 text-amber-400 px-2 py-1 rounded text-xs">POST</span></td>
                  <td className="p-4">Submit encrypted metadata tied to an on-chain commitment.</td>
                  <td className="p-4 text-emerald-400">SIWE Token</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </DocLayout>
  );
}


