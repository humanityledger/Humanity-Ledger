'use client';

import React from 'react';

// The previous version showed a hard-coded string as an "over 18" proof after
// a timeout. There is no age circuit: the identity circuits prove membership
// in an issuer's credential tree and absence from a sanctions list
// (circuits/identity, circuits/identity_v2). Until an issuer and an age
// credential exist, this panel says so instead of showing a proof.
export const IdentityZkPortal: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 p-6 bg-white rounded-3xl shadow-sm border border-black/5">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Private credentials</h2>
        <p className="text-sm text-black/70">
          Zero-knowledge credentials let you prove a fact about yourself without revealing the underlying data.
        </p>
      </div>

      <div className="p-4 border border-black/10 rounded-2xl flex flex-col gap-1">
        <h3 className="font-medium text-sm">Age verification</h3>
        <p className="text-xs text-black/70">
          Not available yet. It needs a credential issuer and an age circuit, and neither exists today. The
          identity circuit that does exist proves membership in an issuer&apos;s list and absence from a
          sanctions list, and its contract is not deployed yet.
        </p>
      </div>
    </div>
  );
};
