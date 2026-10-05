import React from 'react';
import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

const CSSIPhone = ({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) => (
  <div className="flex flex-col items-center">
    <div className="mb-10 text-center">
      <h3 className="text-[28px] md:text-[36px] font-bold text-[#1C1C1E] mb-3">{title}</h3>
      <p className="text-[16px] md:text-[18px] text-[#1C1C1E]/60 max-w-sm mx-auto leading-relaxed">{subtitle}</p>
    </div>
    
    <div className="relative w-[300px] h-[610px] md:w-[320px] md:h-[650px] bg-black rounded-[48px] shadow-2xl p-[8px] border border-black/10">
      <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-50">
        <div className="w-32 h-6 bg-black rounded-b-3xl"></div>
      </div>
      <div className="w-full h-full bg-white rounded-[40px] overflow-hidden relative flex flex-col">
        {children}
      </div>
    </div>
  </div>
);

export const LedgerShowcase = () => {
  return (
    <section className="bg-[#F0F4F8] py-24 md:py-32 w-full overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-5 md:px-10 flex flex-col lg:flex-row justify-center gap-16 lg:gap-8">
        
        {/* Phone 1: End-to-End Encrypted */}
        <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE }}>
          <CSSIPhone title="End-to-End Encrypted" subtitle="Keep your message history tidy and sovereign.">
            {/* Header */}
            <div className="h-[88px] bg-[#111B21] pt-10 px-4 flex items-center justify-between shadow-md z-10 relative">
              <div className="flex items-center gap-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-[12px] font-bold">MJ</div>
                  <div>
                    <h4 className="font-bold text-[14px] text-white leading-tight">Maya Johnson</h4>
                    <span className="text-[11px] text-white/60">0xAE32...91F2</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
              </div>
            </div>
            {/* Chat Area */}
            <div className="flex-1 bg-[#0b141a] flex flex-col p-4 gap-3 relative overflow-hidden">
              <div className="w-full flex justify-center my-2">
                <div className="bg-[#182229] rounded-xl py-1.5 px-3 border border-white/5">
                  <p className="text-[11px] text-[#8696a0] font-mono">End-to-End Encrypted</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-[#25D366] text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%] shadow-sm">
                  <p className="text-[14px]">I'm on my way! What's the address?</p>
                </div>
              </div>
              <div className="w-full flex justify-center my-2">
                <p className="text-[11px] text-[#8696a0] text-center max-w-[200px]">Maya set disappearing message time to 1 day.</p>
              </div>
              <div className="flex justify-start">
                <div className="bg-[#202c33] text-white rounded-2xl rounded-tl-sm px-4 py-2 max-w-[80%] shadow-sm">
                  <p className="text-[14px]">We're at 118 68th Ave.</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-[#25D366] text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-[80%] shadow-sm">
                  <p className="text-[14px]">Is there a buzzer? Don't want to ruin the surprise.</p>
                </div>
              </div>
              {/* Input */}
              <div className="absolute bottom-4 left-4 right-4 bg-[#202c33] rounded-full h-11 flex items-center px-4 gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <div className="flex-1 text-[14px] text-[#8696a0]">Message</div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
              </div>
            </div>
          </CSSIPhone>
        </motion.div>

        {/* Phone 2: Native Crypto Payments */}
        <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}>
          <CSSIPhone title="Native Crypto Payments" subtitle="Send and receive USDC natively in chat without switching apps.">
            {/* Header */}
            <div className="h-[88px] bg-white pt-10 px-4 flex items-center justify-between border-b border-black/[0.05]">
              <div className="flex items-center gap-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111B21" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-[12px] font-bold">DT</div>
                <h4 className="font-bold text-[14px] text-[#111B21]">Dave Tech</h4>
              </div>
            </div>
            {/* Chat Area */}
            <div className="flex-1 bg-[#EBE5DC] flex flex-col p-4 gap-3 relative overflow-hidden">
              <div className="flex justify-start mt-4">
                <div className="bg-white text-[#111B21] rounded-2xl rounded-tl-sm px-4 py-2 max-w-[80%] shadow-sm">
                  <p className="text-[14px]">Can you split the dinner bill?</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-[#25D366] text-white rounded-2xl rounded-tr-sm p-4 w-[220px] shadow-md relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 opacity-10"><svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
                  <p className="text-[12px] text-white/80 font-semibold uppercase tracking-wider mb-1">Payment Sent</p>
                  <p className="text-[28px] font-bold text-white mb-2">45.00 <span className="text-[16px]">USDC</span></p>
                  <button className="w-full bg-white text-[#25D366] rounded-xl py-2 text-[12px] font-bold mt-2 shadow-sm">View on Explorer</button>
                </div>
              </div>
              
              {/* Input */}
              <div className="absolute bottom-4 left-4 right-4 bg-white rounded-full h-11 flex items-center px-4 gap-3 shadow-md border border-black/[0.05]">
                <div className="w-7 h-7 rounded-full bg-[#25D366] flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div>
                <div className="flex-1 text-[14px] text-[#8E8E93]">Message</div>
              </div>
            </div>
          </CSSIPhone>
        </motion.div>

        {/* Phone 3: Communities & Voice Calls */}
        <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}>
          <CSSIPhone title="Communities & Voice Calls" subtitle="Crystal-clear voice and video calls, completely free and secure.">
            {/* Call Screen UI */}
            <div className="flex-1 bg-black flex flex-col relative overflow-hidden text-white">
              <div className="absolute top-0 inset-x-0 h-[120px] bg-gradient-to-b from-black/80 to-transparent z-10"></div>
              
              {/* Background Video/Image Mockup */}
              <div className="absolute inset-0 bg-[#1C1C1E] flex flex-col items-center pt-24">
                <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 mb-6 flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.4)]">
                   <span className="text-[40px] font-bold text-white">RC</span>
                </div>
                <h3 className="text-[28px] font-bold text-white">Rock Climbers</h3>
                <p className="text-[16px] text-white/60 mt-2">08:24</p>
              </div>

              {/* Top Bar */}
              <div className="absolute top-12 inset-x-4 flex justify-between z-20">
                <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                </div>
                <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                </div>
              </div>

              {/* Participants Indicator */}
              <div className="absolute top-48 inset-x-0 flex justify-center z-20">
                <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2">
                  <div className="flex -space-x-2">
                     <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-[#1C1C1E]"></div>
                     <div className="w-6 h-6 rounded-full bg-orange-500 border-2 border-[#1C1C1E]"></div>
                     <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-[#1C1C1E]"></div>
                  </div>
                  <span className="text-[13px] font-medium">+12 others</span>
                </div>
              </div>

              {/* Bottom Controls */}
              <div className="absolute bottom-10 inset-x-4 z-20">
                <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-4 flex justify-between items-center px-6">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z"/><rect x="3" y="6" width="12" height="12" rx="2" ry="2"/></svg>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2"><path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.79 19.79 0 01-3.07-8.63A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91"/></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CSSIPhone>
        </motion.div>

      </div>
    </section>
  );
};
