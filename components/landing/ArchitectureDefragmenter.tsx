"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform, MotionValue } from "framer-motion";

function FragmentItem({ index, progress }: { index: number; progress: MotionValue<number> }) {
  // Generate deterministic positions for scattered state
  const randomX = (Math.sin(index * 123) * 300) + "px";
  const randomY = (Math.cos(index * 321) * 300) + "px";
  const randomRot = Math.sin(index * 456) * 180;

  // As progress goes from 0 to 1, move from scattered to 0
  const x = useTransform(progress, [0, 1], [randomX, "0px"]);
  const y = useTransform(progress, [0, 1], [randomY, "0px"]);
  const rotate = useTransform(progress, [0, 1], [randomRot, 0]);
  const opacity = useTransform(progress, [0, 0.2, 0.8, 1], [0, 1, 1, 0.8]);
  const scale = useTransform(progress, [0, 1], [0.2, 1]);

  return (
    <motion.div
      style={{
        x,
        y,
        rotate,
        opacity,
        scale,
        z: 0,
        willChange: "transform, opacity",
      }}
      className="absolute inset-0 m-auto w-12 h-12 bg-white border border-indigo-200 shadow-sm rounded-lg flex items-center justify-center text-[8px] font-mono font-bold text-indigo-400"
    >
      <span>
        {`0x${(index * 13579).toString(16).padStart(4, '0')}`}
      </span>
    </motion.div>
  );
}

export function ArchitectureDefragmenter() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Track scroll progress through this container
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // A more focused scroll progress that maps 0 -> 1 just during the center of the screen
  const defragProgress = useTransform(scrollYProgress, [0.3, 0.6], [0, 1]);

  // Core ZK Block that forms in the center
  const coreScale = useTransform(defragProgress, [0.7, 1], [0.8, 1.2]);
  const coreOpacity = useTransform(defragProgress, [0.6, 0.9], [0, 1]);

  return (
    <div ref={containerRef} className="relative w-full h-[150vh] flex items-center justify-center pointer-events-none overflow-hidden my-20">
      {/* 
        Sticky container keeps the animation centered in the viewport 
        while the user scrolls through the 150vh height.
      */}
      <div className="sticky top-0 w-full h-[100dvh] flex items-center justify-center overflow-hidden">
        
        {/* Glow background */}
        <motion.div 
          style={{ opacity: coreOpacity, z: 0, willChange: 'opacity' }}
          className="absolute w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-[100px]"
        />

        {/* Scattered Fragments */}
        <div className="relative w-full max-w-[600px] h-[600px] perspective-1000">
          {Array.from({ length: 12 }).map((_, i) => (
            <FragmentItem key={i} index={i} progress={defragProgress} />
          ))}
          
          {/* Formed ZK Proof Block */}
          <motion.div
            style={{
              scale: coreScale,
              opacity: coreOpacity,
              z: 0,
              willChange: "transform, opacity"
            }}
            className="absolute inset-0 m-auto w-48 h-48 bg-indigo-600 rounded-3xl shadow-[0_20px_60px_rgba(79,70,229,0.4)] border border-white/20 flex flex-col items-center justify-center gap-2 backdrop-blur-md"
          >
            <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-white animate-spin" />
            <span className="text-white text-[10px] font-mono uppercase tracking-[0.2em] font-bold">
              ZK Proof Generated
            </span>
            <span className="text-indigo-200 text-[8px] font-mono">
              State Compressed
            </span>
          </motion.div>
        </div>

        {/* Informational Text that fades in */}
        <motion.div 
          style={{ opacity: coreOpacity, z: 0, willChange: 'opacity' }}
          className="absolute bottom-24 text-center px-6"
        >
          <p className="text-[18px] md:text-[22px] font-bold text-slate-800 tracking-tight">
            Defragmenting public transparency.
          </p>
          <p className="text-[14px] text-slate-500 mt-2 font-mono uppercase tracking-widest">
            Cryptographic Sealing in Progress
          </p>
        </motion.div>

      </div>
    </div>
  );
}
