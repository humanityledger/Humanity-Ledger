'use client';

import React, { useState } from 'react';

export const IdentityZkPortal: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [proof, setProof] = useState<string | null>(null);

  const handleGenerateProof = async () => {
    setIsGenerating(true);
    // Simulate ZK Proof generation using local WASM circuits
    setTimeout(() => {
      setProof('0xZK_PROOF_VALID_OVER_18_YEARS_OLD_SIG_9A4B...');
      setIsGenerating(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-white rounded-3xl shadow-sm border border-black/5">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Sovereign Identity</h2>
        <p className="text-sm text-black/60">
          Generate Zero-Knowledge proofs of your credentials without revealing the underlying data.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="p-4 border border-black/10 rounded-2xl flex justify-between items-center">
          <div>
            <h3 className="font-medium text-sm">Age Verification Protocol</h3>
            <p className="text-xs text-black/40">Prove you are over 18 without revealing Date of Birth.</p>
          </div>
          <button 
            onClick={handleGenerateProof}
            disabled={isGenerating}
            className="px-4 py-2 bg-black text-white text-sm font-medium rounded-xl hover:bg-black/80 transition-colors"
          >
            {isGenerating ? 'Computing ZK...' : 'Generate Proof'}
          </button>
        </div>

        {proof && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl break-all">
            <p className="text-xs font-mono text-emerald-800">{proof}</p>
            <p className="text-xs font-semibold text-emerald-600 mt-2">✓ Ready to transmit to Verifier</p>
          </div>
        )}
      </div>
    </div>
  );
};

