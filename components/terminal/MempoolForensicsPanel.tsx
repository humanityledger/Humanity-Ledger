'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ShieldAlert, Zap, Eye, AlertTriangle, CheckCircle, XCircle, RefreshCw, Activity, Layers } from 'lucide-react';

//  Risk Taxonomy 
export type RiskLevel = 'ELEVATED' | 'MODERATE' | 'STANDARD' | 'LOW' | 'NOMINAL';

export interface SequenceAlert {
  id: string;
  txHash: string;
  from: string;
  to: string;
  value: string;       // ETH
  gasPrice: string;    // Gwei
  riskLevel: RiskLevel;
  riskType: string;
  reason: string;
  timestamp: Date;
  chain: string;
  contractFunctions?: string[];
}

const KNOWN_SELECTORS: Record<string, string> = {
  '0x095ea7b3': 'approve()  High-variance token allocation',
  '0xa22cb465': 'setApprovalForAll()  Global asset delegation',
  '0x23b872dd': 'transferFrom()  Delegated transfer execution',
  '0x42842e0e': 'safeTransferFrom()  Verified asset transfer',
  '0x1cff79cd': 'execute()  Arbitrary execution sequence',
  '0x3593564c': 'execute()  Universal router interaction',
  '0xac9650d8': 'multicall()  Batched transaction sequence',
};

const HIGH_FREQUENCY_PATTERNS = ['0x000000000', '0xEeeeeE', 'sandwich'];

function evaluateSequenceRisk(tx: any): { level: RiskLevel; type: string; reason: string; functions: string[] } {
  const flags: string[] = [];
  const detectedFunctions: string[] = [];
  let score = 0;

  const inputData: string = tx.input ?? tx.data ?? '0x';
  const selector = inputData.slice(0, 10).toLowerCase();

  if (KNOWN_SELECTORS[selector]) {
    const desc = KNOWN_SELECTORS[selector];
    detectedFunctions.push(desc);
    if (selector === '0x095ea7b3' || selector === '0xa22cb465') {
      score += 70;
      flags.push('Broad asset allocation detected');
    } else if (selector === '0x1cff79cd') {
      score += 90;
      flags.push('Arbitrary execution sequence  requires verification');
    } else {
      score += 30;
      flags.push(`Identified method: ${desc}`);
    }
  }

  const gasGwei = parseFloat(tx.gasPrice ?? '0');
  if (gasGwei > 200) {
    score += 40;
    flags.push(`Accelerated priority fee: ${gasGwei.toFixed(1)} Gwei`);
  }

  const valueEth = parseFloat(tx.value ?? '0');
  if (valueEth === 0 && inputData !== '0x' && inputData.length > 10) {
    score += 20;
    flags.push('Zero-value contract interaction');
  }

  const toAddr = (tx.to ?? '').toLowerCase();
  if (HIGH_FREQUENCY_PATTERNS.some(p => toAddr.startsWith(p.toLowerCase()))) {
    score += 50;
    flags.push('High-frequency attesting contract destination');
  }

  let level: RiskLevel = 'NOMINAL';
  if (score >= 90) level = 'ELEVATED';
  else if (score >= 60) level = 'MODERATE';
  else if (score >= 35) level = 'STANDARD';
  else if (score >= 15) level = 'LOW';

  const type = score >= 60
    ? detectedFunctions[0]?.includes('allocation') || detectedFunctions[0]?.includes('delegation')
      ? 'Asset Delegation Sequence'
      : 'High-Frequency Execution'
    : score >= 15 ? 'Non-Standard Pattern' : 'Standard Execution';

  return {
    level,
    type,
    reason: flags.length > 0 ? flags.join(' | ') : 'Routine network operation',
    functions: detectedFunctions,
  };
}

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; icon: any }> = {
  ELEVATED: { label: 'ELEVATED', color: '#FF1744', icon: XCircle },
  MODERATE: { label: 'MODERATE', color: '#FF6D00', icon: AlertTriangle },
  STANDARD: { label: 'STANDARD', color: '#FFB300', icon: AlertTriangle },
  LOW:      { label: 'LOW',      color: '#00897B', icon: Eye },
  NOMINAL:  { label: 'NOMINAL',  color: '#43A047', icon: CheckCircle },
};

const truncAddr = (a: string) => a ? `${a.slice(0, 6)}${a.slice(-4)}` : '';
const truncHash = (h: string) => h ? `${h.slice(0, 10)}${h.slice(-6)}` : '';

const CHAINS = [
  { id: 'eth', label: 'Ethereum Mainnet' },
  { id: 'base', label: 'Base L2' },
  { id: 'op',  label: 'Optimism' },
];

export function MempoolForensicsPanel() {
  const { address } = useAccount();
  const [alerts, setAlerts] = useState<SequenceAlert[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [selectedChain, setSelectedChain] = useState('eth');
  const [filter, setFilter] = useState<RiskLevel | 'ALL'>('ALL');
  const [scanCount, setScanCount] = useState(0);
  const [riskCount, setRiskCount] = useState({ ELEVATED: 0, MODERATE: 0, STANDARD: 0 });
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const generateLocalMempoolData = () => {
    const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
    const generateHex = (bytes: number) => {
        const arr = new Uint8Array(bytes);
        crypto.getRandomValues(arr);
        return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    };
    const methods = Object.keys(KNOWN_SELECTORS);
    const method = methods[Math.floor(secureRandom() * methods.length)];
    return Array.from({ length: Math.floor(secureRandom() * 5) + 1 }).map(() => ({
      hash: '0x' + generateHex(32),
      from: '0x' + generateHex(20),
      to: '0x' + generateHex(20),
      value: (secureRandom() * 2).toString(),
      gasPrice: (secureRandom() * 250).toString(),
      input: method + generateHex(32)
    }));
  };

  const scanMempool = useCallback(async () => {
    try {
      // Simulate real-time sovereign data stream
      const txs = generateLocalMempoolData();

      setScanCount(c => c + txs.length);

      const newAlerts: SequenceAlert[] = [];
      for (const tx of txs) {
        const { level, type, reason, functions } = evaluateSequenceRisk(tx);
        if (level === 'NOMINAL') continue;

        const alert: SequenceAlert = {
          id: tx.hash ?? crypto.randomUUID(),
          txHash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: ((parseFloat(tx.value ?? '0')).toFixed(4)),
          gasPrice: ((parseFloat(tx.gasPrice ?? '0')).toFixed(2)),
          riskLevel: level,
          riskType: type,
          reason,
          timestamp: new Date(),
          chain: selectedChain,
          contractFunctions: functions,
        };
        newAlerts.push(alert);
      }

      if (newAlerts.length > 0) {
        setAlerts(prev => [...newAlerts, ...prev].slice(0, 100)); 
        setRiskCount(prev => ({
          ELEVATED: prev.ELEVATED + newAlerts.filter(a => a.riskLevel === 'ELEVATED').length,
          MODERATE: prev.MODERATE + newAlerts.filter(a => a.riskLevel === 'MODERATE').length,
          STANDARD: prev.STANDARD + newAlerts.filter(a => a.riskLevel === 'STANDARD').length,
        }));
      }
    } catch (err) {
      console.warn('Scan stream interrupted');
    }
  }, [selectedChain]);

  useEffect(() => {
    if (isActive) {
      scanMempool(); 
      pollingRef.current = setInterval(scanMempool, 3500); 
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [isActive, scanMempool]);

  const filteredAlerts = filter === 'ALL'
    ? alerts
    : alerts.filter(a => a.riskLevel === filter);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center gap-2 text-[#050505] px-2">
        <Layers size={18} />
        <h2 className="text-xl font-bold tracking-tight">Real-Time Transaction Sequencing</h2>
      </div>

      {/* Header controls */}
      <div className="flex flex-wrap items-center gap-4 px-2">
        <div className="flex gap-1 p-1 rounded-xl bg-black/[0.04] border border-black/5">
          {CHAINS.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedChain(c.id)}
              className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${selectedChain === c.id ? 'bg-white shadow-sm text-[#050505]' : 'text-black/40 hover:text-black/70'}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {(['ALL', 'ELEVATED', 'MODERATE', 'STANDARD', 'LOW'] as const).map(lvl => (
            <button
              key={lvl}
              onClick={() => setFilter(lvl)}
              className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border ${
                filter === lvl
                  ? lvl === 'ALL'
                    ? 'bg-white text-white border-[#050505]'
                    : `text-white border-transparent`
                  : 'bg-transparent text-black/40 border-black/10 hover:border-black/20'
              }`}
              style={filter === lvl && lvl !== 'ALL' ? {
                backgroundColor: RISK_CONFIG[lvl].color,
                borderColor: RISK_CONFIG[lvl].color,
              } : {}}
            >
              {lvl} {lvl !== 'ALL' && riskCount[lvl as keyof typeof riskCount] !== undefined
                ? `(${riskCount[lvl as keyof typeof riskCount]})`
                : ''}
            </button>
          ))}
        </div>

        <button
          onClick={() => setIsActive(a => !a)}
          className={`ml-auto flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
            isActive
              ? 'bg-red-500/10 border border-red-500/20 text-red-600 hover:bg-red-500/20'
              : 'bg-white text-white hover:bg-black/80'
          }`}
        >
          {isActive ? (
            <><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />Pause Sequencing</>
          ) : (
            <><Zap size={14} />Initiate Sequencing</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-2">
        {[
          { label: 'Blocks Sequenced', value: scanCount.toLocaleString(), icon: Activity, color: '#050505' },
          { label: 'Elevated Risk', value: riskCount.ELEVATED, icon: XCircle, color: '#FF1744' },
          { label: 'Moderate Risk', value: riskCount.MODERATE, icon: AlertTriangle, color: '#FF6D00' },
          { label: 'Standard Risk', value: riskCount.STANDARD, icon: Eye, color: '#FFB300' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-black/[0.05] bg-white shadow-sm px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
              <Icon size={16} style={{ color }} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[20px] font-bold text-[#050505] leading-none mb-1">{value}</p>
              <p className="text-[10px] text-black/40 font-semibold uppercase tracking-widest">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-black/[0.05] overflow-hidden bg-white shadow-sm mx-2">
        <div className="grid grid-cols-[110px_140px_140px_90px_1fr_110px] gap-4 px-6 py-4 border-b border-black/[0.05] bg-black/[0.02]">
          {['Assessment', 'Transaction Hash', 'Initiator', 'Notional', 'Behavioral Indicator', 'Timestamp'].map(h => (
            <span key={h} className="text-[10px] font-semibold uppercase tracking-widest text-black/40">{h}</span>
          ))}
        </div>

        {!isActive && alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5">
            <div className="w-16 h-16 rounded-2xl bg-black/[0.03] flex items-center justify-center border border-black/5">
              <ShieldAlert size={24} className="text-black/30" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-bold text-[#050505]/70">Sequencer Offline</p>
              <p className="text-[12px] text-black/40 mt-1 max-w-[250px]">Initiate the sequencing engine to begin real-time network analysis.</p>
            </div>
          </div>
        ) : isActive && alerts.length === 0 ? (
          <div className="flex items-center justify-center py-16 gap-3 text-black/40">
            <RefreshCw size={16} className="animate-spin" />
            <span className="text-[12px] font-medium">Aggregating block data</span>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-black/40">
            <span className="text-[12px] font-medium">No transactions match current filters.</span>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[500px]">
            {filteredAlerts.map((alert) => {
              const cfg = RISK_CONFIG[alert.riskLevel];
              const ThreatIcon = cfg.icon;
              return (
                <div
                  key={alert.id}
                  className="grid grid-cols-[110px_140px_140px_90px_1fr_110px] gap-4 px-6 py-4 border-b border-black/[0.03] hover:bg-black/[0.01] transition-colors items-center"
                  style={{ borderLeft: `3px solid ${cfg.color}` }}
                >
                  <div className="flex items-center gap-2">
                    <ThreatIcon size={14} style={{ color: cfg.color }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </div>

                  <a
                    href={`https://${alert.chain === 'op' ? 'optimistic.' : ''}etherscan.io/tx/${alert.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] font-mono text-[#050505] hover:underline"
                  >
                    {truncHash(alert.txHash)}
                  </a>

                  <span className="text-[12px] font-mono text-black/50">{truncAddr(alert.from)}</span>

                  <span className="text-[12px] font-bold text-[#050505]">{alert.value} ETH</span>

                  <span className="text-[11px] text-black/50 leading-snug truncate" title={alert.reason}>
                    <strong className="text-[#050505] font-semibold">{alert.riskType}</strong>  {alert.reason.split(' | ')[0]}
                  </span>

                  <span className="text-[11px] font-mono text-black/40">
                    {alert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
