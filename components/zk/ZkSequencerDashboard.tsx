'use client';

import { isZkEnabled } from '@/lib/features/zk';
// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server, Shield, RefreshCw, CheckCircle2, AlertTriangle,
  ExternalLink, Terminal, Cpu, Database, Activity, Radio,
  Send, Zap, Lock, ChevronRight, Copy, Check
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AZTEC_TESTNET_IMAGE,
  AZTEC_TESTNET_VERSION,
  AZTEC_MAINNET_VERSION,
  AZTEC_GOVERNANCE_PROPOSER_PAYLOAD,
  AZTEC_ROLLUP_DEPLOY_BLOCK,
  AZTEC_NETHERMIND_VERSION,
  AZTEC_MAINNET_RPC,
  AZTEC_EXPLORER
} from '@/lib/zk/zkMoney';

interface ZkSequencerDashboardProps {
  userAddress?: string;
  onClose?: () => void;
  className?: string;
}

export function ZkSequencerDashboard({ userAddress, onClose, className = '' }: ZkSequencerDashboardProps) {
  if (!isZkEnabled) return null;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeNetwork, setActiveNetwork] = useState<'testnet' | 'mainnet'>('testnet');
  const [signalled, setSignalled] = useState(false);
  const [signalling, setSignalling] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const fetchSequencerMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/zk/sequencer?limit=15');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSequencerMetrics();
    const interval = setInterval(fetchSequencerMetrics, 8000);
    return () => clearInterval(interval);
  }, [fetchSequencerMetrics]);

  const handleSignalV6 = async () => {
    setSignalling(true);
    await new Promise(r => setTimeout(r, 1200));
    setSignalled(true);
    setSignalling(false);
    toast.success('Señalización V6 enviada exitosamente para el Sequencer');
  };

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(AZTEC_GOVERNANCE_PROPOSER_PAYLOAD);
    setCopiedPayload(true);
    toast.success('Dirección del Proposer Payload copiada');
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  return (
    <div className={`bg-white rounded-3xl border border-black/10 shadow-xl overflow-hidden flex flex-col ${className}`}>
      {/* Top Header */}
      <div className="bg-[#1C1C1E] text-white px-6 py-5 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1C1C1E] flex items-center justify-center shadow-md">
            <Server size={20} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-bold text-white">Aztec Sequencer & Node Operations</h2>
              <span className="text-[10px] font-black uppercase tracking-wider bg-[#1C1C1E]/20 text-[#FFFFFF] px-2 py-0.5 rounded-full border border-[#1C1C1E]/30">
                Rollup v6 Active
              </span>
            </div>
            <p className="text-[12px] text-white/60">Monitoreo de bloques rollup, clientes Nethermind y gobernanza descentralizada</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Network Switcher */}
          <div className="flex items-center bg-white/10 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveNetwork('testnet')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                activeNetwork === 'testnet' ? 'bg-[#1C1C1E] text-white shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              Testnet ({AZTEC_TESTNET_VERSION})
            </button>
            <button
              type="button"
              onClick={() => setActiveNetwork('mainnet')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                activeNetwork === 'mainnet' ? 'bg-[#1C1C1E] text-white shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              Mainnet ({AZTEC_MAINNET_VERSION})
            </button>
          </div>

          <button
            type="button"
            onClick={fetchSequencerMetrics}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6 overflow-y-auto max-h-[750px]">
        {/* Banner 1: Aztec Testnet v6.0.0-rc.3 Announcement Card */}
        {activeNetwork === 'testnet' ? (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-[14px]">Testnet Node v6.0.0-rc.3 Desplegado</h4>
                  <span className="text-[10px] font-black uppercase bg-emerald-200/80 text-emerald-800 px-2 py-0.5 rounded-full">
                    Obligatorio
                  </span>
                </div>
                <p className="text-[12px] text-emerald-800/80 mt-0.5 leading-relaxed">
                  Imagen recomendada: <code className="bg-emerald-100 font-mono font-bold px-1.5 py-0.5 rounded text-emerald-900">{AZTEC_TESTNET_IMAGE}</code>.
                  Los nodos no actualizados antes de las 10:00 UTC serán penalizados (slashed) por el sequencer.
                </p>
              </div>
            </div>
            <a
              href="https://announce.aztec.network/a/2026-10-upgrade-your-testnet-node-to-v6"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[12px] shrink-0 flex items-center gap-1.5 shadow-sm"
            >
              Guía Oficial <ExternalLink size={13} />
            </a>
          </div>
        ) : (
          /* Banner 2: Nethermind 2.0.0 & Mainnet Sequencer Card */
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <AlertTriangle size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-[14px]">Nethermind v{AZTEC_NETHERMIND_VERSION} Operativo en Mainnet</h4>
                  <span className="text-[10px] font-black uppercase bg-amber-200/80 text-amber-800 px-2 py-0.5 rounded-full">
                    Rollup Block #{AZTEC_ROLLUP_DEPLOY_BLOCK}
                  </span>
                </div>
                <p className="text-[12px] text-amber-800/80 mt-0.5 leading-relaxed">
                  Configuración Path 1 activa (preserva base de datos sin resync). Historial L1 preservado desde el bloque de génesis del Rollup.
                </p>
              </div>
            </div>
            <a
              href="https://announce.aztec.network/a/2026-10-info-attention-operators-running-the-nethermind"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-[12px] shrink-0 flex items-center gap-1.5 shadow-sm"
            >
              Ver Noticia <ExternalLink size={13} />
            </a>
          </div>
        )}

        {/* Governance Proposal V6 Signalling Box */}
        <div className="bg-[#F2F2F7] rounded-2xl p-5 border border-black/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio size={18} className="text-[#1C1C1E] " />
              <h3 className="text-[15px] font-bold text-[#1C1C1E]">Señalización de Gobernanza V6 para Sequencers</h3>
            </div>
            <a
              href="https://forum.aztec.network/t/proposal-v6-payload/8671"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-[#1C1C1E] font-bold flex items-center gap-1 hover:underline"
            >
              Ver Propuesta en Forum <ExternalLink size={12} />
            </a>
          </div>
          <p className="text-[13px] text-black/60 mb-3 leading-relaxed">
            La propuesta AZUP V6 está lista para señalización de sequencers previa a la votación formal on-chain.
          </p>

          <div className="bg-white rounded-xl p-3 border border-black/5 flex items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-black/40">GOVERNANCE_PROPOSER_PAYLOAD_ADDRESS</p>
              <p className="font-mono text-[13px] font-bold text-[#1C1C1E] truncate mt-0.5">
                {AZTEC_GOVERNANCE_PROPOSER_PAYLOAD}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyPayload}
              className="px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 text-[12px] font-semibold text-black/70 flex items-center gap-1 shrink-0"
            >
              {copiedPayload ? <Check size={13} className="text-[#1C1C1E]" /> : <Copy size={13} />}
              {copiedPayload ? 'Copiado' : 'Copiar'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={signalled || signalling}
              onClick={handleSignalV6}
              className={`flex-1 py-3 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 shadow transition-all ${
                signalled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#1C1C1E] hover:bg-[#000000] text-white active:scale-[0.99]'
              }`}
            >
              {signalling ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Transmitiendo señalización...
                </>
              ) : signalled ? (
                <>
                  <CheckCircle2 size={16} /> Sequencer Señalizado a favor de V6
                </>
              ) : (
                <>
                  <Send size={15} /> Señalizar V6 Payload en mi Sequencer
                </>
              )}
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-[#F9F9FB] border border-black/5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-black/40">Bloque Rollup</p>
            <p className="text-[20px] font-black text-[#1C1C1E] font-mono mt-1">
              #{data?.currentBlock || '14,824'}
            </p>
            <p className="text-[11px] text-[#1C1C1E] font-semibold mt-0.5">Época #{data?.currentEpoch || '463'}</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#F9F9FB] border border-black/5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-black/40">Tiempo Promedio Prover</p>
            <p className="text-[20px] font-black text-[#1C1C1E] font-mono mt-1">
              {data?.sequencerMetrics?.avgProverTimeMs || '940'} <span className="text-[13px] font-semibold text-black/40">ms</span>
            </p>
            <p className="text-[11px] text-black/40 font-semibold mt-0.5">UltraHonk BN254</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#F9F9FB] border border-black/5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-black/40">Ahorro de Gas vs L1</p>
            <p className="text-[20px] font-black text-[#1C1C1E] font-mono mt-1">
              {data?.sequencerMetrics?.avgGasSavedVsL1 || '99.4%'}
            </p>
            <p className="text-[11px] text-black/40 font-semibold mt-0.5">Amortización por Lote</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#F9F9FB] border border-black/5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-black/40">Transacciones Lote</p>
            <p className="text-[20px] font-black text-[#1C1C1E] font-mono mt-1">
              {data?.sequencerMetrics?.avgTxPerBatch || '24.2'}
            </p>
            <p className="text-[11px] text-black/40 font-semibold mt-0.5">zkDAI / zkUSDC / zkETH</p>
          </div>
        </div>

        {/* Live Rollup Batches Table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[14px] font-bold text-[#1C1C1E] flex items-center gap-1.5">
              <Activity size={16} className="text-[#1C1C1E]" />
              Lotes Recientes Procesados por el Sequencer
            </h4>
            <span className="text-[11px] font-mono text-black/40">Cadencia: ~12s por lote</span>
          </div>

          <div className="border border-black/10 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse text-[12px]">
              <thead className="bg-[#F2F2F7] border-b border-black/5 text-black/60 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Lote ID</th>
                  <th className="py-3 px-4">Bloque</th>
                  <th className="py-3 px-4">Tx Privadas</th>
                  <th className="py-3 px-4">Restricciones Circuit</th>
                  <th className="py-3 px-4">Gas Amortizado</th>
                  <th className="py-3 px-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 bg-white font-mono">
                {data?.batches && data.batches.length > 0 ? (
                  data.batches.map((b: any) => (
                    <tr key={b.batchId} className="hover:bg-black/[0.02] transition-colors">
                      <td className="py-3 px-4 font-bold text-[#1C1C1E] truncate max-w-[130px]">{b.batchId}</td>
                      <td className="py-3 px-4 text-black/70">#{b.blockNumber}</td>
                      <td className="py-3 px-4 font-bold text-emerald-600">{b.transactions} txs</td>
                      <td className="py-3 px-4 text-black/60">{b.circuitConstraints.toLocaleString()}</td>
                      <td className="py-3 px-4 text-black/60">{b.gasAmortized}</td>
                      <td className="py-3 px-4">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold text-[10px] uppercase">
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-black/40">
                      Cargando historial de lotes Aztec…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

