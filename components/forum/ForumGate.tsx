'use client';

import React, { useEffect, useState } from 'react';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { useAppKit } from '@reown/appkit/react';
import { AlertTriangle } from 'lucide-react';

export function ForumGate({ children }: { children: React.ReactNode }) {
  const { isLocalSystemWallet, isConnected, address, isChecking } = useSystemAccount();
  const { open } = useAppKit();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isChecking) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-black/10 border-t-black/60 rounded-full animate-spin" />
          <p className="text-[11px] font-mono uppercase tracking-widest text-black/40">Verificando sesión…</p>
        </div>
      </div>
    );
  }

  if (isLocalSystemWallet) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white/95 backdrop-blur-xl">
        <div className="text-center space-y-4 max-w-sm px-6">
          <AlertTriangle size={40} className="text-rose-500 mx-auto" />
          <h2 className="text-2xl font-black uppercase tracking-tighter text-[#050505]">Acceso Denegado</h2>
          <p className="text-[14px] text-black/50 font-medium">Con HumanityLedger por el momento aún no es posible ya que requiere de una firma. Debes ingresar únicamente y precisamente con WalletConnect.</p>
          <button
            onClick={() => open()}
            className="mt-4 w-full py-4 rounded-[18px] bg-white text-white font-black tracking-widest text-[12px] uppercase shadow-lg hover:bg-[#111] transition-all"
          >
            Conectar WalletConnect
          </button>
        </div>
      </div>
    );
  }

  if (!isConnected || !address) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white/95 backdrop-blur-xl">
        <div className="text-center space-y-4">
          <AlertTriangle size={40} className="text-amber-500 mx-auto" />
          <h2 className="text-2xl font-black uppercase tracking-tighter text-[#050505]">No Wallet Connected</h2>
          <p className="text-[14px] text-black/50 font-medium">Por favor, Connect con WalletConnect para acceder al Foro.</p>
          <button
            onClick={() => open()}
            className="mt-4 px-8 py-3.5 rounded-[18px] bg-white text-white font-black tracking-widest text-[12px] uppercase shadow-lg hover:bg-[#111] transition-all"
          >
            Conectar WalletConnect
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
