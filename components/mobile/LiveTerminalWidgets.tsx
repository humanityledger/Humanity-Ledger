"use client";

import React, { useEffect, useRef } from 'react';

/**
 * 10Hz Zero-Render High Frequency Mini-Widgets
 * Utiliza Canvas API y manipulación directa del DOM para evadir por completo 
 * el ciclo de renderizado de React (garantizando 60 FPS fijos).
 */
export function ActiveTerminalWidgets({ 
  type, 
  workerRef 
}: { 
  type: 'ORDER_BOOK' | 'LEDGER_FLOW' | 'MARKETS' | 'COPY_ATTESTING';
  workerRef: React.MutableRefObject<Worker | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!workerRef.current || !containerRef.current) return;

    const worker = workerRef.current;
    
    // Imperative UI Nodes (to avoid React re-renders)
    let ctx: CanvasRenderingContext2D | null = null;
    let ledgerContainer: HTMLDivElement | null = null;
    let marketsOiNode: HTMLSpanElement | null = null;
    let marketsFundNode: HTMLSpanElement | null = null;
    let copyAttestLogNode: HTMLDivElement | null = null;

    if (type === 'ORDER_BOOK' && canvasRef.current) {
        ctx = canvasRef.current.getContext('2d');
    }
    if (type === 'LEDGER_FLOW') {
        ledgerContainer = containerRef.current.querySelector('#ledger-flow-container');
    }
    if (type === 'MARKETS') {
        marketsOiNode = containerRef.current.querySelector('#markets-oi-value');
        marketsFundNode = containerRef.current.querySelector('#markets-fund-value');
    }
    if (type === 'COPY_ATTESTING') {
        copyAttestLogNode = containerRef.current.querySelector('#copy-attest-log');
    }

    // Handlers
    const handleMessage = (e: MessageEvent) => {
        const data = e.data;

        if (type === 'ORDER_BOOK' && data.type === 'DEPTH' && ctx && canvasRef.current) {
            // Draw Order Book (5 bids, 5 asks)
            const c = canvasRef.current;
            ctx.clearRect(0, 0, c.width, c.height);
            
            const rowHeight = c.height / 10;
            
            // Draw Asks (Rojo) top 5
            for (let i = 0; i < 5; i++) {
                const ask = data.asks[4 - i]; // Reverse to show lowest ask at bottom
                if (!ask) continue;
                const w = ask.relativeDepth * c.width;
                const y = i * rowHeight;
                
                // Fondo barra
                ctx.fillStyle = 'rgba(239, 68, 68, 0.15)'; 
                ctx.fillRect(c.width - w, y, w, rowHeight - 2);
                
                // Texto precio
                ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
                ctx.font = 'bold 9px monospace';
                ctx.textAlign = 'left';
                ctx.fillText(ask.p.toFixed(2), 2, y + 10);
            }

            // Draw Bids (Verde) bottom 5
            for (let i = 0; i < 5; i++) {
                const bid = data.bids[i]; // Highest bid at top
                if (!bid) continue;
                const w = bid.relativeDepth * c.width;
                const y = (i + 5) * rowHeight;

                // Fondo barra
                ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
                ctx.fillRect(0, y, w, rowHeight - 2);

                // Texto precio
                ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
                ctx.font = 'bold 9px monospace';
                ctx.textAlign = 'right';
                ctx.fillText(bid.p.toFixed(2), c.width - 2, y + 10);
            }
        }

        if (type === 'LEDGER_FLOW' && data.type === 'LEDGER_FLOW' && ledgerContainer) {
            const isBuy = data.side === 'BUY';
            const colorClass = isBuy ? 'text-green-500' : 'text-red-500';
            const bgClass = isBuy ? 'bg-green-500/10' : 'bg-red-500/10';
            const html = `
                <div class="flex items-center justify-between py-1.5 border-b border-[#050505]/5 text-[9px] font-mono animate-fade-in-down last:border-0">
                    <span class="font-black ${colorClass} ${bgClass} px-1.5 rounded-sm">${data.side}</span>
                    <span class="text-[#050505]/40">${data.price.toFixed(2)}</span>
                    <span class="font-bold text-[#050505]">$${(data.amountUsd / 1000).toFixed(1)}k</span>
                </div>
            `;
            ledgerContainer.insertAdjacentHTML('afterbegin', html);
            if (ledgerContainer.children.length > 5) {
                ledgerContainer.lastElementChild?.remove();
            }
        }

        if (type === 'MARKETS' && data.type === 'MARKETS' && marketsOiNode && marketsFundNode) {
            const prevOi = parseFloat(marketsOiNode.getAttribute('data-raw') || '0');
            const newOi = data.oi;
            const flashOi = newOi > prevOi ? 'text-green-500' : 'text-red-500';
            
            marketsOiNode.innerText = `$${(newOi / 1000000).toFixed(2)}M`;
            marketsOiNode.className = `font-mono font-black text-[11px] ${flashOi} transition-colors duration-300`;
            marketsOiNode.setAttribute('data-raw', newOi.toString());
            
            const fund = (data.funding * 100).toFixed(4) + '%';
            marketsFundNode.innerText = fund;
            marketsFundNode.setAttribute('data-raw', data.funding.toString());

            setTimeout(() => {
                if (marketsOiNode) marketsOiNode.className = "font-mono font-black text-[11px] text-[#050505] transition-colors duration-1000";
            }, 100);
        }

        if (type === 'COPY_ATTESTING' && data.type === 'COPY_ATTEST' && copyAttestLogNode) {
            const html = `
                <div class="flex flex-col gap-0.5 py-1.5 border-b border-[#050505]/5 animate-fade-in-down last:border-0">
                    <div class="flex items-center justify-between">
                        <span class="text-[8px] font-black uppercase tracking-widest text-[#050505]/40">[TARGET WALLET EXEC]</span>
                        <span class="text-[8px] font-bold text-cyan-500">${data.latency}ms lag</span>
                    </div>
                    <div class="flex items-center justify-between mt-0.5">
                        <span class="text-[9.5px] font-mono font-black text-[#050505]">${data.action}</span>
                        <span class="text-[9px] font-mono font-bold text-[#050505]/60 block">$${data.size}</span>
                    </div>
                </div>
            `;
            copyAttestLogNode.insertAdjacentHTML('afterbegin', html);
            if (copyAttestLogNode.children.length > 3) {
                copyAttestLogNode.lastElementChild?.remove();
            }
        }
    };

    worker.addEventListener('message', handleMessage);

    return () => {
        worker.removeEventListener('message', handleMessage);
    };
  }, [type, workerRef]);

  // Base Render Skeletons (Populated Imperatively)
  
  if (type === 'ORDER_BOOK') {
      return (
          <div ref={containerRef} className="w-full h-32 bg-white border border-[#050505]/5 rounded-xl overflow-hidden mt-3 shadow-inner relative">
              <div className="absolute top-1 left-2 text-[7px] font-black text-[#050505]/30 uppercase tracking-[0.2em] z-10">L2 Depth Feed</div>
              <canvas ref={canvasRef} width={320} height={128} className="w-full h-full block" />
          </div>
      );
  }

  if (type === 'LEDGER_FLOW') {
      return (
          <div ref={containerRef} className="w-full bg-white border border-[#050505]/5 rounded-xl p-3 mt-3 shadow-inner max-h-[96px] overflow-hidden relative">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#050505]/10 mb-1.5">
                  <span className="text-[7.5px] font-black tracking-widest uppercase text-[#050505]/40">Side</span>
                  <span className="text-[7.5px] font-black tracking-widest uppercase text-[#050505]/40">Price (USD)</span>
                  <span className="text-[7.5px] font-black tracking-widest uppercase text-[#050505]/40">Volume</span>
              </div>
              <div id="ledger-flow-container" className="flex flex-col">
                  {/* Imperative nodes injected here */}
                  <div className="text-[9px] text-center py-2 font-mono text-[#050505]/30 animate-pulse">Awaiting blocks &gt; $10k...</div>
              </div>
          </div>
      );
  }

  if (type === 'MARKETS') {
      return (
          <div ref={containerRef} className="w-full flex gap-3 mt-3">
              <div className="flex-1 bg-white border border-[#050505]/5 rounded-xl p-3 shadow-inner flex flex-col items-center justify-center">
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[#050505]/40 mb-1">Open Interest</span>
                  <span id="markets-oi-value" className="font-mono font-black text-[11px] text-[#050505]">Load...</span>
              </div>
              <div className="flex-1 bg-white border border-[#050505]/5 rounded-xl p-3 shadow-inner flex flex-col items-center justify-center">
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[#050505]/40 mb-1">Funding (8h)</span>
                  <span id="markets-fund-value" className="font-mono font-black text-[11px] text-[#050505]">Load...</span>
              </div>
          </div>
      );
  }

  if (type === 'COPY_ATTESTING') {
      return (
          <div ref={containerRef} className="w-full bg-white text-white rounded-xl p-3 mt-3 shadow-inner max-h-[96px] overflow-hidden border border-white/10 relative">
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-white/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-[8px] font-black tracking-widest uppercase text-white/50">Elite Intent Engine Active</span>
              </div>
              <div id="copy-attest-log" className="flex flex-col">
                  {/* Imperative nodes injected here */}
                  <div className="text-[8.5px] text-center py-2 font-mono text-cyan-400/40 animate-pulse">[ STANDBY ] Listening to target mempool</div>
              </div>
          </div>
      );
  }

  return null;
}
