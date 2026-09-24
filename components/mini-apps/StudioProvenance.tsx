'use client';

import React, { useState } from 'react';

export const StudioProvenance: React.FC = () => {
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [isHashing, setIsHashing] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsHashing(true);
    
    // Calculate SHA-256 hash in browser using Web Crypto API
    const buffer = await file.arrayBuffer();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    setTimeout(() => {
      setFileHash(hashHex);
      setIsHashing(false);
    }, 1000); // Artificial delay for UX
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-white rounded-3xl shadow-sm border border-black/5">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Studio Provenance</h2>
        <p className="text-sm text-black/60">
          Establish immutable authorship for your creative work by anchoring its cryptographic hash to the AppChain.
        </p>
      </div>

      <div className="border-2 border-dashed border-black/10 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 hover:bg-black/[0.02] transition-colors cursor-pointer relative">
        <input 
          type="file" 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleFileUpload}
        />
        <div className="w-12 h-12 bg-black/5 rounded-full flex items-center justify-center">
          <span className="text-xl">📁</span>
        </div>
        <div className="text-center">
          <p className="font-medium text-sm">Drop a file here or click to browse</p>
          <p className="text-xs text-black/40 mt-1">The file never leaves your device. Only the hash is uploaded.</p>
        </div>
      </div>

      {isHashing && (
        <div className="text-center py-4 text-sm font-medium text-black/60 animate-pulse">
          Computing cryptographic fingerprint...
        </div>
      )}

      {fileHash && (
        <div className="flex flex-col gap-3 p-5 bg-black/5 rounded-2xl border border-black/10">
          <div>
            <p className="text-xs font-semibold text-black/40 uppercase tracking-wider mb-1">SHA-256 Fingerprint</p>
            <p className="text-xs font-mono break-all">{fileHash}</p>
          </div>
          <button className="mt-2 w-full py-2 bg-black text-white text-sm font-medium rounded-xl hover:bg-black/80 transition-colors">
            Anchor to Blockchain
          </button>
        </div>
      )}
    </div>
  );
};

