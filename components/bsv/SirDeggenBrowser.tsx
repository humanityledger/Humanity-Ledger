"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, ShieldCheck, Terminal as TerminalIcon, 
  ChevronLeft, ChevronRight, RotateCcw, 
  Search, ShieldAlert, Cpu, Database, Fingerprint
} from 'lucide-react';
import { useCWI } from '@/lib/bsv/CWIContext';

interface SirDeggenBrowserProps {
  initialUrl?: string;
}

export function SirDeggenBrowser({ initialUrl = 'aztek://hub' }: SirDeggenBrowserProps) {
  const { identity, getPublicKey, createAction, actions } = useCWI();
  const [url, setUrl] = useState(initialUrl);
  const [history, setHistory] = useState<string[]>([initialUrl]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showTerminal, setShowTerminal] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // SirDeggen Polyfill Script (Injection Version)
  const injectCWI = useCallback(() => {
    if (!iframeRef.current || !identity) return;
    const cwipublicKey = identity.getPublicKey();
    
    // Check if we are browsing our own domain to hide the header
    const isSameOrigin = url.includes(window.location.host);
    
    const script = `
      (function() {
        window.CWI = {
          getPublicKey: async () => "${cwipublicKey}",
          createAction: async (params) => {
            window.parent.postMessage({ type: 'CWI_ACTION', params }, '*');
            return { txid: 'authorized_via_ledger_terminal' };
          },
          encrypt: async (p) => "encrypted_placeholder",
          decrypt: async (p) => "decrypted_placeholder",
          version: "1.42.0-SirDeggen"
        };
        
        if (${isSameOrigin}) {
          const style = document.createElement('style');
          style.innerHTML = 'header, footer, .no-browser-chrome { display: none !important; }';
          document.head.appendChild(style);
        }
        
        console.log('Ledger Terminal: CWI Substrate Injected.');
      })();
    `;
    
    try {
      // For same-origin, we can use direct access if needed, but postMessage is safer
      iframeRef.current.contentWindow?.postMessage({ type: 'INJECT_CWI', script }, '*');
      
      // Also try direct injection if same-origin (fallback for environments that block postMessage scripts)
      if (isSameOrigin) {
        const doc = iframeRef.current.contentDocument;
        if (doc) {
          const s = doc.createElement('script');
          s.textContent = script;
          doc.head.appendChild(s);
        }
      }
    } catch (e) {
      console.error('CWI: Injection failed', e);
    }
  }, [identity, url]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'CWI_ACTION') {
        createAction(event.data.params);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [createAction]);

  const navigate = (newUrl: string) => {
    setUrl(newUrl);
    setHistory(prev => [...prev.slice(0, historyIndex + 1), newUrl]);
    setHistoryIndex(prev => prev + 1);
  };

  return (
    <div className="flex flex-col h-full w-full bg-black/20 rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl backdrop-blur-3xl relative">
      
      {/*  BROWSER CHROME  */}
      <div className="flex items-center gap-4 px-6 py-4 bg-black/40 border-b border-white/5">
        <div className="flex items-center gap-3 text-white/30">
          <ChevronLeft 
            size={18} 
            className={`hover:text-white cursor-pointer ${historyIndex === 0 ? 'opacity-20 pointer-events-none' : ''}`} 
            onClick={() => setHistoryIndex(prev => Math.max(0, prev - 1))}
          />
          <ChevronRight 
            size={18} 
            className={`hover:text-white cursor-pointer ${historyIndex === history.length - 1 ? 'opacity-20 pointer-events-none' : ''}`}
            onClick={() => setHistoryIndex(prev => Math.min(history.length - 1, prev + 1))}
          />
          <RotateCcw size={18} className="hover:text-white cursor-pointer" onClick={() => setUrl(url)} />
        </div>

        <div className="flex items-center gap-3 px-6 py-2.5 flex-1 bg-black/40 rounded-full border border-white/10 focus-within:border-[var(--aztec-orchid)]/50 transition-all">
          <Globe size={14} className="text-[var(--aztec-chartreuse)]" />
          <input 
            type="text" 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(url)}
            className="bg-transparent border-none outline-none text-[10px] text-white/70 w-full font-aztec-mono uppercase tracking-[0.2em]"
          />
          <ShieldCheck size={14} className="text-[var(--aztec-chartreuse)]" />
        </div>

        <button 
          onClick={() => setShowTerminal(!showTerminal)}
          className={`p-3 rounded-2xl transition-all ${showTerminal ? 'bg-[var(--aztec-orchid)]/20 text-[var(--aztec-orchid)]' : 'text-white/30 hover:bg-white/5'}`}
        >
          <TerminalIcon size={18} />
        </button>
      </div>

      {/*  VIEWPORT  */}
      <div className="flex-1 relative bg-white">
        {url === 'aztek://hub' ? (
          <div className="p-12 h-screen overflow-y-auto bg-white">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-12">
               <h2 className="text-4xl font-aztec-serif font-black text-white uppercase tracking-tighter">SirDeggen <span className="text-[var(--aztec-orchid)]">Hub</span></h2>
               <div className="grid grid-cols-2 gap-8">
                  {[
                    { name: 'Showcase', desc: 'BSV-Browser Demo Apps', icon: Globe, href: 'https://mobile.bsvb.tech/' },
                    { name: 'Identity', desc: 'm/0\'/0\' Substrate State', icon: Fingerprint, href: 'aztek://identity' }
                  ].map((item, i) => (
                    <div key={i} onClick={() => navigate(item.href)} className="p-8 bg-white/5 border border-white/10 rounded-[2rem] hover:border-[var(--aztec-orchid)]/30 cursor-pointer transition-all group">
                      <item.icon className="text-[var(--aztec-orchid)] mb-4" size={32} />
                      <h3 className="text-sm font-black text-white uppercase tracking-widest mb-2">{item.name}</h3>
                      <p className="text-[10px] text-white/40 font-aztec-mono">{item.desc}</p>
                    </div>
                  ))}
               </div>
            </motion.div>
          </div>
        ) : (
          <iframe 
            ref={iframeRef}
            src={url.startsWith('http') ? url : `https://www.google.com/search?q=${encodeURIComponent(url)}`}
            className="w-full h-full border-none bg-black no-browser-chrome"
            onLoad={injectCWI}
          />
        )}

        {/*  TERMINAL OVERLAY  */}
        <AnimatePresence>
          {showTerminal && (
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="absolute inset-x-0 bottom-0 h-1/3 bg-black/95 border-t border-white/10 backdrop-blur-3xl z-50 flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-white/5">
                <span className="text-[9px] font-black text-[var(--aztec-orchid)] uppercase tracking-[0.4em]">CWI Substrate Log</span>
                <button onClick={() => setShowTerminal(false)} className="text-white/40 hover:text-white"><ShieldAlert size={14} /></button>
              </div>
              <div className="flex-1 p-6 font-aztec-mono text-[9px] text-white/60 overflow-y-auto space-y-2">
                {actions.length === 0 ? (
                  <div className="opacity-20 italic">No actions recorded in this session...</div>
                ) : (
                  actions.map((act, i) => (
                    <div key={act.id} className="flex gap-4 border-l-2 border-[var(--aztec-orchid)]/30 pl-4 py-1">
                      <span className="text-[var(--aztec-orchid)]">[{act.timestamp.slice(11, 19)}]</span>
                      <span className="text-white/80">{act.status.toUpperCase()}</span>
                      <span className="truncate opacity-50">{JSON.stringify(act.params)}</span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}

// End of SirDeggenBrowser component
