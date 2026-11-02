"use client";

import React, { useState, useEffect } from "react";
import { BrowserProvider } from "ethers";
import { SiweMessage } from "siwe";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

export function SiweRegistryAdapter({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [identity, setIdentity] = useState<any>(null);

  useEffect(() => {
    // Feature flag check
    const isEnabled = process.env.NEXT_PUBLIC_IDENTITY_SIWE_REGISTRY_ENABLED === "true";
    setEnabled(isEnabled);

    if (!isEnabled) {
      setChecking(false);
      return;
    }

    // Check existing session
    fetch("/api/siwe/session", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("No session");
        return res.json();
      })
      .then((data) => {
        if (data?.address) {
          setIdentity({ address: data.address, chainId: data.chainId });
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  const handleConnect = async () => {
    if (!window.ethereum) {
      toast.error("No Web3 wallet found");
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum as any);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      // 1. Get Nonce
      const nonceRes = await fetch("/api/siwe/nonce", { credentials: "include", cache: "no-store" });
      if (!nonceRes.ok) throw new Error("Failed to fetch nonce");
      const nonce = (await nonceRes.text()).trim();

      // 2. Create SIWE Message
      const domain = window.location.hostname;
      const origin = window.location.origin;
      const message = new SiweMessage({
        domain,
        address,
        statement: "Sign in with Ethereum to the Humanity Ledger Registry.",
        uri: origin,
        version: "1",
        chainId: Number(network.chainId) || 1,
        nonce,
        issuedAt: new Date().toISOString(),
      });

      const messageToSign = message.prepareMessage();
      const signature = await signer.signMessage(messageToSign);

      // 3. Verify
      const verifyRes = await fetch("/api/siwe/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: messageToSign, signature }),
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        throw new Error(errData.error || "Verification failed");
      }

      const verifyData = await verifyRes.json();
      
      // Refresh session
      const sessionRes = await fetch("/api/siwe/session", { credentials: "include" });
      const sessionData = await sessionRes.json().catch(() => null);
      setIdentity(sessionData || { address: verifyData.address });
      
      toast.success("SIWE Identity Verified");

    } catch (error: any) {
      console.error("[SIWE] Connect error", error);
      toast.error(error.message || "Failed to connect");
    }
  };

  if (!enabled) {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="animate-pulse">Verifying Humanity Identity...</div>
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-6">
        <h1 className="text-3xl font-black mb-4">Registry Clearance Required</h1>
        <p className="text-gray-400 mb-8 max-w-md text-center">
          The Registry is now operating under the new Canonical Identity system (P2-B). 
          Please sign in with your sovereign wallet to continue.
        </p>
        <button
          onClick={handleConnect}
          className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full font-bold hover:bg-gray-200 transition-colors"
        >
          <Wallet size={20} />
          Sign In With Ethereum (SIWE)
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Shadow mode / Pilot indicator */}
      <div className="fixed top-0 left-0 w-full bg-emerald-900/50 text-emerald-400 text-xs text-center py-1 z-50 font-mono border-b border-emerald-900/50 backdrop-blur-md">
        SIWE Pilot Active • Identity: {identity.address.slice(0,6)}...{identity.address.slice(-4)} • Perms: {identity.permissions.length}
      </div>
      <div className="pt-6">
        {children}
      </div>
    </>
  );
}
