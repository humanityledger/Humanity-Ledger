"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, Lock, KeyRound } from "lucide-react";
import { HLLogo } from "@/components/shared/HLLogo";

export const dynamic = 'force-dynamic';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, mfaCode }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Administrator access granted");
        router.push("/admin/clone-registry");
        router.refresh();
      } else {
        toast.error(data.message || "Access denied");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-[400px] bg-white rounded-3xl border border-black/[0.08] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="mb-4">
            <HLLogo size={36} />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 text-[11px] font-bold text-black uppercase tracking-wider mb-2">
            <ShieldCheck size={14} className="text-emerald-600" />
            Restricted Admin Portal
          </div>
          <h1 className="text-2xl font-black text-[#1C1C1E] tracking-tight">Admin Authentication</h1>
          <p className="text-xs text-black/40 mt-1 font-medium">MFA 2-Factor Authentication Required</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-black/70 mb-1.5">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@humanityledger.com"
              className="w-full px-4 py-2.5 rounded-xl border border-black/10 focus:border-black focus:outline-none text-sm transition-colors text-black"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-black/70 mb-1.5">Password</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-black/10 focus:border-black focus:outline-none text-sm transition-colors text-black"
              />
              <Lock size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black/30" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-black/70 mb-1.5">6-Digit 2FA Code</label>
            <div className="relative">
              <input
                type="text"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                required
                placeholder="123456"
                className="w-full px-4 py-2.5 rounded-xl border border-black/10 focus:border-black focus:outline-none text-sm font-mono tracking-widest text-black"
              />
              <KeyRound size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-black/30" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 bg-[#1C1C1E] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50"
          >
            {isLoading ? "Verifying Credentials..." : "Authenticate"}
          </button>
        </form>
      </div>
    </div>
  );
}
