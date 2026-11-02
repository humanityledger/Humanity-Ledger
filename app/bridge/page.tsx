'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader, Smartphone } from 'lucide-react';

type Stage = 'loading' | 'success' | 'error' | 'already_linked';

export default function BridgePage() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');
  const [stage, setStage] = useState<Stage>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStage('error');
      setMessage('No bridge token found in URL. Please generate a new QR from your PC.');
      return;
    }

    const consumeToken = async () => {
      try {
        let walletParam = '';
        try {
            const raw = localStorage.getItem('system_session_v2');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.wallet) walletParam = `&wallet=${parsed.wallet}`;
            }
            if (!walletParam) {
                const sess = sessionStorage.getItem('system_wallet_addr');
                if (sess) walletParam = `&wallet=${sess}`;
            }
        } catch {}

        const res = await fetch(`/api/bridge/generate?token=${encodeURIComponent(token)}${walletParam}`);
        const data = await res.json();

        if (data.valid) {
          setStage('success');
          setMessage(data.message ?? 'Bridge established! Your PC session is now linked.');
        } else if (res.status === 404) {
          setStage('error');
          setMessage('Token not found or already used. Please scan a fresh QR code.');
        } else if (res.status === 503) {
          setStage('error');
          setMessage('Bridge temporarily unavailable. Please try again in a moment.');
        } else {
          setStage('error');
          setMessage(data.error ?? 'Unexpected error. Please try again.');
        }
      } catch {
        setStage('error');
        setMessage('Network error. Check your connection and try again.');
      }
    };

    consumeToken();
  }, [token]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #060606 0%, #0d0d0d 100%)' }}
    >
      {/* Logo */}
      <div className="mb-12 flex flex-col items-center gap-3">
        <img
          src="/logo-mark.png"
          alt="Humanity Ledger"
          className="w-10 h-10 brightness-0 invert opacity-60"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/20">
          Humanity Ledger
        </span>
      </div>

      <motion.div
        key={stage}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm flex flex-col items-center gap-8 text-center"
      >
        {/* Icon */}
        <div className={`w-24 h-24 rounded-full flex items-center justify-center border ${
          stage === 'loading' ? 'border-white/10 bg-white/5' :
          stage === 'success' ? 'border-emerald-500/30 bg-emerald-500/10' :
          'border-red-500/30 bg-red-500/10'
        }`}>
          {stage === 'loading' && <Loader size={36} className="text-white/30 animate-spin" />}
          {stage === 'success' && (
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
              <CheckCircle size={40} className="text-emerald-400" />
            </motion.div>
          )}
          {stage === 'error' && <XCircle size={40} className="text-red-400" />}
        </div>

        {/* Title */}
        <div className="space-y-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.4em] text-white/20">
            <Smartphone size={10} className="inline mr-1" />
            Device Bridge
          </p>
          <h1 className="text-3xl font-black text-white tracking-tighter">
            {stage === 'loading' && 'Linking Session'}
            {stage === 'success' && 'Session Linked!'}
            {stage === 'error' && 'Link Failed'}
          </h1>
          <p className="text-white/40 text-[13px] leading-relaxed font-mono">
            {stage === 'loading' && 'Validating your bridge token with the server'}
            {(stage === 'success' || stage === 'error') && message}
          </p>
        </div>

        {/* CTA for success  open full app */}
        {stage === 'success' && (
          <motion.a
            href="/"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="w-full py-4 rounded-2xl bg-white text-black font-black text-[13px] uppercase tracking-widest text-center active:scale-95 transition-transform"
          >
            Open Dashboard 
          </motion.a>
        )}

        {/* Retry for error */}
        {stage === 'error' && (
          <a
            href="/terminal"
            className="font-mono text-[11px] uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors"
          >
             Back to Dashboard
          </a>
        )}
      </motion.div>
    </div>
  );
}
