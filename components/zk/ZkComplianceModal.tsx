'use client';
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCheck2, Shield, Lock, Eye, Download, Check, Copy,
  Calendar, Key, AlertCircle, RefreshCw, X, ExternalLink,
  ShieldCheck, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getViewingKeyPolicies, createViewingKeyPolicy, revokeViewingKeyPolicy,
  generateProofOfSolvency, generateProofOfCleanOrigin,
  ViewingKeyPolicy, SolvencyAttestation, OriginAttestation
} from '@/lib/zk/zkCompliance';
import { getShieldedBalances } from '@/lib/zk/zkMoney';

interface ZkComplianceModalProps {
  userAddress: string;
  onClose: () => void;
}

export function ZkComplianceModal({ userAddress, onClose }: ZkComplianceModalProps) {
  const [activeTab, setActiveTab] = useState<'viewing_keys' | 'solvency' | 'clean_origin'>('viewing_keys');
  const [policies, setPolicies] = useState<ViewingKeyPolicy[]>([]);
  
  // Viewing Key form
  const [auditorLabel, setAuditorLabel] = useState('');
  const [scope, setScope] = useState<'incoming_only' | 'outgoing_only' | 'full_audit'>('incoming_only');
  const [durationDays, setDurationDays] = useState(30);

  // Solvency Form
  const [solvencyToken, setSolvencyToken] = useState<'DAI' | 'USDC' | 'ETH'>('DAI');
  const [solvencyThreshold, setSolvencyThreshold] = useState('1000');
  const [generatingSolvency, setGeneratingSolvency] = useState(false);
  const [solvencyResult, setSolvencyResult] = useState<SolvencyAttestation | null>(null);

  // Clean Origin
  const [generatingOrigin, setGeneratingOrigin] = useState(false);
  const [originResult, setOriginResult] = useState<OriginAttestation | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setPolicies(getViewingKeyPolicies(userAddress));
  }, [userAddress]);

  const handleCreatePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditorLabel.trim()) {
      toast.error('Nombre del auditor requerido');
      return;
    }

    createViewingKeyPolicy({
      userAddress,
      auditorLabel: auditorLabel.trim(),
      scope,
      durationDays,
    });

    toast.success('Clave de visualización (Viewing Key) creada');
    setAuditorLabel('');
    setPolicies(getViewingKeyPolicies(userAddress));
  };

  const handleRevoke = (id: string) => {
    revokeViewingKeyPolicy(userAddress, id);
    toast.success('Clave revocada de inmediato');
    setPolicies(getViewingKeyPolicies(userAddress));
  };

  const handleCopyKey = (keyHex: string, id: string) => {
    navigator.clipboard.writeText(keyHex);
    setCopiedKey(id);
    toast.success('Clave de visualización copiada');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGenerateSolvency = async () => {
    setGeneratingSolvency(true);
    try {
      const res = await generateProofOfSolvency(userAddress, solvencyToken, solvencyThreshold);
      setSolvencyResult(res);
      toast.success('Prueba ZK de Solvencia generada con éxito');
    } catch {
      toast.error('Error al generar la prueba de solvencia');
    } finally {
      setGeneratingSolvency(false);
    }
  };

  const handleGenerateCleanOrigin = async () => {
    setGeneratingOrigin(true);
    try {
      const res = await generateProofOfCleanOrigin(userAddress);
      setOriginResult(res);
      toast.success('Auditoría ZK de Origen Limpio completada (Riesgo: 0%)');
    } catch {
      toast.error('Error al computar el análisis de origen');
    } finally {
      setGeneratingOrigin(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl p-6 shadow-2xl border border-black/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-black/10 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1C1C1E] text-white flex items-center justify-center shadow-md">
              <FileCheck2 size={20} />
            </div>
            <div>
              <h3 className="text-[18px] font-black text-[#1C1C1E]">Cumplimiento Institucional & Viewing Keys</h3>
              <p className="text-[12px] text-black/50">Divulgación selectiva en Zero-Knowledge para auditorías y autoridades</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-black/50">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-[#F2F2F7] p-1 rounded-2xl mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('viewing_keys')}
            className={`flex-1 py-2 text-[13px] font-bold rounded-xl transition-all ${
              activeTab === 'viewing_keys' ? 'bg-white shadow-sm text-[#1C1C1E]' : 'text-black/50 hover:text-black'
            }`}
          >
            Claves de Auditoría (Viewing Keys)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('solvency')}
            className={`flex-1 py-2 text-[13px] font-bold rounded-xl transition-all ${
              activeTab === 'solvency' ? 'bg-white shadow-sm text-[#1C1C1E]' : 'text-black/50 hover:text-black'
            }`}
          >
            Prueba ZK de Solvencia
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('clean_origin')}
            className={`flex-1 py-2 text-[13px] font-bold rounded-xl transition-all ${
              activeTab === 'clean_origin' ? 'bg-white shadow-sm text-[#1C1C1E]' : 'text-black/50 hover:text-black'
            }`}
          >
            Auditoría de Origen Limpio
          </button>
        </div>

        {/* Tab 1: Viewing Keys */}
        {activeTab === 'viewing_keys' && (
          <div className="space-y-5">
            <form onSubmit={handleCreatePolicy} className="bg-[#F9F9FB] rounded-2xl p-4 border border-black/5 space-y-3">
              <h4 className="text-[13px] font-bold text-[#1C1C1E]">Otorgar Acceso de Solo Lectura a Auditor</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-black/50 block mb-1">Nombre / Institución</label>
                  <input
                    type="text"
                    value={auditorLabel}
                    onChange={e => setAuditorLabel(e.target.value)}
                    placeholder="Ej. KPMG / Agencia Tributaria"
                    className="w-full px-3 py-2 rounded-xl border border-black/10 text-[12px] outline-none focus:border-[#1C1C1E]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-black/50 block mb-1">Alcance</label>
                  <select
                    value={scope}
                    onChange={e => setScope(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-black/10 text-[12px] bg-white outline-none focus:border-[#1C1C1E]"
                  >
                    <option value="incoming_only">Solo Entradas (ivsk)</option>
                    <option value="outgoing_only">Solo Salidas (ovsk)</option>
                    <option value="full_audit">Auditoría Completa</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-black/50 block mb-1">Vigencia (Días)</label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={durationDays}
                    onChange={e => setDurationDays(parseInt(e.target.value) || 30)}
                    className="w-full px-3 py-2 rounded-xl border border-black/10 text-[12px] outline-none focus:border-[#1C1C1E]"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#1C1C1E] text-white font-bold text-[13px] hover:bg-[#1C1C1E] shadow transition-colors"
              >
                Generar Viewing Key Criptográfica
              </button>
            </form>

            <div className="space-y-2">
              <h4 className="text-[13px] font-bold text-[#1C1C1E]">Políticas Activas ({policies.length})</h4>
              {policies.length === 0 ? (
                <p className="text-[12px] text-black/40 text-center py-4 bg-gray-50 rounded-xl">No hay claves de visualización otorgadas</p>
              ) : (
                policies.map(p => (
                  <div key={p.id} className="p-3 bg-white rounded-xl border border-black/10 shadow-sm flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[13px] text-[#1C1C1E]">{p.auditorLabel}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          p.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                        }`}>
                          {p.status}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-black/40 truncate max-w-sm mt-0.5">{p.keyHex}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyKey(p.keyHex, p.id)}
                        className="p-1.5 rounded-lg bg-black/5 hover:bg-black/10 text-black/60"
                        title="Copiar Clave"
                      >
                        {copiedKey === p.id ? <Check size={14} className="text-[#1C1C1E]" /> : <Copy size={14} />}
                      </button>
                      {p.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(p.id)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-50 text-red-600 hover:bg-red-100"
                        >
                          Revocar
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Solvency Range Proof */}
        {activeTab === 'solvency' && (
          <div className="space-y-4">
            <div className="bg-[#F9F9FB] rounded-2xl p-5 border border-black/5">
              <h4 className="text-[14px] font-bold text-[#1C1C1E] mb-1">Prueba ZK de Solvencia (Range Proof)</h4>
              <p className="text-[12px] text-black/60 mb-4 leading-relaxed">
                Demuestra criptográficamente ante un banco, broker o contraparte que posees al menos cierta cantidad de fondos protegidos en Aztec Network, <strong>sin revelar tu saldo exacto ni tus transacciones pasadas</strong>.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-[11px] font-bold text-black/50 uppercase block mb-1">Activo</label>
                  <select
                    value={solvencyToken}
                    onChange={e => setSolvencyToken(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-black/10 text-[13px] bg-white outline-none focus:border-[#1C1C1E]"
                  >
                    <option value="DAI">zkDAI (Aztec)</option>
                    <option value="USDC">zkUSDC (Aztec)</option>
                    <option value="ETH">zkETH (Aztec)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-black/50 uppercase block mb-1">Umbral Mínimo a Probar</label>
                  <input
                    type="text"
                    value={solvencyThreshold}
                    onChange={e => setSolvencyThreshold(e.target.value)}
                    placeholder="1000"
                    className="w-full px-3 py-2 rounded-xl border border-black/10 text-[13px] font-mono outline-none focus:border-[#1C1C1E]"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={generatingSolvency}
                onClick={handleGenerateSolvency}
                className="w-full py-3 rounded-xl bg-[#1C1C1E] text-white font-bold text-[14px] hover:bg-[#1C1C1E] shadow transition-colors flex items-center justify-center gap-2"
              >
                {generatingSolvency ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Computando UltraPlonk Range Proof…
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} /> Computar Prueba de Solvencia
                  </>
                )}
              </button>
            </div>

            {solvencyResult && (
              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-[14px] mb-2">
                  <Check size={16} className="text-[#1C1C1E]" />
                  Atestación ZK Verificada: {solvencyResult.isSolvent ? 'SOLVENTE' : 'FONDOS INSUFICIENTES'}
                </div>
                <p className="text-[12px] text-emerald-900 font-mono mb-2">
                  Se ha demostrado que el titular controla &ge; {solvencyResult.thresholdClaimed} zk{solvencyResult.token}.
                </p>
                <div className="p-2.5 bg-white rounded-xl border border-emerald-200/60 font-mono text-[10px] text-black/60 truncate">
                  Proof: {solvencyResult.zkProofHex}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Clean Origin */}
        {activeTab === 'clean_origin' && (
          <div className="space-y-4">
            <div className="bg-[#F9F9FB] rounded-2xl p-5 border border-black/5">
              <h4 className="text-[14px] font-bold text-[#1C1C1E] mb-1">Atestación ZK de Origen Limpio</h4>
              <p className="text-[12px] text-black/60 mb-4 leading-relaxed">
                Escanea el árbol de nullifiers de tus notas confidenciales y demuestra mediante pruebas de membresía acumulativa que tus fondos no interactuaron con direcciones sancionadas u operadores maliciosos.
              </p>

              <button
                type="button"
                disabled={generatingOrigin}
                onClick={handleGenerateCleanOrigin}
                className="w-full py-3 rounded-xl bg-[#1C1C1E] text-white font-bold text-[14px] hover:bg-[#1C1C1E] shadow transition-colors flex items-center justify-center gap-2"
              >
                {generatingOrigin ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Verificando Árbol de Nullifiers SMT-32…
                  </>
                ) : (
                  <>
                    <Shield size={16} /> Generar Certificado de Fondos Limpios
                  </>
                )}
              </button>
            </div>

            {originResult && (
              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-[14px] mb-1">
                  <ShieldCheck size={18} className="text-[#1C1C1E]" />
                  Veredicto Institucional: {originResult.complianceVerdict}
                </div>
                <p className="text-[12px] text-emerald-900 font-semibold mb-2">
                  Riesgo de Sanción: {originResult.sanctionRiskScore}% · Notas Auditadas: {originResult.notesScannedCount}
                </p>
                <div className="p-2.5 bg-white rounded-xl border border-emerald-200/60 font-mono text-[10px] text-black/60 truncate">
                  Hash de Verificación: {originResult.zkProofHex}
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
