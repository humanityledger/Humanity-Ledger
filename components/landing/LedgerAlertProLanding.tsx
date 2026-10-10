"use client";

import React, { useEffect, useRef } from "react";
import { motion, useScroll, useTransform, useSpring, useInView } from "framer-motion";
import Lenis from "lenis";
import { 
  Zap, Shield, Activity, Search, Cpu, Bell, 
  ArrowRight, LayoutDashboard, Globe, Lock, 
  Layers, Terminal, BarChart3, Database
} from "lucide-react";
import Link from "next/link";
import { UniversalEliteWallpaper } from "@/components/shared/UniversalEliteWallpaper";

// --- Smooth Scroll Provider (Lenis) ---
function useSmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.5,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.2,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);
}

// --- Parallax Layer Component ---
function ParallaxLayer({ 
  children, 
  speed = 0.5, 
  opacity = [1, 1],
  scale = [1, 1],
  className = "" 
}: { 
  children: React.ReactNode; 
  speed?: number; 
  opacity?: [number, number];
  scale?: [number, number];
  className?: string;
}) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", `${speed * 100}%`]);
  const o = useTransform(scrollYProgress, [0, 1], opacity);
  const s = useTransform(scrollYProgress, [0, 1], scale);

  return (
    <motion.div ref={ref} style={{ y, opacity: o, scale: s }} className={className}>
      {children}
    </motion.div>
  );
}

// --- Dynamic Text Shimmer ---
function ShimmerText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-400 to-white bg-[length:200%_auto] animate-shimmer">
        {text}
      </span>
    </span>
  );
}

export function HumanityLedgerProLanding() {
  useSmoothScroll();
  const { scrollYProgress } = useScroll();
  const scale = useSpring(useTransform(scrollYProgress, [0, 0.2], [1, 1.2]), { stiffness: 100, damping: 30 });
  
  return (
    <div className="bg-black text-white selection:bg-cyan-500/30 selection:text-cyan-200">
      <UniversalEliteWallpaper />
      
      {/* --- PROGRESS BAR --- */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-[#25D366] to-purple-600 z-[100] origin-left"
        style={{ scaleX: scrollYProgress }}
      />

      {/* --- HERO SECTION: THE AWAKENING --- */}
      <section className="relative h-[120vh] flex flex-col items-center justify-center overflow-hidden">
        {/* Background Particles Parallax */}
        <div className="absolute inset-0 z-0">
          <ParallaxLayer speed={-0.2} className="w-full h-full">
            <img 
              src="/models/update/3d-render-abstract-techno-background-with-flowing-cyber-particles.jpg" 
              className="w-full h-full object-cover opacity-60 scale-110" 
              alt="Cyber Particles"
            />
          </ParallaxLayer>
        </div>

        {/* Central Holographic Shape */}
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <motion.div 
            style={{ scale }}
            className="w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] relative"
          >
            <img 
              src="/models/update/3d-shape-glowing-with-bright-holographic-colors.jpg" 
              className="w-full h-full object-cover rounded-full mix-blend-screen opacity-90 blur-sm brightness-125"
              alt="Holographic Core"
            />
            {/* Pulsing Light Overlay */}
            <motion.div 
              animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.05, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 bg-cyan-500/20 rounded-full blur-[100px]"
            />
          </motion.div>
        </div>

        {/* Hero Content */}
        <div className="relative z-20 text-left px-6 max-w-[2560px] mt-[-10vh]">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          >
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-cyan-500" />
              <span className="text-cyan-400 font-mono text-[10px] tracking-[0.5em] uppercase">Humanity Ledger Analytics</span>
              <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-cyan-500" />
            </div>
            
            <h1 className="text-7xl md:text-[9rem] font-black tracking-tighter leading-[0.85] mb-8">
              Humanity Ledger <br />
              <ShimmerText text="PRO" />
            </h1>

            <p className="text-lg md:text-2xl text-white/50 font-light max-w-3xl mx-auto mb-12 leading-relaxed tracking-tight">
              Detect. Decrypt. Dominate. <br />
              The world's most immersive real-time <span className="text-white font-medium">Ledger Observation System</span>, 
              built for the elite 1% of the Web3 system era.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link href="/vip">
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(6, 182, 212, 0.4)" }}
                  whileTap={{ scale: 0.95 }}
                  className="px-12 py-5 bg-white text-black font-black uppercase tracking-widest text-xs rounded-full flex items-center gap-3 transition-shadow"
                >
                  Enter Terminal <Zap size={16} fill="currentColor" />
                </motion.button>
              </Link>
              <Link href="/api-marketplace">
                <motion.button
                  whileHover={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                  className="px-12 py-5 border border-white/20 text-white font-black uppercase tracking-widest text-xs rounded-full flex items-center gap-3"
                >
                  Explore API <ArrowRight size={16} />
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Floating Prisms Parallax */}
        <div className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] z-30 opacity-40">
           <ParallaxLayer speed={0.8} scale={[1, 1.5]}>
              <img src="/models/update/light-prisms-colorful-effect.jpg" className="w-full h-full object-cover mix-blend-lighten blur-2xl" alt="Prism" />
           </ParallaxLayer>
        </div>
      </section>

      {/* --- SECTION: THE ENGINE (SCROLLYTELLING) --- */}
      <section className="relative py-48 px-6 bg-black">
        <div className="max-w-[2560px] mx-auto text-left">
          {/* Step 1: Detection */}
          <div className="grid lg:grid-cols-2 gap-24 items-center mb-64">
             <div className="relative order-2 lg:order-1">
                <ParallaxLayer speed={0.2} className="relative z-10">
                   <div className="aspect-square rounded-3xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-3xl group transition-all duration-700 hover:border-cyan-500/50">
                      <img src="/models/update/17863656.jpg" className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-[2000ms]" alt="Scanning" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                      {/* Scanning Line Animation */}
                      <motion.div 
                        initial={{ top: "0%" }}
                        animate={{ top: "100%" }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="absolute left-0 right-0 h-[2px] bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.8)] z-20"
                      />
                   </div>
                </ParallaxLayer>
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-500/20 blur-[80px] rounded-full" />
             </div>
             <div className="order-1 lg:order-2">
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8 }}
                >
                   <div className="flex items-center gap-3 text-cyan-500 font-mono text-[10px] tracking-[0.4em] uppercase mb-6">
                      <div className="w-2 h-2 bg-cyan-500 animate-pulse rounded-full" />
                      Phase 01: Multi-Vector Detection
                   </div>
                   <h2 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter leading-none">
                      SCANNING THE <br />
                      <span className="text-white/20">MULTIVERSE.</span>
                   </h2>
                   <p className="text-xl text-white/40 leading-relaxed font-light mb-10">
                      Our proprietary scanner threads penetrate every liquidity pool in real-time. 
                      Not just transferswe detect the <span className="text-white">intents</span> of the world's most powerful wallets before they hit the order book.
                   </p>
                   <div className="grid grid-cols-2 gap-8">
                      <div>
                        <div className="text-3xl font-black text-white mb-2 tracking-tighter">0.5s</div>
                        <div className="text-[10px] font-mono text-white/20 uppercase tracking-widest">Global Latency</div>
                      </div>
                      <div>
                        <div className="text-3xl font-black text-white mb-2 tracking-tighter">500k+</div>
                        <div className="text-[10px] font-mono text-white/20 uppercase tracking-widest">Active Wallets</div>
                      </div>
                   </div>
                </motion.div>
             </div>
          </div>

          {/* Step 2: Processing */}
          <div className="grid lg:grid-cols-2 gap-24 items-center mb-64">
             <div>
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8 }}
                >
                   <div className="flex items-center gap-3 text-purple-500 font-mono text-[10px] tracking-[0.4em] uppercase mb-6">
                      <div className="w-2 h-2 bg-purple-500 animate-pulse rounded-full" />
                      Phase 02: Alpha Processing
                   </div>
                   <h2 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter leading-none">
                      DECRYPTION OF <br />
                      <span className="text-white/20">PURE INTENSITY.</span>
                   </h2>
                   <p className="text-xl text-white/40 leading-relaxed font-light mb-10">
                      Raw data is noise. Our quantitative engine filters billions of bytes into sovereign-grade signals. 
                      Transforming blockchain chaos into <span className="text-white">Forensic Guidance</span>.
                   </p>
                   <div className="flex flex-wrap gap-4">
                      {["Sentiment Pulse", "Intensity Radar", "Ledger Vigor", "Conviction Score"].map((tag) => (
                        <span key={tag} className="px-4 py-2 border border-white/5 bg-white/5 rounded-full text-[10px] font-mono text-white/40 uppercase tracking-widest">
                          {tag}
                        </span>
                      ))}
                   </div>
                </motion.div>
             </div>
             <div className="relative">
                <ParallaxLayer speed={-0.2} className="relative z-10">
                   <div className="aspect-video rounded-3xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-3xl p-8 flex items-center justify-center">
                      <div className="relative w-full h-full flex items-center justify-center">
                         {/* Abstract Processing UI */}
                         <div className="absolute inset-0 flex items-center justify-center">
                            <motion.div 
                              animate={{ rotate: 360 }}
                              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                              className="w-64 h-64 border-2 border-dashed border-cyan-500/20 rounded-full" 
                            />
                            <motion.div 
                              animate={{ rotate: -360 }}
                              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                              className="absolute w-48 h-48 border-2 border-dashed border-purple-500/20 rounded-full" 
                            />
                         </div>
                         <Cpu size={80} className="text-white opacity-20" strokeWidth={1} />
                      </div>
                   </div>
                </ParallaxLayer>
                <div className="absolute bottom-[-10%] right-[-10%] w-[30vw] h-[30vw] z-0 opacity-40">
                   <img src="/models/update/light-prisms-colorful-effect.jpg" className="w-full h-full object-cover mix-blend-lighten rotate-90" alt="Prism" />
                </div>
             </div>
          </div>

          {/* Step 3: Alerting */}
          <div className="grid lg:grid-cols-2 gap-24 items-center">
             <div className="relative order-2 lg:order-1">
                <ParallaxLayer speed={0.1}>
                   <div className="aspect-square rounded-3xl overflow-hidden border border-white/10 relative">
                       <img src="/models/update/metaverse.png" className="w-full h-full object-cover grayscale opacity-50" alt="Alerting" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                         <div className="text-center p-12 bg-black/80 border border-white/10 rounded-2xl max-w-sm">
                            <Bell size={48} className="text-cyan-500 mx-auto mb-6 animate-bounce" />
                            <div className="text-xs font-mono text-cyan-400 mb-2">LEDGER_DETECTED [ETH]</div>
                            <div className="text-2xl font-black mb-2">$48,291,029</div>
                            <div className="text-[10px] text-white/40 uppercase tracking-widest">Sovereign Accumulation Detected</div>
                         </div>
                      </div>
                   </div>
                </ParallaxLayer>
             </div>
             <div className="order-1 lg:order-2">
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                >
                   <div className="flex items-center gap-3 text-white font-mono text-[10px] tracking-[0.4em] uppercase mb-6">
                      <div className="w-2 h-2 bg-white animate-pulse rounded-full" />
                      Phase 03: Immediate Delivery
                   </div>
                   <h2 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter leading-none">
                      UNMATCHED <br />
                      <span className="text-white/20">VELOCITY.</span>
                   </h2>
                   <p className="text-xl text-white/40 leading-relaxed font-light mb-10">
                      Alerts delivered via WebSocket, Webhook, and Terminal in sub-second timeframes. 
                      In the time it takes to read this sentence, our users have already <span className="text-white">executed their edge</span>.
                   </p>
                   <Link href="/api-marketplace">
                      <button className="px-10 py-4 border border-cyan-500/30 text-cyan-400 font-black uppercase tracking-widest text-[10px] rounded-full hover:bg-cyan-500/10 transition-colors">
                        Get Instant Access
                      </button>
                   </Link>
                </motion.div>
             </div>
          </div>
        </div>
      </section>

      {/* --- SECTION: THE DARK ALPHA VISION --- */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden bg-black">
        <div className="absolute inset-0 z-0">
          <img 
            src="/models/update/3d-render-abstract-techno-background-with-flowing-cyber-particles.jpg" 
            className="w-full h-full object-cover opacity-20 scale-125" 
            alt="Vision Background" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black" />
        </div>

        <div className="relative z-10 text-center px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          >
            <h2 className="text-[10vw] font-black tracking-tighter text-white/5 opacity-50 absolute inset-0 flex items-center justify-center select-none pointer-events-none">
              Humanity Ledger
            </h2>
            <div className="max-w-4xl mx-auto relative z-20">
              <h3 className="text-4xl md:text-7xl font-black mb-8 leading-tight tracking-tighter">
                THE FUTURE IS NOT <br />
                <span className="text-cyan-500">PREDICTED.</span> <br />
                IT IS <ShimmerText text="OBSERVED." />
              </h3>
              <p className="text-xl text-white/40 mb-12 font-light">
                Join the network that defines the frontier. <br />
                Humanity Ledger Pro is more than a toolit's your absolute vision into the cosmic flow of value.
              </p>
              <Link href="/vip">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="px-16 py-6 bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-black uppercase tracking-[0.3em] text-sm rounded-full shadow-[0_0_50px_rgba(6,182,212,0.5)]"
                >
                  Join the Elite
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-20 px-12 border-t border-white/5 bg-black/90 relative z-50">
        <div className="max-w-[2560px] mx-auto flex flex-col md:row items-start justify-between gap-12 text-left">
           <div className="text-left">
              <div className="text-2xl font-black tracking-tighter mb-4">Humanity Ledger <span className="text-cyan-500">PRO</span></div>
              <div className="text-[10px] font-mono text-white/20 uppercase tracking-[0.4em]">© 2026 Humanity Ledger Access</div>
           </div>
           <div className="flex gap-12">
              <div className="flex flex-col gap-4">
                 <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">Engine</div>
                 <Link href="/vip" className="text-xs text-white/20 hover:text-cyan-400 transition-colors">Terminal</Link>
                 <Link href="/portfolio" className="text-xs text-white/20 hover:text-cyan-400 transition-colors">Portfolio</Link>
                 <Link href="/ledger" className="text-xs text-white/20 hover:text-cyan-400 transition-colors">Ledger</Link>
              </div>
              <div className="flex flex-col gap-4">
                 <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">Connect</div>
                 <span className="text-xs text-white/20 hover:text-cyan-400 cursor-pointer">Discord</span>
                 <span className="text-xs text-white/20 hover:text-cyan-400 cursor-pointer">X / Twitter</span>
                 <span className="text-xs text-white/20 hover:text-cyan-400 cursor-pointer">GitHub</span>
              </div>
           </div>
           <button 
             onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
             className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:border-cyan-500 text-white/20 hover:text-cyan-500 transition-all"
           >
              <Zap size={20} />
           </button>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .animate-shimmer {
          animation: shimmer 8s linear infinite;
        }
      `}</style>
    </div>
  );
}

