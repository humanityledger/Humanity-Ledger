"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Rocket, Target, ShieldCheck, Globe, Zap, Stars } from 'lucide-react';

const roadmapData = [
  {
    phase: "Phase 1: Foundation",
    year: "2026 Q1-Q2",
    title: "Global Network Initialization",
    description: "Bootstrapping the core nodes for the Aztec PXE and establishing the baseline Relayer Network. Focus on absolute security and 99.99% uptime.",
    icon: Rocket,
    completed: true,
  },
  {
    phase: "Phase 2: Expansion",
    year: "2026 Q3-Q4",
    title: "Decentralized Messaging CRDT",
    description: "Rolling out the peer-to-peer messaging protocol across all regions. Enabling sub-second latency for secure communications globally.",
    icon: Globe,
    completed: false,
    active: true,
  },
  {
    phase: "Phase 3: Integration",
    year: "2027",
    title: "Enterprise Adoption & ZK Solutions",
    description: "Integrating Zero-Knowledge proofs for enterprise compliance and scaling the network to handle 10x throughput without sacrificing decentralization.",
    icon: ShieldCheck,
    completed: false,
  },
  {
    phase: "Phase 4: Evolution",
    year: "2028",
    title: "The Intelligent Protocol",
    description: "Introducing advanced machine learning models directly into the network consensus layer to optimize routing and predictive scaling.",
    icon: Zap,
    completed: false,
  }
];

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 font-sans selection:bg-neutral-200 overflow-hidden relative">
      
      {/* Background embellishments */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-neutral-50 to-transparent opacity-50 pointer-events-none rounded-full blur-3xl"></div>

      <div className="max-w-5xl mx-auto px-6 py-24 relative z-10">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center space-y-6 mb-24"
        >
          <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-neutral-50 border border-neutral-100 text-sm font-medium text-neutral-600 mb-4 shadow-sm">
            <Stars className="w-4 h-4 text-neutral-800" />
            <span>Master Plan 2026-2028</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-neutral-900">
            The road ahead.
          </h1>
          <p className="text-xl text-neutral-500 max-w-2xl font-light leading-relaxed">
            We are building the future of decentralized infrastructure. Transparent, relentless, and driven by absolute precision.
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-[39px] md:left-1/2 md:-ml-px top-0 bottom-0 w-px bg-neutral-100"></div>

          <div className="space-y-16">
            {roadmapData.map((item, index) => {
              const isEven = index % 2 === 0;
              return (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.7, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className={`relative flex items-start md:items-center ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} group`}
                >
                  
                  {/* Content Container */}
                  <div className={`ml-20 md:ml-0 md:w-1/2 flex ${isEven ? 'md:justify-end md:pr-16' : 'md:justify-start md:pl-16'} relative z-10`}>
                    <div className="bg-white border border-neutral-100 rounded-3xl p-8 hover:border-neutral-200 transition-all duration-500 hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] max-w-md w-full">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold tracking-wider uppercase text-neutral-400 bg-neutral-50 px-3 py-1 rounded-full">{item.phase}</span>
                        <span className="text-sm font-medium text-neutral-900">{item.year}</span>
                      </div>
                      <h3 className="text-2xl font-medium text-neutral-900 mb-3">{item.title}</h3>
                      <p className="text-neutral-500 font-light leading-relaxed mb-6">{item.description}</p>
                      
                      <div className="flex items-center space-x-2 text-sm font-medium">
                        {item.completed ? (
                          <span className="flex items-center text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                            <ShieldCheck className="w-4 h-4 mr-2" /> Completed
                          </span>
                        ) : item.active ? (
                          <span className="flex items-center text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                            <Zap className="w-4 h-4 mr-2" /> In Progress
                          </span>
                        ) : (
                          <span className="flex items-center text-neutral-400 bg-neutral-50 px-3 py-1 rounded-full">
                            <Target className="w-4 h-4 mr-2" /> Upcoming
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Center Node */}
                  <div className="absolute left-6 md:left-1/2 transform -translate-x-1/2 mt-8 md:mt-0 z-20">
                    <motion.div 
                      whileHover={{ scale: 1.1 }}
                      className={`w-14 h-14 rounded-full border-4 border-white shadow-sm flex items-center justify-center transition-colors duration-300 ${
                        item.completed ? 'bg-neutral-900 text-white' : 
                        item.active ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]' : 
                        'bg-neutral-100 text-neutral-400'
                      }`}
                    >
                      <item.icon className="w-6 h-6" strokeWidth={1.5} />
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
        
      </div>
    </div>
  );
}
