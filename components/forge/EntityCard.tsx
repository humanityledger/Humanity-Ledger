import React from 'react';
import { motion } from 'framer-motion';
import { Dna, Fingerprint, Activity, Code, Music } from 'lucide-react';

export function EntityCard({ entity }: { entity: any }) {
  const isArt = entity.generatorType === 'COSMIC_ART';
  const isMusic = entity.generatorType === 'LIVING_MUSIC';
  const isDNA = entity.generatorType === 'BIOTECH_DNA';

  // Derive visual representation purely from metadata
  const primaryColor = entity.artMetadata?.colorSeed || '#000000';
  const shortHash = entity.seedHash.substring(0, 8).toUpperCase();

  const getTierGradient = (tier: string) => {
    switch(tier) {
      case 'MEGALODON': return 'from-purple-600 to-pink-500';
      case 'LEVIATHAN': return 'from-blue-600 to-indigo-500';
      case 'KRAKEN': return 'from-cyan-500 to-emerald-500';
      default: return 'from-gray-500 to-slate-400';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      className="group relative bg-white border border-black/10 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
    >
      {/* Visual Canvas Base */}
      <div className="relative w-full h-40 bg-[#FFFFFF] overflow-hidden flex items-center justify-center border-b border-black/5">
         {isArt && (
            <div className="absolute inset-0 opacity-40 mix-blend-multiply" style={{
                background: `radial-gradient(circle at center, ${primaryColor} 0%, transparent 70%)`
            }} />
         )}

         {/* Animating DNA/Code wireframe overlay */}
         <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'url("/patron-cosmico-4k.png")', backgroundSize: '150px' }} />

         {/* Core Icon representing the entity essence */}
         <div className="relative z-10 w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center border border-black/5 group-hover:scale-110 transition-transform duration-500">
           {isArt && <Fingerprint size={28} style={{ color: primaryColor }} />}
           {isDNA && <Dna size={28} className="text-emerald-500" />}
           {isMusic && <Music size={28} className="text-indigo-500" />}
           {(!isArt && !isDNA && !isMusic) && <Code size={28} className="text-black/60" />}
         </div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className={`text-[8px] font-black uppercase tracking-[0.2em] mb-1 text-transparent bg-clip-text bg-gradient-to-r ${getTierGradient(entity.tier)}`}>
               {entity.tier} Entity
            </div>
            <p className="text-sm font-black tracking-tight text-[#050505]">SIG-{shortHash}</p>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-100">
            <div className={`w-1.5 h-1.5 rounded-full ${entity.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="text-[8px] font-black uppercase tracking-widest text-[#050505]/60">
               {entity.status}
            </span>
          </div>
        </div>

        {/* Data points */}
        <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-[10px]">
                <span className="font-mono text-black/40 uppercase tracking-widest">Origin</span>
                <span className="font-black text-black">{entity.chain}</span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
                <span className="font-mono text-black/40 uppercase tracking-widest">Generator</span>
                <span className="font-black text-black">{entity.generatorType.split('_').join(' ')}</span>
            </div>
        </div>

        {/* Action */}
        <button className="w-full mt-2 py-3 rounded-xl bg-[#FFFFFF] border border-black/10 text-[10px] font-black uppercase tracking-widest text-[#050505] hover:bg-white hover:text-white transition-colors group/btn flex items-center justify-center gap-2">
           <Activity size={12} className="opacity-50 group-hover/btn:opacity-100" />
           Invoke in Vault
        </button>
      </div>
    </motion.div>
  );
}
