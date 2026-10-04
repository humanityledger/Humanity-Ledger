"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, Activity, GraduationCap, MessageSquare, Terminal } from "lucide-react";

export function SystemProfileModal({ 
  isOpen, 
  onClose, 
  walletAddress 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  walletAddress?: string 
}) {
  const [activeTab, setActiveTab] = useState("IDENTITY");

  // Local states until full actions hook logic is integrated:
  const sessionLogs = [
    { timestamp: "2026-04-19 14:02:11", action: "LESSON_COMPLETED", ip: "192.168.1.1", loc: "Madrid, ES" },
    { timestamp: "2026-04-19 13:45:00", action: "TASK_SUBMISSION", ip: "192.168.1.1", loc: "Madrid, ES" },
    { timestamp: "2026-04-18 22:15:33", action: "LOGIN_VERIFIED", ip: "185.11.23.1", loc: "Berlin, DE" }
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
         initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
         className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      >
        <motion.div 
           initial={{ y: 20, opacity: 0, scale: 0.98 }} 
           animate={{ y: 0, opacity: 1, scale: 1 }}
           exit={{ y: 20, opacity: 0, scale: 0.98 }}
           className="bg-[#FFFFFF] w-full max-w-4xl shadow-2xl overflow-hidden border border-black/20 flex flex-col h-[85vh] max-h-[800px]"
        >
          {/* Header */}
          <div className="bg-black text-white p-5 flex justify-between items-center">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/10 flex items-center justify-center border border-white/20">
                   <Shield size={18}/>
                </div>
                <div>
                   <h2 className="font-serif font-bold text-lg uppercase tracking-widest text-[#FFFFFF]">System Grid Profile</h2>
                   <span className="font-mono text-[9px] text-[#FFFFFF]/50 break-all">{walletAddress || "OFFLINE_MODE"}</span>
                </div>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-white/10 transition-colors text-white/50 hover:text-white">
               <X size={20}/>
             </button>
          </div>

          {/* Navigation */}
          <div className="flex border-b border-black/10 bg-[#FAF9F5]">
             {["IDENTITY", "PRIVACY_LOGS", "MENTORING"].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-4 text-[10px] font-mono font-bold uppercase tracking-widest transition-colors ${activeTab === tab ? 'bg-[#FFFFFF] text-black border-b-2 border-black' : 'text-black/40 hover:text-black/80 hover:bg-black/5'}`}
                >
                  {tab === "IDENTITY" && <GraduationCap size={14} className="inline mr-2"/>}
                  {tab === "PRIVACY_LOGS" && <Activity size={14} className="inline mr-2"/>}
                  {tab === "MENTORING" && <MessageSquare size={14} className="inline mr-2"/>}
                  {tab.replace("_", " & ")}
                </button>
             ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#FFFFFF]">
             
             {activeTab === "IDENTITY" && (
                <div className="space-y-8 animate-in fade-in">
                   <div className="flex justify-between items-end border-b border-black/10 pb-4">
                      <h3 className="font-serif text-2xl font-bold uppercase tracking-tight">Expediente Criptográfico</h3>
                      <span className="font-mono text-xs text-black/50">Status: EN CURSO</span>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 border border-black/10 bg-white">
                         <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-black/40 mb-2">Progreso Global</h4>
                         <div className="text-4xl font-serif">12<span className="text-xl text-black/30"> / 490</span></div>
                         <div className="mt-4 h-1 w-full bg-black/10"><div className="h-full bg-emerald-500 w-[2.4%]"/></div>
                      </div>
                      <div className="p-6 border border-black/10 bg-white">
                         <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-black/40 mb-2">Evaluaciones Superadas</h4>
                         <div className="text-4xl font-serif text-emerald-600">3</div>
                         <p className="mt-4 text-[10px] font-mono text-black/40 uppercase">Certificado Pendiente</p>
                      </div>
                   </div>
                   
                   <div className="border border-black/10 bg-white p-6">
                       <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-black/40 mb-6">Cryptographic Mastery Heuristics</h4>
                       <div className="space-y-4">
                           {[
                               { label: 'Blockchain Architecture', score: 85 },
                               { label: 'Smart Contract Security', score: 42 },
                               { label: 'Zero Knowledge Proofs', score: 15 },
                               { label: 'On-Chain Forensics', score: 92 }
                           ].map((skill) => (
                               <div key={skill.label} className="flex items-center gap-4">
                                   <div className="w-1/3 text-[9px] font-mono font-bold uppercase tracking-widest text-black/60 truncate">
                                       {skill.label}
                                   </div>
                                   <div className="flex-1 h-1.5 bg-black/5 overflow-hidden">
                                       <div 
                                           className={`h-full ${skill.score > 80 ? 'bg-emerald-500' : skill.score > 40 ? 'bg-amber-500' : 'bg-black/20'}`} 
                                           style={{ width: `${skill.score}%` }}
                                       />
                                   </div>
                                   <div className="w-8 text-right text-[10px] font-mono font-bold">
                                       {skill.score}%
                                   </div>
                               </div>
                           ))}
                       </div>
                   </div>
                </div>
             )}

             {activeTab === "PRIVACY_LOGS" && (
                <div className="space-y-8 animate-in fade-in">
                    <div className="border-b border-black/10 pb-4 flex justify-between items-end">
                       <div>
                          <h3 className="font-serif text-2xl font-bold uppercase tracking-tight">Registro Forense</h3>
                          <p className="font-mono text-[10px] text-black/50 mt-1">Moodle-Layer Telemetry Grid</p>
                       </div>
                       <button className="px-4 py-2 border border-black text-black font-mono text-[9px] uppercase font-bold hover:bg-black hover:text-white transition-colors">
                          Export CSV
                       </button>
                    </div>

                    <div className="overflow-x-auto border border-black/10">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr className="bg-[#FAF9F5] border-b border-black/10">
                                    <th className="p-4 font-mono text-[9px] uppercase tracking-widest font-bold">Instante Temporal</th>
                                    <th className="p-4 font-mono text-[9px] uppercase tracking-widest font-bold">Vector de Acción</th>
                                    <th className="p-4 font-mono text-[9px] uppercase tracking-widest font-bold">IP de Origen</th>
                                    <th className="p-4 font-mono text-[9px] uppercase tracking-widest font-bold">Localización Geo-Nodal</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {sessionLogs.map((log, i) => (
                                    <tr key={i} className="border-b border-black/5 hover:bg-black/5 transition-colors">
                                        <td className="p-4 font-mono text-[10px] text-black/60">{log.timestamp}</td>
                                        <td className="p-4 font-mono text-[10px] font-bold">{log.action}</td>
                                        <td className="p-4 font-mono text-[10px] text-black/50">{log.ip}</td>
                                        <td className="p-4 font-mono text-[10px] text-black/50">{log.loc}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
             )}

             {activeTab === "MENTORING" && (
                <div className="h-full flex flex-col justify-end border border-black/10 bg-white">
                    <div className="flex-1 p-6 flex flex-col justify-end space-y-4 overflow-y-auto">
                        <div className="bg-[#FAF9F5] border border-black/10 p-4 max-w-[80%] self-start">
                            <span className="font-mono text-[8px] text-black/40 block mb-2">TEACHER ROOT  14:02</span>
                            <p className="font-serif text-[12px] leading-relaxed">
                                Welcome al canal de mentoría directa. Este es un enclave cifrado asíncrono. Sube la demostración de tu smart contract cuando estés listo, o déjame tus consultas si la entropía de la Capa Cero te bloquea.
                            </p>
                        </div>
                    </div>
                    <div className="p-4 border-t border-black/10 bg-[#FAF9F5] flex gap-2">
                         <div className="w-10 h-10 border border-black/10 bg-white flex items-center justify-center hover:bg-black/5 cursor-pointer">
                            <Terminal size={14}/>
                         </div>
                         <input type="text" placeholder="Transmitir mensaje al mentor..." className="flex-1 px-4 text-[10px] font-mono border border-black/10 outline-none focus:border-black" />
                         <button className="px-6 bg-black text-white font-mono text-[10px] uppercase font-bold hover:bg-neutral-800">send</button>
                    </div>
                </div>
             )}

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

