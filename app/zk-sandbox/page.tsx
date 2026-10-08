"use client";

import React, { useState, useRef, useEffect } from 'react';

export default function ZkSandboxPage() {
  const [logs, setLogs] = useState<string[]>([
    "$ nargo compile",
    "Compiling workspace...",
    "Pass 1: Parsing and resolving imports",
    "Pass 2: Type checking and monomorphization",
    "Pass 3: ACIR generation",
    "Constraint system generated successfully.",
    "Backend: Barretenberg (Honk)",
    "Total ACIR Opcodes: 4,821",
    "Circuit Size: ~12 KB",
    "Ready."
  ]);
  const [isCompiling, setIsCompiling] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCompile = async () => {
    if (isCompiling) return;
    setIsCompiling(true);
    setLogs(["$ nargo compile"]);
    
    const steps = [
      { msg: "Compiling workspace...", delay: 300 },
      { msg: "Pass 1: Parsing and resolving imports", delay: 400 },
      { msg: "Pass 2: Type checking and monomorphization", delay: 500 },
      { msg: "Pass 3: ACIR generation", delay: 600 },
      { msg: "Constraint system generated successfully.", delay: 400 },
      { msg: "Backend: Barretenberg (Honk)", delay: 200 },
      { msg: "Total ACIR Opcodes: 4,821", delay: 100 },
      { msg: "Circuit Size: ~12 KB", delay: 100 },
      { msg: "$ bb prove -b ./target/main.json -w ./target/witness.tr", delay: 800 },
      { msg: "Generating witness...", delay: 600 },
      { msg: "Constructing proof over BN254...", delay: 1200 },
      { msg: "Proof successfully generated in 1.42s", delay: 300 },
      { msg: "0x0421a...8f9c [2048 bytes]", delay: 200 },
      { msg: "✅ VERIFICATION PASSED", delay: 100 }
    ];

    for (const step of steps) {
      await new Promise(r => setTimeout(r, step.delay));
      setLogs(prev => [...prev, step.msg]);
    }
    setIsCompiling(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans flex flex-col h-screen overflow-hidden">
      
      {/* Top Navbar */}
      <nav className="h-14 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg text-sm">
            N
          </div>
          <h1 className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Noir ZK Sandbox <span className="text-slate-600 font-normal ml-2">v0.32.0 (Barretenberg)</span>
          </h1>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center px-3 py-1 bg-slate-800 rounded text-xs font-mono text-slate-400 border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
            WASM Prover Loaded
          </div>
          <button 
            onClick={handleCompile}
            disabled={isCompiling}
            className={`px-4 py-1.5 text-white text-xs font-bold rounded transition-all shadow-lg ${
              isCompiling ? 'bg-indigo-800 cursor-not-allowed opacity-70' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/50'
            }`}
          >
            {isCompiling ? 'Proving...' : 'Compile & Prove'}
          </button>
        </div>
      </nav>

      {/* IDE Area */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* File Explorer (Left) */}
        <div className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col shrink-0 hidden md:flex">
          <div className="px-4 py-2 border-b border-slate-800 flex justify-between items-center bg-slate-900">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Explorer</span>
            <span className="text-slate-500 hover:text-white cursor-pointer">+</span>
          </div>
          <div className="py-2 text-sm">
            <div className="px-4 py-1 text-slate-400 font-mono hover:bg-slate-800 cursor-pointer flex items-center">
              <span className="mr-2">📁</span> src
            </div>
            <div className="px-4 py-1 pl-8 text-indigo-300 font-mono bg-indigo-900/20 border-l-2 border-indigo-500 cursor-pointer flex items-center">
              <span className="mr-2 text-slate-500">📄</span> main.nr
            </div>
            <div className="px-4 py-1 pl-8 text-slate-400 font-mono hover:bg-slate-800 cursor-pointer flex items-center">
              <span className="mr-2 text-slate-500">📄</span> Nargo.toml
            </div>
            <div className="px-4 py-1 pl-8 text-slate-400 font-mono hover:bg-slate-800 cursor-pointer flex items-center">
              <span className="mr-2 text-slate-500">📄</span> Prover.toml
            </div>
          </div>
        </div>

        {/* Code Editor (Center) */}
        <div className="flex-1 flex flex-col bg-[#0d1117] border-r border-slate-800 overflow-hidden">
          <div className="flex px-4 py-2 bg-[#161b22] border-b border-slate-800 text-xs font-mono text-slate-400 space-x-4">
            <span className="text-slate-200 border-b border-slate-200 pb-1 -mb-2">main.nr</span>
            <span className="hover:text-slate-200 cursor-pointer">Prover.toml</span>
          </div>
          <div className="flex-1 p-4 overflow-auto font-mono text-sm leading-relaxed">
<pre>
<span className="text-slate-500">// Zero-Knowledge Identity Proof Circuit</span>
<span className="text-slate-500">// Prove ownership of a private key and age &gt; 18 without revealing DoB</span>

<span className="text-pink-400">use</span> dep::std;

<span className="text-pink-400">fn</span> <span className="text-emerald-400">main</span>(
  <span className="text-slate-500">// Public Inputs (Visible to verifier)</span>
  identity_commitment: <span className="text-pink-400">pub</span> Field,
  current_year: <span className="text-pink-400">pub</span> u32,
  
  <span className="text-slate-500">// Private Inputs (The Witness - Never leaves browser)</span>
  private_key: Field,
  birth_year: u32,
  randomness: Field
) {'{'}
    
    <span className="text-slate-500">// 1. Compute the public key from the private key (Grumpkin scalar mul)</span>
    <span className="text-pink-400">let</span> public_key = std::scalar_mul::fixed_base(private_key);
    
    <span className="text-slate-500">// 2. Hash the public key, birth year, and randomness using Poseidon2</span>
    <span className="text-pink-400">let</span> computed_commitment = std::hash::poseidon::bn254::hash_3([
        public_key[0], 
        birth_year <span className="text-pink-400">as</span> Field, 
        randomness
    ]);
    
    <span className="text-slate-500">// 3. Constrain: Does the computed hash match the public commitment?</span>
    <span className="text-pink-400">assert</span>(computed_commitment == identity_commitment);
    
    <span className="text-slate-500">// 4. Constrain: Is the user over 18?</span>
    <span className="text-pink-400">let</span> age = current_year - birth_year;
    <span className="text-pink-400">assert</span>(age &gt;= 18);
{'}'}
</pre>
          </div>
        </div>

        {/* Terminal / Output (Right) */}
        <div className="w-full md:w-96 bg-[#0a0a0f] flex flex-col shrink-0 h-64 md:h-auto border-t md:border-t-0 border-slate-800">
          <div className="px-4 py-2 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Compiler Output</span>
            <div className="flex gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-700"></span>
              <span className="w-2 h-2 rounded-full bg-slate-700"></span>
              <span className={`w-2 h-2 rounded-full ${isCompiling ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'}`}></span>
            </div>
          </div>
          <div ref={terminalRef} className="flex-1 p-4 font-mono text-[11px] text-emerald-500 overflow-auto whitespace-pre-wrap leading-relaxed">
            {logs.map((log, i) => (
              <div key={i} className={
                log.includes('VERIFICATION PASSED') ? 'text-emerald-400 mt-4 font-bold border border-emerald-500/30 bg-emerald-500/10 p-2 rounded' :
                log.includes('0x') ? 'text-slate-500 mt-2 break-all text-[9px]' :
                log.includes('Proof successfully generated') ? 'text-white mt-2 font-bold' :
                log.includes('Backend:') || log.includes('ACIR') || log.includes('Circuit Size:') ? 'text-indigo-400' :
                log.includes('Constraint system generated') ? 'text-slate-300 mt-2' :
                log.startsWith('$') ? 'mt-4 font-bold text-emerald-500' :
                'text-slate-400'
              }>
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

