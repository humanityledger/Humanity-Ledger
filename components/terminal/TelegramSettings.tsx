"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Send, Bell, BellOff, CheckCircle2, AlertCircle, Trash2, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// 
// TelegramSettings
// Fully functional: GET config  POST connect (sends real test msg)  DELETE
// Uses /api/telegram/connect  no mocked data, no faked states
// 

interface TelegramConfig {
  configured: boolean;
  chatId: string | null;
  minApy: number;
  evSignals: boolean;
}

export default function TelegramSettings({ wallet }: { wallet: string }) {
  const [config, setConfig]       = useState<TelegramConfig | null>(null);
  const [chatId, setChatId]       = useState('');
  const [minApy, setMinApy]       = useState(20);
  const [evSignals, setEvSignals] = useState(true);
  const [loading, setLoading]     = useState(false);
  const [fetching, setFetching]   = useState(true);
  const [confirmDel, setConfirmDel] = useState(false);

  const fetchConfig = useCallback(async () => {
    if (!wallet) return;
    setFetching(true);
    try {
      const r = await fetch(`/api/telegram/connect?wallet=${wallet}`);
      const d = await r.json();
      setConfig(d);
      if (d.configured) {
        setMinApy(d.minApy ?? 20);
        setEvSignals(d.evSignals ?? true);
      }
    } catch {
      setConfig({ configured: false, chatId: null, minApy: 20, evSignals: true });
    } finally {
      setFetching(false);
    }
  }, [wallet]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  //  Connect / Update 
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatId.trim() && !config?.configured) {
      toast.error('Enter your Telegram Chat ID first');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch('/api/telegram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          chatId: config?.configured ? config.chatId : chatId.trim(),
          minApy,
          evSignals
        }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      toast.success(' Telegram alerts activated  check your chat for a test message');
      setChatId('');
      await fetchConfig();
    } catch (err: any) {
      toast.error(err.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  //  Disconnect 
  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await fetch('/api/telegram/connect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet }),
      });
      toast.success('Telegram alerts deactivated');
      setConfirmDel(false);
      setConfig({ configured: false, chatId: null, minApy: 20, evSignals: true });
    } catch {
      toast.error('Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-10 gap-3 text-[#888888]">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-[10px] font-mono uppercase tracking-widest">Loading config</span>
      </div>
    );
  }

  const isActive = config?.configured;

  return (
    <div className="space-y-6">
      {/*  Status Banner  */}
      <div className={`flex items-center justify-between px-5 py-4 rounded-2xl border ${
        isActive
          ? 'bg-[#00C076]/5 border-[#00C076]/25'
          : 'bg-[#FFFFFF] border-[#E5E5E5]'
      }`}>
        <div className="flex items-center gap-3">
          {isActive
            ? <Bell size={16} className="text-[#00C076]" />
            : <BellOff size={16} className="text-[#888888]" />
          }
          <div>
            <p className={`text-[11px] font-black uppercase tracking-widest ${isActive ? 'text-[#00C076]' : 'text-[#888888]'}`}>
              {isActive ? 'Telegram Alerts Active' : 'Telegram Not Connected'}
            </p>
            {isActive && config?.chatId && (
              <p className="text-[9px] font-mono text-[#888888] mt-0.5">Chat: {config.chatId}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isActive && (
            <button
              onClick={() => setConfirmDel(true)}
              className="p-2 rounded-lg text-[#888888] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-all"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={fetchConfig}
            className="p-2 rounded-lg text-[#888888] hover:text-[#050505] hover:bg-black/5 transition-all"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/*  Delete Confirmation  */}
      <AnimatePresence>
        {confirmDel && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-[#FF3B30]/5 border border-[#FF3B30]/20 rounded-2xl p-5 space-y-3"
          >
            <p className="text-[11px] font-black text-[#FF3B30] uppercase tracking-widest flex items-center gap-2">
              <AlertCircle size={13} /> Confirm deactivation
            </p>
            <p className="text-[10px] text-[#888888] font-mono">
              This will remove your Telegram Chat ID from the system. You won't receive any more Humanity Ledgers until you reconnect.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDel(false)}
                className="flex-1 py-2 text-[9px] font-black uppercase tracking-widest border border-[#E5E5E5] rounded-xl text-[#888888] hover:border-[#050505] hover:text-[#050505] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="flex-1 py-2 text-[9px] font-black uppercase tracking-widest bg-[#FF3B30] text-white rounded-xl hover:bg-[#D32F2F] transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Removing' : 'Yes, Disconnect'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/*  Setup Guide (only when not configured)  */}
      {!isActive && (
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#888888] mb-3">
            Setup Guide  3 Steps
          </p>
          <ol className="space-y-3">
            {[
              { n: '01', text: 'Open Telegram and search for ', link: '@BotFather', href: 'https://t.me/BotFather' },
              { n: '02', text: 'Start a chat with the Humanity Ledger bot (ask the team for the bot username)' },
              { n: '03', text: 'Open ', link: '@userinfobot', href: 'https://t.me/userinfobot', suffix: ' to get your numeric Chat ID' },
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="text-[9px] font-black font-mono text-[#888888] mt-0.5 shrink-0 w-5">{step.n}</span>
                <p className="text-[10px] text-[#888888] font-mono leading-relaxed">
                  {step.text}
                  {step.link && (
                    <a
                      href={step.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#0088cc] hover:underline inline-flex items-center gap-0.5"
                    >
                      {step.link} <ExternalLink size={9} />
                    </a>
                  )}
                  {step.suffix ?? ''}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/*  Main Form  */}
      <form onSubmit={handleConnect} className="space-y-4">
        {/* Chat ID input (only when not yet configured) */}
        {!isActive && (
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-[#888888] mb-2">
              Your Telegram Chat ID
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 123456789"
              value={chatId}
              onChange={e => setChatId(e.target.value.replace(/[^\d-]/g, ''))}
              className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] bg-white text-[12px] font-mono text-[#050505] placeholder-[#CCCCCC] focus:outline-none focus:border-[#050505] transition-colors"
              required={!isActive}
            />
            <p className="text-[9px] font-mono text-[#CCCCCC] mt-1.5">
              Numeric ID from @userinfobot · Can be negative for groups
            </p>
          </div>
        )}

        {/* Alert filters */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-[#888888] mb-2">
              Min APY Threshold
            </label>
            <select
              value={minApy}
              onChange={e => setMinApy(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] bg-white text-[11px] font-black text-[#050505] focus:outline-none focus:border-[#050505] transition-colors cursor-pointer"
            >
              {[5, 10, 20, 50, 100, 200].map(v => (
                <option key={v} value={v}>{v}% and above</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-[#888888] mb-2">
              EV Signals
            </label>
            <button
              type="button"
              onClick={() => setEvSignals(v => !v)}
              className={`w-full py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                evSignals
                  ? 'bg-white border-[#050505] text-white'
                  : 'bg-white border-[#E5E5E5] text-[#888888] hover:border-[#050505]'
              }`}
            >
              {evSignals ? ' Enabled' : 'Disabled'}
            </button>
          </div>
        </div>

        {/* What you'll receive */}
        <div className="bg-[#FFFFFF] border border-[#F0F0F0] rounded-xl px-4 py-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#888888] mb-2">You'll Receive Alerts For</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              'Ledger movements > $1M',
              'Price threshold breaks',
              evSignals ? 'EV Polymarket signals' : null,
              minApy <= 50 ? `DeFi APY  ${minApy}%` : null,
              'Liquidation warnings',
              'Daily digest at 08:00 UTC',
            ].filter(Boolean).map((item, i) => (
              <p key={i} className="text-[9px] font-mono text-[#888888]">{item}</p>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || (!chatId.trim() && !isActive)}
          className="w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.25em] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{
            background: isActive ? '#050505' : '#050505',
            color: '#fff',
          }}
        >
          {loading
            ? <><Loader2 size={14} className="animate-spin" /> Processing</>
            : isActive
            ? <><CheckCircle2 size={14} /> Save Changes & Send Test</>
            : <><Send size={14} /> Activate Telegram Alerts</>
          }
        </button>
      </form>
    </div>
  );
}
