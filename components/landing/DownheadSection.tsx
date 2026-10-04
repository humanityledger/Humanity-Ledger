"use client";

import React, { useRef } from "react";
import { motion } from "framer-motion";
import { Shield, Zap, Globe, Cpu, Lock, Layers } from "lucide-react";
import { DownheadCursor } from "./DownheadCursor";

export const DownheadSection = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const features = [
    { icon: <Shield size={24} />, title: "System Security", desc: "Local AES-256 mnemonic encryption. Your keys never leave the browser runtime." },
    { icon: <Zap size={24} />, title: "Real-time Execution", desc: "Direct integration with Polygon and Ethereum RPCs for millisecond-precise transactions." },
    { icon: <Globe size={24} />, title: "Global Analytics", desc: "Aggregate ledger movements across 12 chains using our proprietary indexing substrate." },
    { icon: <Cpu size={24} />, title: "Sovereign Core", desc: "Viem + Ethers v6 optimized for high-throughput sovereign attesting environments." },
  ];

  return (
    <section 
      ref={containerRef}
      className="hidden lg:block downhead-cursor-zone relative py-40 bg-white overflow-hidden border-y border-white/5"
    >
      <DownheadCursor containerRef={containerRef} />
      
      {/* Background Image Perfectly Adjusted */}
      <img 
        src="/rectangle_large_type_2_a9c6cc1e1738c43864683c13c43314d9.jpg"
        alt="Substrate Core Background"
        className="absolute inset-0 w-full h-full object-cover object-center opacity-40 mix-blend-screen"
      />
      {/* Overlay to ensure text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/90 to-transparent" />

      <div className="max-w-[2560px] mx-auto px-12 relative z-10 text-left">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          
          <div className="space-y-12">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="font-aztec-h1 text-5xl text-white mb-6 leading-tight">
                Beyond Standard <br />
                <span className="text-[var(--aztec-orchid)] italic">Architecture.</span>
              </h2>
              <p className="font-aztec-body text-xl text-white/50 leading-relaxed max-w-lg">
                The terminal's downhead logic operates on a separate execution thread, 
                ensuring that your interaction with the blockchain is always decoupled 
                from UI state for maximum reliability.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {features.map((f, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="space-y-3"
                >
                  <div className="text-[var(--aztec-orchid)] mb-4">{f.icon}</div>
                  <h3 className="font-aztec-body text-white font-bold">{f.title}</h3>
                  <p className="font-aztec-body text-xs text-white/40 leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="relative">
             {/* Interactive Visual Core */}
             <div className="aspect-square bg-white/[0.02] border border-white/10 rounded-full flex items-center justify-center p-12">
                <div className="absolute inset-0 border border-[var(--aztec-orchid)]/20 rounded-full animate-ping opacity-20" />
                <div className="absolute inset-4 border border-white/5 rounded-full animate-pulse opacity-10" />
                
                <div className="relative z-10 w-full h-full border border-white/10 rounded-full overflow-hidden bg-black/40 backdrop-blur-3xl flex items-center justify-center">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 opacity-20"
                    >
                        <div className="w-full h-full bg-[radial-gradient(circle_at_center,var(--aztec-orchid)_0%,transparent_70%)]" />
                    </motion.div>
                    
                    <div className="text-center">
                        <motion.div 
                          animate={{ y: [0, -10, 0] }}
                          transition={{ duration: 4, repeat: Infinity }}
                          className="flex justify-center mb-6"
                        >
                            <Layers size={64} className="text-white opacity-80" />
                        </motion.div>
                        <div className="font-aztec-mono text-[10px] uppercase tracking-[0.5em] text-white/40">
                            Substrate Node v4.0.1
                        </div>
                    </div>
                </div>
             </div>
             
             {/* Floating Info Panels */}
             <motion.div 
                animate={{ x: [0, 10, 0], y: [0, -10, 0] }}
                transition={{ duration: 6, repeat: Infinity }}
                className="absolute top-0 -right-8 p-4 bg-white/5 border border-white/10 backdrop-blur-xl rounded-xl"
             >
                <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Latency</div>
                <div className="font-aztec-mono text-[var(--aztec-chartreuse)]">0.12ms</div>
             </motion.div>

             <motion.div 
                animate={{ x: [0, -10, 0], y: [0, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity }}
                className="absolute bottom-12 -left-12 p-4 bg-white/5 border border-white/10 backdrop-blur-xl rounded-xl"
             >
                <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Decentralization</div>
                <div className="font-aztec-mono text-[var(--aztec-orchid)]">100.00%</div>
             </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
};
