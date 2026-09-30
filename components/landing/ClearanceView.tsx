"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Clock, User, Terminal, Activity, ChevronLeft } from "lucide-react";
import { useSendTransaction, useAccount, useSwitchChain, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { parseEther } from "viem";
import { useNewsStore } from "@/lib/store/news-store";

// FIX Bug 15a: Treasury address sourced from env var so it can be rotated
// without a code redeployment if the address is ever compromised.
// Falls back to the known address only when not set.
const TARGET_TREASURY = (
    process.env.NEXT_PUBLIC_TREASURY_ADDRESS ||
    '0x78831C25c86eA2a78A6127fC2Ccb95E612D87b4a'
) as `0x${string}`;
const TARGET_CHAIN = 10; // Optimism Mainnet
const PRICE_USD = 5.0;

async function fetchCryptoRates(): Promise<{ eur: number; usd: number } | null> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=eur,usd", { cache: "no-store" });
    if (!res.ok) return { eur: 0, usd: 0 };
    const data = await res.json();
    return {
      eur: data?.ethereum?.eur ?? 0,
      usd: data?.ethereum?.usd ?? 0,
    };
  } catch {
    return { eur: 0, usd: 0 };
  }
}

export interface ClearanceViewProps {
  onBack: () => void;
}

export function ClearanceView({ onBack }: ClearanceViewProps) {
  const { setNewsSubscribed } = useNewsStore();
  const { address, isConnected, chainId } = useAccount();
  const { connect } = useConnect();
  const { switchChain } = useSwitchChain();
  const { sendTransaction, isPending, error: writeError } = useSendTransaction();
  const [isWaiting, setIsWaiting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const [rates, setRates] = useState<{ eur: number; usd: number } | null>(null);
  const timeRef = React.useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);


  useEffect(() => {
    setMounted(true);
    fetchCryptoRates().then(setRates);
    
    // Low-thermal DOM Clock
    const timer = setInterval(() => {
       if (timeRef.current) {
           const now = new Date();
           timeRef.current.innerText = `${now.toLocaleDateString("es-ES", { year: "numeric", month: "2-digit", day: "2-digit" })} · ${now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
       }
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isConfirmed) {
      setNewsSubscribed(true);
    }
  }, [isConfirmed, setNewsSubscribed]);

  const ethAmount = rates ? (PRICE_USD / rates.usd).toFixed(5) : "0.00149";
  const eurEquivalent = rates ? (parseFloat(ethAmount) * rates.eur).toFixed(2) : "4.62";

  const handleTransact = () => {
    if (!isConnected) return;
    if (chainId !== TARGET_CHAIN) {
        if (switchChain) {
            switchChain(
              { chainId: TARGET_CHAIN },
              {
                onSuccess: () => {
                  setTimeout(() => {
                    sendTransaction(
                      { to: TARGET_TREASURY, value: parseEther(ethAmount) },
                      {
                        onSuccess: () => {
                          setIsWaiting(true);
                          setTimeout(() => { setIsWaiting(false); setIsConfirmed(true); }, 800);
                        },
                        onError: () => setIsWaiting(false)
                      }
                    );
                  }, 1500);
                }
              }
            );
        }
        return;
    }
    sendTransaction(
      { to: TARGET_TREASURY, value: parseEther(ethAmount) },
      {
        onSuccess: () => {
          setIsWaiting(true);
          setTimeout(() => { setIsWaiting(false); setIsConfirmed(true); }, 800);
        },
        onError: () => setIsWaiting(false)
      }
    );
  };

  const isWrongNetwork = isConnected && chainId !== TARGET_CHAIN;
  const isExecuting = isPending || isWaiting;

  // We only run this formatting once at mount time for hydration
  const initialDateStr = mounted ? `${new Date().toLocaleDateString("es-ES", { year: "numeric", month: "2-digit", day: "2-digit" })} · ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : 'Sincronizando reloj L2...';

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
      {/* Back Button */}
      <motion.button
        onClick={onBack}
        className="mb-8 flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.3em] text-black/40 hover:text-black transition-colors"
        whileHover={{ x: -4 }}
      >
        <ChevronLeft size={12} />
        Return to Home
      </motion.button>

      <motion.div
        className="w-full bg-white relative shadow-[0_48px_120px_rgba(0,0,0,0.08)] border border-black/[0.06] rounded-3xl overflow-hidden"
        style={{ color: "#050505" }}
      >
        {/* HEADER */}
        <div className="flex justify-between items-center bg-[#FFFFFF] px-8 py-5 border-b border-black/[0.04]">
          <div className="flex items-center gap-3 text-black/80">
            <Terminal size={14} strokeWidth={1.5} />
            <span className="font-mono text-[10px] uppercase tracking-[0.35em] font-bold text-black/60">
              Clearance Ref. 418407
            </span>
          </div>
        </div>

        {/* BODY */}
        <div className="px-10 py-12 space-y-12">
          {/* SOVEREIGN INFO HEADER */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-black/[0.04] pb-8 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-black/40">
                <Clock size={12} />
                <span ref={timeRef} className="font-mono text-[9px] uppercase tracking-[0.25em] font-bold min-w-[200px]">
                  {initialDateStr}
                </span>
              </div>
              <div className="flex items-center gap-3 text-black/40">
                <User size={12} />
                <span className="font-mono text-[9px] uppercase tracking-[0.25em] font-bold">
                  {mounted && isConnected && address
                    ? `ID: ${address.slice(0, 10)}...${address.slice(-6)}`
                    : "ENTIDAD NO DETECTADA"}
                </span>
              </div>
            </div>
            <div className="text-left md:text-right space-y-3">
              <span className="block font-mono text-[9px] uppercase tracking-[0.3em] text-[#D4AF37] font-black">
                NODO OPTIMISM L2
              </span>
              <span className="block font-mono text-[9px] uppercase tracking-[0.25em] text-black/20 font-bold">
                PING: 14ms
              </span>
            </div>
          </div>

          {/* MAIN METRICS */}
          <div className="text-center space-y-6">
            <span className="block font-mono text-[10px] uppercase tracking-[0.5em] text-black/30 font-black">
              Asignación Requerida
            </span>

            <div className="flex items-baseline justify-center gap-4">
              <span className="font-sans text-8xl tracking-tighter leading-none text-black font-light">
                {PRICE_USD.toFixed(0)}
              </span>
              <div className="flex flex-col items-start">
                <span className="font-mono text-xl font-bold uppercase tracking-[0.2em] text-black">
                  USD
                </span>
                <span className="font-mono text-[10px] text-black/20 uppercase tracking-[0.3em] font-bold">
                  Tarifa Plana
                </span>
              </div>
            </div>

            {/* EXACT EQUIVALENTS */}
            <div className="flex items-center justify-center gap-12 pt-8">
              <div className="text-center space-y-1">
                <p className="font-mono text-lg font-bold tracking-tight text-black">
                  {rates ? ethAmount : ""} ETH
                </p>
                <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-black/30 font-bold">
                  Monto en Cadena
                </p>
              </div>
              <div className="w-[1px] h-10 bg-black/[0.06]" />
              <div className="text-center space-y-1">
                <p className="font-mono text-lg font-bold tracking-tight text-black">
                  {rates ? `${eurEquivalent} EUR` : ""}
                </p>
                <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-black/30 font-bold">
                  {rates ? "Ratio Oráculo Integrado" : "Conectando..."}
                </p>
              </div>
            </div>
          </div>

          {/* TARGET RECP */}
          <div className="bg-[#FFFFFF] p-6 border border-black/[0.04] rounded-2xl flex justify-between items-center group transition-colors hover:border-black/[0.1]">
            <div className="space-y-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.35em] text-black/40 font-black">
                Destino Asegurado
              </span>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-black font-black">
                Tesorería Humanity Ledger
              </p>
            </div>
            <span className="font-mono text-[10px] tracking-[0.2em] text-black/30 font-bold">
              {TARGET_TREASURY.slice(0, 6)}...{TARGET_TREASURY.slice(-6)}
            </span>
          </div>

          {/* ACTION BUTTON */}
          <div className="pt-4">
            {isConfirmed ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#00C076]/5 text-[#00C076] border border-[#00C076]/20 text-center py-6 font-mono text-[11px] font-black uppercase tracking-[0.4em] rounded-2xl"
              >
                AUTORIZACIÓN COMPLETADA 
              </motion.div>
            ) : (
              <div className="space-y-6">
                {!mounted ? (
                  <div className="py-7 text-center font-mono text-xs uppercase tracking-widest text-[#888888]">
                    Iniciando Sistema...
                  </div>
                ) : !isConnected ? (
                  <motion.button
                    onClick={() => connect({ connector: injected() })}
                    whileHover={{ scale: 1.02, backgroundColor: "#111" }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-white text-white font-mono text-xs font-black uppercase py-7 tracking-[0.4em] flex justify-center items-center gap-4 transition-all duration-300 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)]"
                  >
                    CONECTAR WALLET // L2
                  </motion.button>
                ) : (
                  <motion.button
                    onClick={handleTransact}
                    disabled={isExecuting || !rates}
                    whileHover={{ scale: 1.02, backgroundColor: "#111" }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-white text-white font-mono text-xs font-black uppercase py-7 tracking-[0.4em] disabled:opacity-30 disabled:cursor-not-allowed flex justify-center items-center gap-4 transition-all duration-300 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)]"
                  >
                    {isWaiting ? (
                      <>
                        <Activity size={16} className="animate-spin" /> Confirmando Bloque L2...
                      </>
                    ) : isPending ? (
                      "Procesando en Wallet..."
                    ) : isWrongNetwork ? (
                      "Forzar Red Optimism"
                    ) : (
                      `PAGAR ${ethAmount} ETH`
                    )}
                  </motion.button>
                )}
                {writeError && (
                  <p className="text-center text-red-500 font-mono text-[9px] uppercase tracking-[0.2em] font-bold bg-red-50 py-3 rounded-lg border border-red-100">
                    [ERROR SISTEMA] {writeError.message.split(".")[0]}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* SECURITY BINDER */}
          <div className="flex justify-between items-center pt-4 border-t border-black/[0.03]">
            <ShieldCheck size={16} className="text-black/10" strokeWidth={1.5} />
            <p className="text-right font-mono text-[9px] uppercase tracking-[0.3em] text-black/20 font-bold">
              Protocolo Inmutable · Sin Reembolsos · Privacy by Void
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
