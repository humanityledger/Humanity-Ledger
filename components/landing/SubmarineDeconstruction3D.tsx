"use client";

import React, { useState, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";
import { ShieldCheck, Target, Lock, Cpu, Activity, Share2, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- Cosmic Mathematical Timeline ---
const mapProgress = (scroll: number, start: number, end: number) => {
  return Math.max(0, Math.min(1, (scroll - start) / (end - start)));
};

// Smooth easing for organic movement
const easeInOutCubic = (x: number): number => {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

// --- The Core Typhoon Rig in Three.js ---
function TyphoonRig({ scrollProgress }: { scrollProgress: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const scanRef = useRef<THREE.Group>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const reactColor = "#D4FF2B"; // Aztec Chartreuse
  const orchidColor = "#b450ff"; // Aztec Orchid

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: -(e.clientY / window.innerHeight - 0.5) * 2
      });
    };
    window.addEventListener('mousemove', handleMouse);
    return () => window.removeEventListener('mousemove', handleMouse);
  }, []);

  // --- Phase Calculators ---
  const phaseIntro = easeInOutCubic(mapProgress(scrollProgress, 0.0, 0.15));
  const phaseDeconstruct = easeInOutCubic(mapProgress(scrollProgress, 0.15, 0.35));
  const phaseZoom = easeInOutCubic(mapProgress(scrollProgress, 0.35, 0.55));
  const phaseNetwork = easeInOutCubic(mapProgress(scrollProgress, 0.55, 0.75));
  const phaseVault = easeInOutCubic(mapProgress(scrollProgress, 0.75, 0.90));
  const phaseOutro = easeInOutCubic(mapProgress(scrollProgress, 0.90, 1.0));

  useFrame((state, delta) => {
    if (groupRef.current) {
      // 1. Base Rotation + Mouse parallax
      const baseRotationY = state.clock.elapsedTime * 0.1;
      
      // 2. Zoom Rotation (Submarine turns to face user during zoom, then spins wildly in Network phase)
      const targetRotY = baseRotationY + (phaseZoom * Math.PI / 4) + (phaseNetwork * state.clock.elapsedTime * 0.5);
      const targetRotX = mouse.y * 0.2 + (phaseZoom * 0.2) - (phaseVault * 0.5);
      const targetRotZ = -mouse.x * 0.2 + (phaseNetwork * 0.2);

      // Smooth interpolation for rotation
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.1);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, 0.1);
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, targetRotZ, 0.1);

      // 3. Group Positioning (Enter from bottom, scale up during zoom, sink during vault)
      const startY = -8 + (phaseIntro * 8); 
      const vaultY = -phaseVault * 5;
      const outroY = -phaseOutro * 10;
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, startY + vaultY + outroY, 0.1);

      // 4. Group Scale
      const targetScale = 1.8 + (phaseZoom * 1.5) - (phaseVault * 0.5) - (phaseOutro * 1.5);
      groupRef.current.scale.setScalar(THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, 0.1));
    }

    if (scanRef.current) {
      // Fast erratic scanning during Network phase, slow during Intro
      const scanSpeed = 1.5 + (phaseNetwork * 5);
      scanRef.current.position.x = Math.sin(state.clock.elapsedTime * scanSpeed) * 4;
      // Scan ring scales big during network
      const ringScale = 1 + (phaseNetwork * 2);
      scanRef.current.scale.setScalar(ringScale);
    }
  });

  const wireframeMaterial = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    wireframe: true,
    transparent: true,
    opacity: 0.05 + (phaseIntro * 0.15) - (phaseZoom * 0.15),
  });

  const hullMaterial = new THREE.MeshStandardMaterial({
    color: "#0a0a0a",
    roughness: 0.8,
    metalness: 0.5,
    transparent: true,
    opacity: phaseIntro - phaseZoom, // Disappears entirely during zoom
  });

  const innerMaterial = new THREE.MeshStandardMaterial({
    color: reactColor,
    emissive: reactColor,
    emissiveIntensity: 0.5 + phaseDeconstruct * 1.5 + phaseNetwork * 2,
    roughness: 0.2,
    metalness: 0.8,
  });

  return (
    <group ref={groupRef}>
      {/* System Scan Ring */}
      <group ref={scanRef} visible={phaseIntro > 0 && phaseOutro < 1}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[1.5, 0.015, 16, 100]} />
          <meshBasicMaterial color={reactColor} transparent opacity={0.6 + phaseNetwork * 0.4} />
        </mesh>
        <pointLight intensity={1 + phaseNetwork} color={reactColor} distance={4} />
      </group>

      <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
        <group>
          
          {/* Outer Hull (Splits Apart radially) */}
          <group position={[0, phaseDeconstruct * 3, 0]}>
            <mesh material={hullMaterial} rotation={[0, 0, Math.PI / 2]}>
              <capsuleGeometry args={[0.8, 4, 16, 32]} />
            </mesh>
            <mesh material={wireframeMaterial} rotation={[0, 0, Math.PI / 2]} scale={1.01}>
              <capsuleGeometry args={[0.8, 4, 16, 32]} />
            </mesh>
          </group>

          {/* Lower Hull (Sinks) */}
          <group position={[0, -phaseDeconstruct * 3, 0]}>
            <mesh material={hullMaterial} rotation={[0, 0, Math.PI / 2]}>
              <capsuleGeometry args={[0.78, 3.9, 16, 32]} />
            </mesh>
          </group>

          {/* The Inner Core (Sovereign Reactor) */}
          <mesh rotation={[0, 0, Math.PI / 2]} scale={0.5 + phaseDeconstruct * 0.2 + phaseZoom * 0.5}>
            <cylinderGeometry args={[0.4, 0.4, 6, 16]} />
            <meshStandardMaterial 
                color={reactColor} 
                emissive={reactColor} 
                emissiveIntensity={1 + phaseZoom} 
                wireframe={phaseDeconstruct > 0.5 || phaseNetwork > 0} 
            />
          </mesh>

          {/* Logic Silos (Data Slots) */}
          <group position={[phaseDeconstruct * 3 + phaseNetwork * 5, 0.5 + phaseDeconstruct * 1.5, 0]}>
            {Array.from({ length: 6 }).map((_idx, i) => (
              <mesh key={`silo-${i}`} position={[(i - 2.5) * 0.4 * (1 + phaseZoom), 0, 0]} material={innerMaterial}>
                <cylinderGeometry args={[0.08, 0.08, 1, 8]} />
              </mesh>
            ))}
          </group>

          {/* Cryptographic Vault (Revealed during Phase 4) */}
          <group position={[-phaseDeconstruct * 3 - phaseNetwork * 5, -0.5 - phaseDeconstruct * 1.5 - phaseVault * 2, 0]}>
             {Array.from({ length: 4 }).map((_idx, i) => (
              <mesh key={`vault-${i}`} position={[(i - 1.5) * 0.5 * (1 + phaseVault), 0, 0]}>
                <boxGeometry args={[0.3, 0.3, 0.3]} />
                <meshStandardMaterial 
                    color={orchidColor} 
                    emissive={orchidColor} 
                    emissiveIntensity={1.5 + phaseVault * 2} 
                    wireframe={true} 
                />
              </mesh>
            ))}
          </group>

          {/* Cosmic Data Nodes (The Immersive Swarm) */}
          <group>
            {[...Array(60)].map((_idx, i) => {
              // Mathematical spiral placement
              const theta = i * 0.4;
              const radius = 1 + (i * 0.05);
              const x = Math.cos(theta) * radius;
              const y = Math.sin(theta) * radius;
              const z = (i - 30) * 0.1;
              
              // Extreme dispersion during Network Phase
              const dispersion = 1 + phaseDeconstruct * 1.5 + phaseNetwork * 15;
              
              const posX = x * dispersion;
              const posY = y * dispersion;
              const posZ = z * dispersion * 2;

              return (
                <mesh key={`node-${i}`} position={[posX, posY, posZ]} scale={0.02 + (phaseNetwork * 0.05)}>
                  <sphereGeometry args={[1, 8, 8]} />
                  <meshBasicMaterial color={i % 4 === 0 ? orchidColor : reactColor} transparent opacity={0.3 + phaseNetwork * 0.7} />
                </mesh>
              );
            })}
          </group>

        </group>
      </Float>
    </group>
  );
}

// --- Flawless Minimalist DOM Overlays ---
function DOMAnnotations({ scrollProgress }: { scrollProgress: number }) {
  // Letta-inspired crisp fading based strictly on phase bounds
  const showIntro = scrollProgress > 0.02 && scrollProgress < 0.20;
  const showDeconstruct = scrollProgress >= 0.20 && scrollProgress < 0.40;
  const showZoom = scrollProgress >= 0.40 && scrollProgress < 0.60;
  const showNetwork = scrollProgress >= 0.60 && scrollProgress < 0.80;
  const showVault = scrollProgress >= 0.80 && scrollProgress < 0.95;

  const cardVariants: any = {
    hidden: { opacity: 0, y: 30, filter: "blur(5px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.8, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.95, filter: "blur(10px)", transition: { duration: 0.4 } }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center p-8 md:p-24 overflow-hidden">
      
      {/* 1. Introductory Assembly */}
      <AnimatePresence>
        {showIntro && (
          <motion.div 
            variants={cardVariants}
            initial="hidden" animate="visible" exit="exit"
            className="absolute bottom-[15%] right-[10%] max-w-[320px] text-right"
          >
            <div className="flex justify-end mb-4">
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10 backdrop-blur-md">
                    <Eye className="text-white/80" size={24} />
                </div>
            </div>
            <h3 className="text-white font-aztec-serif italic text-3xl mb-2">Absolute <span className="text-[var(--aztec-orchid)]">Immersion</span></h3>
            <p className="text-white/50 text-[11px] uppercase font-aztec-mono tracking-widest leading-relaxed">
              Unveiling the System Architecture. Scroll to descend into the ultimate sovereign data engine.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Deconstruction */}
      <AnimatePresence>
        {showDeconstruct && (
          <motion.div 
            variants={cardVariants}
            initial="hidden" animate="visible" exit="exit"
            className="absolute top-[25%] left-[10%] max-w-[320px]"
          >
            <div className="w-10 h-10 bg-[var(--aztec-chartreuse)]/10 rounded-full flex items-center justify-center mb-4 border border-[var(--aztec-chartreuse)]/20 shadow-[0_0_15px_rgba(212,255,43,0.1)]">
              <ShieldCheck className="text-[var(--aztec-chartreuse)]" size={20} />
            </div>
            <h3 className="text-white font-aztec-mono text-[12px] uppercase tracking-[0.4em] font-bold mb-2">
              Titanium Shielding
            </h3>
            <p className="text-[var(--aztec-chartreuse)]/60 text-[11px] uppercase font-aztec-mono tracking-widest leading-relaxed">
              Pressure hulls decoupling. Cryptographic shielding disengages to reveal the inner state machine.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. The Core Zoom */}
      <AnimatePresence>
        {showZoom && (
          <motion.div 
            variants={cardVariants}
            initial="hidden" animate="visible" exit="exit"
            className="absolute bottom-[20%] right-[10%] max-w-[340px]"
          >
            <div className="bg-[#0a0a0a]/90 backdrop-blur-xl border-l-[3px] border-[var(--aztec-orchid)] p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-40">
                  <Cpu size={80} />
              </div>
              <h3 className="text-white font-aztec-serif italic text-2xl mb-3 relative z-10">
                Sovereign <span className="text-[var(--aztec-orchid)]">Logic Core</span>
              </h3>
              <p className="text-white/60 text-[10px] uppercase font-aztec-mono tracking-widest leading-relaxed relative z-10">
                Programmable zero knowledge execution nodes. 100% mathematical certainty, 0% data leakage.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Network Expansion */}
      <AnimatePresence>
        {showNetwork && (
          <motion.div 
            variants={cardVariants}
            initial="hidden" animate="visible" exit="exit"
            className="absolute top-[30%] left-[8%] md:left-[20%] max-w-[400px]"
          >
            <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-px bg-gradient-to-r from-transparent to-[var(--aztec-chartreuse)]" />
                <Share2 className="text-[var(--aztec-chartreuse)]" size={28} />
                <h3 className="text-white font-aztec-mono text-[14px] uppercase tracking-[0.4em] font-black">
                    Cosmic Distribution
                </h3>
            </div>
            <p className="text-white/70 text-lg font-aztec-serif italic leading-relaxed pl-20">
              Thousands of system data points dispersing across the global network in real-time. Absolute resilience.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. The System Vault */}
      <AnimatePresence>
        {showVault && (
          <motion.div 
            variants={cardVariants}
            initial="hidden" animate="visible" exit="exit"
            className="absolute bottom-[30%] left-1/2 -translate-x-1/2 text-center w-[90%] max-w-[500px]"
          >
            <div className="w-16 h-16 bg-white/5 mx-auto rounded-3xl flex items-center justify-center mb-6 border border-white/20 shadow-[0_20px_40px_-10px_rgba(255,255,255,0.1)]">
              <Lock className="text-white" size={32} />
            </div>
            <h3 className="text-white font-aztec-h1 text-5xl mb-4 tracking-tight drop-shadow-2xl">
              System <span className="text-[var(--aztec-orchid)]/80 italic font-light">Permanence</span>
            </h3>
            <p className="text-white/50 text-[11px] uppercase font-aztec-mono tracking-[0.3em] leading-relaxed">
              Your assets descend into absolute cold storage. untouchable by algorithms. Protected by the deep network.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// --- Main Assembly ---
export default function SubmarineDeconstruction3D() {
  const [mounted, setMounted] = useState(false);
  const [scroll, setScroll] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMounted(true);
    
    // Robust Native Scroll Listener for 800vh terrain
    const handleScroll = () => {
      if (!sectionRef.current) return;
      
      const { top, height } = sectionRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      const totalScrollableDistance = height - windowHeight;
      const amountScrolled = -top;
      
      let progress = amountScrolled / totalScrollableDistance;
      progress = Math.max(0, Math.min(1, progress));
      setScroll(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!mounted) {
    return <section className="relative w-full h-screen bg-white" />;
  }

  return (
    // Transform into a monstrous 800vh storytelling scroll terrain
    <section ref={sectionRef} className="relative w-full h-[800vh] bg-white selection:bg-[var(--aztec-orchid)]/30">
      
      <div className="sticky top-0 w-full h-screen overflow-hidden flex items-center justify-center bg-noise">
        {/* Deep Environment Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)] z-10 pointer-events-none opacity-90" />
        
        {/* Storytelling DOM Overlays */}
        <DOMAnnotations scrollProgress={scroll} />

        {/* 240Hz High-Performance WebGL Engine */}
        <Canvas
          camera={{ position: [0, 0, 12], fov: 45 }}
          dpr={[1, 1.5]}
          performance={{ min: 0.5, max: 1 }}
          gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, depth: true }}
        >
          <color attach="background" args={['#050505']} />
          <fog attach="fog" args={['#050505', 10, 30]} />
          
          <ambientLight intensity={0.2} />
          <spotLight position={[-15, 15, 15]} angle={0.2} penumbra={1} intensity={1.5} color="#b450ff" />
          <pointLight position={[15, -15, -15]} intensity={0.5} color="#D4FF2B" />
          
          <TyphoonRig scrollProgress={scroll} />
        </Canvas>

        {/* Cinematic Watermarks */}
        <div className="absolute top-12 left-12 opacity-40 font-aztec-mono text-[9px] uppercase tracking-[0.6em] text-white pointer-events-none hidden md:block z-0 mix-blend-overlay">
          Protocol: System Deep / Phase {Math.floor(scroll * 6)} / Grid Active
        </div>
        
        <div className="absolute bottom-12 right-12 text-right opacity-40 font-aztec-serif italic text-white text-[10vw] leading-none select-none pointer-events-none hidden md:block z-0 mix-blend-overlay">
          LEDGER
        </div>
      </div>
    </section>
  );
}
