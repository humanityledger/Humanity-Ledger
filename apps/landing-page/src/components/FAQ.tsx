'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const faqs = [
  {
    q: "What is the EU Digital Product Passport (DPP)?",
    a: "The EU DPP is a mandatory framework requiring businesses to share detailed product data across the value chain to ensure sustainability and circularity. The Battery Passport is the first category, becoming mandatory in February 2027."
  },
  {
    q: "How does Studio Provenance protect our supply chain data?",
    a: "We use Zero-Knowledge proofs (zk-SNARKs) powered by Aztec Network. You can prove to regulators and auditors that your materials meet compliance standards without ever revealing your actual suppliers, costs, or proprietary trade secrets."
  },
  {
    q: "Is it GDPR compliant?",
    a: "Yes. By utilizing cryptography and selective disclosure, Studio Provenance ensures that sensitive personal or corporate data never touches public infrastructure in plain text. It is privacy-by-design."
  },
  {
    q: "When will the mobile apps launch?",
    a: "Ledger Chat is live now on web. Mobile apps for iOS and Android are coming soon. The full ecosysteally launched on the App Store and Google Play, fully integrating our compliance and privacy layers for a broader audience."
  }
];

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section className="py-24 px-4 bg-parchment border-b-2 border-ink">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-serif font-bold text-ink mb-12 text-center">
          Questions & Answers
        </h2>
        
        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="border-2 border-ink bg-parchment shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
              <button 
                onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                className="w-full text-left p-6 flex justify-between items-center focus:outline-none hover:bg-chartreuse/20 transition-colors"
              >
                <h3 className="font-bold text-xl text-ink font-serif">{faq.q}</h3>
                {openIdx === idx ? <ChevronUp className="w-6 h-6 text-ink" /> : <ChevronDown className="w-6 h-6 text-ink" />}
              </button>
              
              <AnimatePresence>
                {openIdx === idx && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t-2 border-ink"
                  >
                    <div className="p-6 text-ink/80 text-lg">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
