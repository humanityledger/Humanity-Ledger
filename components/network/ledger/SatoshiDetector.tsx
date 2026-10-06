"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Snowflake, Eye, AlertTriangle } from 'lucide-react';

interface SatoshiData {
  address: string;
  btcBalance: number;
  yearsInactive: number;
  firstSeenDate: string;
  lastActiveDate: string;
  isSatoshiEra: boolean;
  isSleepingGiant: boolean;
  alertLevel: 'CRITICAL' | 'HIGH' | 'WATCH' | 'NORMAL';
  txCount: number;
}

interface Props {
  ledgerAddresses?: string[];
}

export function SatoshiDetector({ ledgerAddresses = [] }: Props) {
  const [alerts, setAlerts] = useState<SatoshiData[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const [showBlast, setShowBlast] = useState(false);
  const [criticalAlert, setCriticalAlert] = useState<SatoshiData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBatchData = async () => {
    setIsScanning(true);
    setError(null);
    try {
      // Load known historical wallets in batch mode (no addresses needed)
      const batchRes = await fetch('/api/network/ledger/satoshi-detector?mode=batch');
      if (batchRes.ok) {
        const batchData = await batchRes.json();
        const results: SatoshiData[] = batchData.results || [];
        
        // Also scan provided ledger addresses
        if (ledgerAddresses.length > 0) {
          for (const addr of ledgerAddresses.slice(0, 3)) {
            try {
              const r = await fetch(`/api/network/ledger/satoshi-detector?address=${addr}`);
              if (r.ok) {
                const d = await r.json();
                if (!d.error && (d.isSleepingGiant || d.isSatoshiEra)) {
                  results.push(d);
                }
              }
            } catch { /* skip */ }
          }
        }

        // Sort by alertLevel priority then btcBalance
        const priority = { CRITICAL: 0, HIGH: 1, WATCH: 2, NORMAL: 3 };
        results.sort((a, b) => (priority[a.alertLevel] - priority[b.alertLevel]) || (b.btcBalance - a.btcBalance));
        
        setAlerts(results);
        
        const crit = results.find(r => r.alertLevel === 'CRITICAL');
        if (crit && !criticalAlert) {
          setCriticalAlert(crit);
          setShowBlast(true);
          setTimeout(() => setShowBlast(false), 5000);
        }
      } else {
        setError('API temporarily unavailable');
      }
    } catch (e) {
      setError('Connection error');
    }
    setIsScanning(false);
  };

  useEffect(() => {
    fetchBatchData();
    const interval = setInterval(fetchBatchData, 120_000);
    return () => clearInterval(interval);
  }, []);

  const alertColors = {
    CRITICAL: { border: 'border-cyan-400/60', bg: 'bg-cyan-500/10', text: 'text-cyan-400', badge: 'SATOSHI ERA' },
    HIGH: { border: 'border-[#25D366]/40', bg: 'bg-[#25D366]/8', text: 'text-blue-400', badge: 'SLEEPING 8Y' },
    WATCH: { border: 'border-yellow-500/30', bg: 'bg-yellow-500/5', text: 'text-yellow-400', badge: 'WATCHED' },
    NORMAL: { border: 'border-white/5', bg: 'bg-white/2', text: 'text-gray-400', badge: 'ACTIVE' },
  };

  return (
    <div className="relative w-full">
      {/* Critical Blast Overlay */}
      <AnimatePresence>
        {showBlast && criticalAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
          >
            <div className="absolute inset-0 bg-gradient-radial from-cyan-500/20 via-cyan-500/5 to-transparent animate-pulse" />
            <motion.div
              initial={{ scale: 0.5, rotate: -10, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="bg-black/90 backdrop-blur-xl border-2 border-cyan-400 rounded-3xl p-10 max-w-xl text-center shadow-[0_0_100px_rgba(34,211,238,0.5)]"
            >
              <div className="text-6xl mb-4">️</div>
              <h2 className="text-3xl font-black text-cyan-400 mb-2">SLEEPING GIANT DETECTED!</h2>
              <p className="text-white/60 text-sm mb-4">
                Wallet inactive for <span className="text-white font-black">{criticalAlert.yearsInactive} years</span>
              </p>
              <div className="bg-cyan-500/10 rounded-2xl p-4 border border-cyan-500/20">
                <p className="text-cyan-300 font-mono text-xs break-all">{criticalAlert.address}</p>
                <p className="text-cyan-400 text-2xl font-black mt-2">{criticalAlert.btcBalance.toFixed(4)} BTC</p>
                <p className="text-white/40 text-xs">First activity: {new Date(criticalAlert.firstSeenDate).getFullYear()}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full rounded-3xl bg-[#040c14] border border-cyan-900/30 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <Snowflake className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-white font-black text-lg">Satoshi Detector</h3>
              <p className="text-white/30 text-xs font-mono">Historical wallets 8 years of inactivity</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-cyan-400 animate-ping' : 'bg-emerald-500'}`} />
            <span className="text-xs text-white/30 font-mono">{isScanning ? 'SCANNING' : `${alerts.length} DETECTED`}</span>
          </div>
        </div>

        <div className="p-6">
          {isScanning && alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-4">
              <Eye className="w-10 h-10 text-white/10 animate-pulse" />
              <p className="text-white/30 text-sm">Scanning historical Bitcoin wallets...</p>
              <div className="w-full max-w-xs h-0.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  className="h-full w-1/3 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                />
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <AlertTriangle className="w-8 h-8 text-red-400/50" />
              <p className="text-white/30 text-sm">{error}</p>
              <button onClick={fetchBatchData} className="text-xs text-cyan-400 hover:underline">Retry</button>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => {
                const colors = alertColors[alert.alertLevel];
                return (
                  <motion.div
                    key={alert.address}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-2xl border ${colors.border} ${colors.bg} transition-all`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[9px] font-black ${colors.text} bg-current/10 px-2 py-0.5 rounded-full uppercase tracking-widest border border-current/20`}
                            style={{ backgroundColor: 'transparent' }}
                          >
                            {colors.badge}
                          </span>
                          <span className={`text-[9px] font-bold ${colors.text}/60`}>·</span>
                          <span className={`text-[9px] text-white/30 font-mono`}>{alert.txCount} txs</span>
                        </div>
                        <p className="text-white/50 font-mono text-xs truncate">{alert.address}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-white/20 text-[10px]">
                            Active in {new Date(alert.firstSeenDate).getFullYear()}  Last: {new Date(alert.lastActiveDate).toLocaleDateString('en', { month: 'short', year: 'numeric' })}
                          </p>
                          {alert.yearsInactive > 0 && (
                            <span className={`text-[9px] font-black ${colors.text}`}>{alert.yearsInactive}y inactive</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`${colors.text} font-black text-2xl leading-none`}>{alert.btcBalance.toFixed(2)}</p>
                        <p className="text-white/30 text-xs mt-0.5">BTC</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


