"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, BookOpen, Lock, ArrowRight, CheckCircle2 } from "lucide-react";

export function SystemContractModal() {
  const [isMounted, setIsMounted] = useState(false);
  const [isSigned, setIsSigned] = useState(true); // Default completely open on server to prevent hydration mismatch, check client
  const [isReadingDocs, setIsReadingDocs] = useState(false);
  const [isReadingPrivacy, setIsReadingPrivacy] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const signed = localStorage.getItem("system_contract_signed") === "true";
    setIsSigned(signed);
  }, []);

  const handleSign = () => {
    if (!isReadingDocs || !isReadingPrivacy) return;
    localStorage.setItem("system_contract_signed", "true");
    setIsSigned(true);
  };

  if (!isMounted || isSigned) return null;

  const canSign = isReadingDocs && isReadingPrivacy;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-[#FFFFFF]/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
      >
        <motion.div
          initial={{ y: 20, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white border border-[#E5E5E5] w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="px-10 pt-10 pb-6 border-b border-[#E5E5E5]/60 flex items-start gap-5 bg-[#FFFFFF]">
            <div className="p-3 bg-white rounded-xl shadow-sm border border-[#E5E5E5]">
              <ShieldAlert className="text-[#050505]" size={28} />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#050505] tracking-tight uppercase mb-1">
                Humanity Ledger Agreement
              </h1>
              <p className="text-[10px] font-bold text-[#888888] uppercase tracking-widest leading-relaxed">
                Terminal connection established. Network verification required.
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="p-10 flex-col gap-6 flex">
            <p className="text-xs font-bold text-[#444444] leading-relaxed">
              By accessing the Humanity Ledger, you operate under an elevated state of market analytics. 
              The infrastructure processes real-time on-chain data, deep mempool mechanics, and accelerated market analytics. 
              You must fully understand the operational guidelines preserving data integrity and privacy.
            </p>

            <div className="flex flex-col gap-3">
              {/* Docs Check */}
              <a
                href="https://www.humanidfi.com/docs"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsReadingDocs(true)}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all hover:shadow-sm ${
                  isReadingDocs ? "bg-[#FFFFFF] border-[#00C076] text-[#00C076]" : "bg-white border-[#E5E5E5] text-[#050505] hover:border-[#050505]"
                }`}
              >
                <div className="flex items-center gap-4">
                  <BookOpen size={20} />
                  <div>
                    <h3 className="text-sm font-black tracking-tight">Ledger Documentation</h3>
                    <p className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${isReadingDocs ? "text-[#00C076]/70" : "text-[#888888]"}`}>
                      System Mechanics & Protocols
                    </p>
                  </div>
                </div>
                {isReadingDocs ? <CheckCircle2 size={20} /> : <ArrowRight size={16} className="text-[#888888]" />}
              </a>

              {/* Privacy Check */}
              <a
                href="https://www.humanidfi.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsReadingPrivacy(true)}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all hover:shadow-sm ${
                  isReadingPrivacy ? "bg-[#FFFFFF] border-[#00C076] text-[#00C076]" : "bg-white border-[#E5E5E5] text-[#050505] hover:border-[#050505]"
                }`}
              >
                <div className="flex items-center gap-4">
                  <Lock size={20} />
                  <div>
                    <h3 className="text-sm font-black tracking-tight">Privacy Architecture</h3>
                    <p className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${isReadingPrivacy ? "text-[#00C076]/70" : "text-[#888888]"}`}>
                      Data Governance & End to End Encryption
                    </p>
                  </div>
                </div>
                {isReadingPrivacy ? <CheckCircle2 size={20} /> : <ArrowRight size={16} className="text-[#888888]" />}
              </a>
            </div>
          </div>

          {/* Footer Action */}
          <div className="p-8 border-t border-[#E5E5E5]/60 bg-[#FFFFFF] flex justify-end">
            <button
              onClick={handleSign}
              disabled={!canSign}
              className={`px-8 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                canSign
                  ? "bg-white text-white hover:bg-black shadow-[0_4px_20px_rgba(0,0,0,0.15)] scale-100"
                  : "bg-[#E5E5E5] text-[#A0A0A0] cursor-not-allowed scale-[0.98]"
              }`}
            >
              Sign Cryptographic Contract
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
