'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Plus, Minus } from 'lucide-react';

const FAQ_DATA = [
  {
    question: "What is the Wallet Human Polymarket ID?",
    answer: "It is a unified identity layer that connects your cryptographic wallet with verified human credentials and predictive market capabilities. It allows you to prove humanity on-chain while keeping your private data completely secure and zero knowledge."
  },
  {
    question: "How does the Zero Knowledge (ZK) verification work?",
    answer: "Our ZK verification uses advanced cryptographic proofs (zk-SNARKs) to confirm your identity attributes without ever exposing the underlying data. When you verify, the blockchain only records that the proof is valid, ensuring absolute privacy."
  },
  {
    question: "Are my chat conversations fully encrypted?",
    answer: "Yes. Ledger Chat utilizes end to end encryption (E2EE) built directly into the protocol. Your messages are encrypted client-side using your wallet's keys before they even leave your device. We cannot read your messages, and neither can anyone else."
  },
  {
    question: "How does the Stripe integration interact with my node?",
    answer: "The Stripe payment tunnel securely handles your subscription. Once a payment is confirmed via webhook, your on-chain node allocation is automatically upgraded in real-time. We do not store any sensitive credit card data; everything is routed through Stripe's certified infrastructure."
  },
  {
    question: "What are the benefits of the Elite Archive Prover node?",
    answer: "The Elite Archive Prover node gives you maximum power: unlimited daily requests, full data history, FIX protocol access, dark pool detection, and WebSockets streams. It is designed for sovereign players and high-frequency predictive market participants."
  },
  {
    question: "Can I use the Studio Provenance for supply chain tracking?",
    answer: "Absolutely. Studio Provenance leverages the Aztec Network to provide sovereign-grade private proofs for product records. You can register batches, generate scannable QR codes, and confirm authenticity on the public ledger without exposing your private supplier data."
  }
];

export function VisionStatsSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleOpen = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="w-full bg-[#FAFAFA] border-t border-black/5 py-24 px-6 md:px-16">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#050505]/40 mb-3">
            Knowledge Base
          </p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-[#050505] leading-tight mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-sm md:text-base text-[#050505]/50 max-w-2xl mx-auto leading-relaxed">
            Everything you need to know about the Humanity Ledger ecosystem, Zero Knowledge proofs, and sovereign node infrastructure.
          </p>
        </div>

        <div className="space-y-4">
          {FAQ_DATA.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div 
                key={index} 
                className={`border border-[#050505]/10 bg-white rounded-2xl overflow-hidden transition-all duration-300 ${isOpen ? 'shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-[#050505]/20' : 'hover:border-[#050505]/20 hover:bg-[#FAFAFA]'}`}
              >
                <button
                  onClick={() => toggleOpen(index)}
                  className="w-full flex items-center justify-between p-6 md:p-8 text-left focus:outline-none"
                >
                  <span className={`text-base md:text-lg font-bold transition-colors ${isOpen ? 'text-[#050505]' : 'text-[#050505]/80'}`}>
                    {faq.question}
                  </span>
                  <div className={`shrink-0 ml-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isOpen ? 'bg-white text-white' : 'bg-white/5 text-[#050505]'}`}>
                    {isOpen ? <Minus size={16} /> : <Plus size={16} />}
                  </div>
                </button>
                
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="px-6 pb-8 md:px-8 pt-0">
                        <div className="h-px w-full bg-white/5 mb-6" />
                        <p className="text-sm md:text-base text-[#050505]/60 leading-relaxed">
                          {faq.answer}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
