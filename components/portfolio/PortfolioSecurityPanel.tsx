import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Eye, EyeOff, Copy, AlertTriangle, ShieldCheck, Lock } from 'lucide-react';
import { tryDecryptAny } from '@/lib/wallet-security';
import { toast } from 'sonner';

export function PortfolioSecurityPanel() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [decryptedMnemonic, setDecryptedMnemonic] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('system_accounts');
      if (stored) {
        const parsed = JSON.parse(stored);
        setAccounts(parsed);
        if (parsed.length > 0) setSelectedAccountId(parsed[0].id);
      }
    } catch {}
  }, []);

  const handleReveal = async () => {
    if (!password) {
      toast.error("Ingresa tu contraseña");
      return;
    }
    
    const account = accounts.find(a => a.id === selectedAccountId);
    if (!account) return;

    setIsLoading(true);
    setDecryptedMnemonic(null);
    setShowMnemonic(false);

    // Yield to render loader
    await new Promise(r => setTimeout(r, 50));

    try {
      const { plaintext, wasLegacy } = await tryDecryptAny(account.encryptedBlob, password);
      
      let mnemonicStr = plaintext;
      if (wasLegacy) {
        // If it was legacy, plaintext is actually private key, try to import ethers to get mnemonic if possible
        // But since this is just backup, we can show the private key if mnemonic is not available.
        const { ethers } = await import('ethers');
        const w = new ethers.Wallet(plaintext);
        mnemonicStr = (w as any).mnemonic?.phrase || plaintext;
      }

      setDecryptedMnemonic(mnemonicStr);
      toast.success("Wallet desencriptado correctamente");
      setPassword('');
    } catch (err: any) {
      toast.error("Contraseña incorrecta", { description: "Por favor, intenta de nuevo." });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (decryptedMnemonic) {
      navigator.clipboard.writeText(decryptedMnemonic);
      toast.success("Copiado al portapapeles");
    }
  };

  if (accounts.length === 0) return null;

  return (
    <div className="w-full mt-10 rounded-3xl border border-black/5 bg-white/60 backdrop-blur-3xl overflow-hidden p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center">
          <ShieldCheck size={20} className="text-[#0A0A0A]" />
        </div>
        <div>
          <h2 className="font-black uppercase tracking-tight text-lg text-[#0A0A0A]">Centro de Seguridad y Respaldo</h2>
          <p className="text-sm font-medium text-black/50">Verifica y respalda tus frases mnemónicas para evitar pérdida de acceso.</p>
        </div>
      </div>

      <div className="bg-[#FFFFFF] border border-black/5 rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={16} className="text-amber-500" />
          <span className="text-xs font-black uppercase tracking-widest text-amber-600">Prevención de Pérdida</span>
        </div>
        <p className="text-sm font-medium text-black/60 leading-relaxed">
          Si borras el historial de tu navegador o cambias de dispositivo, necesitarás tu <strong>Frase Mnemónica</strong> para recuperar tus fondos. Asegúrate de respaldarla ahora mismo.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-black/40 mb-2 block">Cuenta a Respaldar</label>
            <select
              value={selectedAccountId || ''}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
                setDecryptedMnemonic(null);
                setPassword('');
              }}
              className="w-full bg-[#FFFFFF] border border-black/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-black/30"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.address ? `${acc.address.slice(0,6)}...${acc.address.slice(-4)}` : 'Vault'})
                </option>
              ))}
            </select>
          </div>

          {!decryptedMnemonic ? (
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-black/40 mb-2 block">Contraseña de Encriptación</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleReveal()}
                  placeholder="Ingresa tu contraseña"
                  className="flex-1 bg-[#FFFFFF] border border-black/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-black/30 placeholder:font-medium placeholder:text-black/30"
                />
                <button
                  onClick={handleReveal}
                  disabled={isLoading || !password}
                  className="px-6 py-3 bg-[#0A0A0A] hover:bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl disabled:opacity-50 transition-all active:scale-[0.98] shadow-md flex items-center gap-2"
                >
                  {isLoading ? <span className="animate-pulse">Desencriptando...</span> : <><Lock size={14} /> Desbloquear</>}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button
                onClick={() => {
                  setDecryptedMnemonic(null);
                  setPassword('');
                  setShowMnemonic(false);
                }}
                className="px-5 py-3 bg-black/5 hover:bg-black/10 text-[#0A0A0A] text-xs font-black uppercase tracking-widest rounded-xl transition-all"
              >
                Ocultar y Bloquear
              </button>
            </div>
          )}
        </div>

        <div>
          {decryptedMnemonic ? (
            <div className="relative border border-black/10 rounded-2xl p-6 bg-[#FFFFFF] h-full flex flex-col items-center justify-center overflow-hidden min-h-[180px]">
              {!showMnemonic ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
                  <div className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center mb-3">
                    <EyeOff size={20} className="text-[#050505]" />
                  </div>
                  <p className="text-xs text-[#050505] font-black uppercase tracking-widest mb-1">Frase Protegida</p>
                  <p className="text-[11px] text-[#050505]/50 font-medium mb-4 text-center px-4">Asegúrate de que nadie esté mirando tu pantalla.</p>
                  <button 
                    onClick={() => setShowMnemonic(true)}
                    className="px-6 py-3 rounded-xl bg-white text-white transition-all font-black text-[11px] uppercase tracking-widest active:scale-[0.96] shadow-md"
                  >
                    Mostrar Frase
                  </button>
                </div>
              ) : null}

              <div className={`w-full transition-all duration-500 ${showMnemonic ? 'opacity-100 blur-none' : 'opacity-0 blur-md select-none pointer-events-none'}`}>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
                  {decryptedMnemonic.split(' ').map((word, i) => (
                    <div key={i} className="flex flex-col bg-white border border-black/5 rounded-lg overflow-hidden shadow-sm">
                      <div className="w-full py-0.5 bg-black/[0.03] text-[9px] text-black/40 font-black tracking-widest text-center border-b border-black/5">
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div className="flex-1 py-1.5 text-xs text-black font-bold tracking-wide text-center">
                        {word}
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={copyToClipboard}
                  className="w-full py-3 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest bg-black/5 hover:bg-black/10 text-black rounded-xl transition-all"
                >
                  <Copy size={14} /> Copiar al portapapeles
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[180px] border border-black/5 border-dashed rounded-2xl flex flex-col items-center justify-center text-black/20 bg-black/[0.01]">
               <Key size={32} className="mb-3 opacity-50" />
               <p className="text-xs font-black uppercase tracking-widest">Desbloquea para ver tu frase</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
