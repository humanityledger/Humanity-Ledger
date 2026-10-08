"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, EyeOff, Lock, Network, Zap, Fingerprint, Activity, ChevronRight, RefreshCw, Layers } from 'lucide-react';
import { useBalance } from 'wagmi';
import { useSystemAccount } from '@/hooks/useSystemAccount';

// Typings for Etherscan response
interface EtherscanTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  timeStamp: string;
  confirmations: string;
}

interface ShieldedNode {
  id: string;
  hash: string;
  from: string;
  status: 'active' | 'processing' | 'verified';
  valueParsed: string;
}

const ETHERSCAN_API = 'https://api.etherscan.io/api';

function statusFromConfirmations(conf: string): ShieldedNode['status'] {
  const n = parseInt(conf);
  if (n === 0) return 'processing';
  if (n < 12) return 'active';
  return 'verified';
}

export default function AztecPrivacyHub() {
  const { address, isConnected } = useSystemAccount();
  const { data: balance } = useBalance({ address });

  const [nodes, setNodes] = useState<ShieldedNode[]>([]);
  const [anonymitySet, setAnonymitySet] = useState<number | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState('');
  const [error, setError] = useState('');

  const fetchTxs = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    setError('');

    try {
      // Fetch last 5 txs for the connected wallet from Etherscan
      const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || '';
      const url = `${ETHERSCAN_API}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=5&sort=desc&apikey=${apiKey}`;
      const res = await fetch(url);
      const json = await res.json();

      if (json.status === '1' && Array.isArray(json.result)) {
        const txs: EtherscanTx[] = json.result;
        const mapped: ShieldedNode[] = txs.map((tx, i) => ({
          id: tx.hash,
          hash: `${tx.hash.slice(0, 10)}...${tx.hash.slice(-6)}`,
          from: `${tx.from.slice(0, 8)}...${tx.from.slice(-4)}`,
          status: statusFromConfirmations(tx.confirmations),
          valueParsed: (parseInt(tx.value) / 1e18).toFixed(6),
        }));
        setNodes(mapped);
        // anonymity set = total txs in Etherscan for this address
        const countRes = await fetch(`${ETHERSCAN_API}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=desc&apikey=${apiKey}`);
        const countJson = await countRes.json();
        if (countJson.status === '1') {
          setAnonymitySet(parseInt(countJson.result?.[0]?.nonce || '0') + 1);
        }
        setLastFetched(new Date().toLocaleTimeString());
      } else {
        setError(json.message || 'No transactions found for this address.');
        setNodes([]);
      }
    } catch (e) {
      setError('Etherscan API unavailable. Add NEXT_PUBLIC_ETHERSCAN_API_KEY to .env.');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected && address) {
      fetchTxs();
    }
  }, [address, isConnected, fetchTxs]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(fetchTxs, 30000);
    return () => clearInterval(interval);
  }, [isConnected, fetchTxs]);

  const handleRoutePrivacy = () => {
    setIsRouting(true);
    setTimeout(() => setIsRouting(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-premium p-4 rounded-3xl relative z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-purple-500/10 px-4 py-2 rounded-xl border border-purple-500/20">
            <Shield size={18} className="text-purple-400" />
            <span className="text-sm font-black text-purple-100 uppercase tracking-widest">Aztec Protocol</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
            {isConnected
              ? <><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /><span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Wallet Connected · {address?.slice(0,6)}...{address?.slice(-4)}</span></>
              : <><div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" /><span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider">Connect wallet to activate</span></>
            }
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] text-white/40 uppercase tracking-widest font-black mb-1">Transaction Count</div>
            <div className="text-sm font-mono text-purple-400">{anonymitySet !== null ? `${anonymitySet.toLocaleString()} txs` : ''}</div>
          </div>
          <button
            onClick={() => { fetchTxs(); handleRoutePrivacy(); }}
            disabled={isRouting || isLoading || !isConnected}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-emerald-600 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all disabled:opacity-50"
          >
            {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <EyeOff size={16} />}
            <span>{isLoading ? 'Fetching...' : 'Refresh On-Chain'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real Balance Panel */}
        <div className="lg:col-span-1 glass-premium rounded-[2.5rem] p-8 relative overflow-hidden flex flex-col justify-between min-h-[400px]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                <Lock size={20} className="text-white/80" />
              </div>
              <h3 className="text-lg font-black tracking-tighter text-white">On-Chain Balance</h3>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-black text-purple-400 uppercase tracking-widest">
                {isConnected ? `${address?.slice(0,12)}...` : 'No wallet detected'}
              </div>
              <div className="text-5xl font-mono font-light tracking-tighter">
                {balance ? `${parseFloat(balance.formatted).toFixed(4)} ${balance.symbol}` : ''}
              </div>
            </div>
          </div>

          <div className="space-y-4 mt-12">
            <div className="glass-panel p-4 rounded-2xl flex items-center justify-between border border-white/5 bg-black/40">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#25D366]/20 flex items-center justify-center">
                  <div className={`w-4 h-4 rounded-full bg-[#25D366] ${isConnected ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Network State</div>
                  <div className="text-[10px] text-emerald-400 font-mono">{isConnected ? 'Ethereum Mainnet' : 'Disconnected'}</div>
                </div>
              </div>
            </div>
            <div className="glass-panel p-4 rounded-2xl flex items-center justify-between border border-white/5 bg-black/40">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Fingerprint size={14} className="text-purple-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Identity Layer</div>
                  <div className="text-[10px] text-purple-400 font-mono">Wagmi EOA Verified</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Real TX Feed */}
        <div className="lg:col-span-2 glass-premium rounded-[2.5rem] p-8 relative overflow-hidden flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20 text-purple-400">
                <Network size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tighter text-white">Recent Transactions</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">
                  {lastFetched ? `Etherscan API · ${lastFetched}` : 'Awaiting connection...'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <Activity size={14} className="text-purple-400" />
              <span className="text-[10px] font-mono text-white/60">Active</span>
            </div>
          </div>

          <div className="flex-1 space-y-3 relative">
            {!isConnected && (
              <div className="py-16 text-center text-white/30 font-mono text-xs border border-dashed border-white/10 rounded-2xl">
                Connect your wallet to see your real transaction history via Etherscan API.
              </div>
            )}
            {isConnected && error && (
              <div className="py-8 text-center text-yellow-400/80 font-mono text-xs border border-dashed border-yellow-500/20 rounded-2xl px-6">
                {error}
              </div>
            )}
            <AnimatePresence mode="popLayout">
              {nodes.map((node) => (
                <motion.div
                  key={node.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4 }}
                  className="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10">
                      {node.status === 'verified' ? <Shield size={16} className="text-green-400" />
                        : node.status === 'processing' ? <Layers size={16} className="text-purple-400" />
                        : <Zap size={16} className="text-emerald-400" />}
                    </div>
                    <div>
                      <div className="text-sm font-mono text-white/80 group-hover:text-white transition-colors">{node.hash}</div>
                      <div className="text-[10px] text-white/30 font-mono">From: {node.from}</div>
                      <div className="text-[10px] uppercase tracking-widest mt-1 font-black">
                        {node.status === 'verified' && <span className="text-green-500">Confirmed</span>}
                        {node.status === 'processing' && <span className="text-purple-500">Pending</span>}
                        {node.status === 'active' && <span className="text-[#25D366]">Confirming</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div className="text-sm font-mono text-white/60">{node.valueParsed} Ξ</div>
                    <a href={`https://etherscan.io/tx/${node.id}`} target="_blank" rel="noopener noreferrer">
                      <ChevronRight size={16} className="text-white/20 hover:text-white transition-colors" />
                    </a>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <style jsx>{`
        .glass-premium { background: rgba(10,5,26,0.4); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
      `}</style>
    </div>
  );
}

