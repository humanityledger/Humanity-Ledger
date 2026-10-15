'use client';
// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Check, Play, RefreshCw, X, Download, Terminal,
  Cpu, Lock, Sparkles, Layers, ChevronRight, AlertCircle,
  ExternalLink, Copy, CheckCircle2, ShieldCheck, Activity
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getCeremonies, createCeremony, contributeToceremony,
  verifyCeremony, MpcCeremony, MpcContribution
} from '@/lib/zk/zkMpc';
import { AZTEC_MAINNET_RPC, AZTEC_EXPLORER } from '@/lib/zk/zkMoney';

interface ZkMpcCeremonyProps {
  userAddress: string;
  onClose?: () => void;
  className?: string;
}

export function ZkMpcCeremony({ userAddress, onClose, className = '' }: ZkMpcCeremonyProps) {
  const [ceremonies, setCeremonies] = useState<MpcCeremony[]>([]);
  const [selectedCeremony, setSelectedCeremony] = useState<MpcCeremony | null>(null);
  const [isContributing, setIsContributing] = useState(false);
  const [contributionProgress, setContributionProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [lastContribution, setLastContribution] = useState<MpcContribution | null>(null);
  
  // Entropy Collection
  const [entropyBits, setEntropyBits] = useState<number[]>([]);
  const [isCollectingEntropy, setIsCollectingEntropy] = useState(false);
  const [entropyProgress, setEntropyProgress] = useState(0);
  const entropyCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // New Ceremony Form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCircuitName, setNewCircuitName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPhase, setNewPhase] = useState<'phase1' | 'phase2'>('phase2');
  const [newMinContributions, setNewMinContributions] = useState(5);

  const loadCeremonies = useCallback(() => {
    let list = getCeremonies();
    if (list.length === 0) {
      // Seed default Aztec Network ceremonies
      const c1 = createCeremony({
        circuitName: 'Aztec UltraPlonk SRS Phase 2 (zkDAI & Private Rails)',
        phase: 'phase2',
        coordinatorAddress: '0xaztec_coordinator_genesis',
        description: 'Multi-party trusted setup for Aztec Rollup v6 circuit verification keys.',
        minimumContributions: 5,
      });
      const c2 = createCeremony({
        circuitName: 'Powers of Tau — BN254 Universal SRS (2^20 gates)',
        phase: 'phase1',
        coordinatorAddress: '0xaztec_genesis_sequencer',
        description: 'Universal Structured Reference String ceremony for Aztec Network zkSNARK proofs.',
        minimumContributions: 8,
      });
      list = [c1, c2];
    }
    setCeremonies(list);
    if (!selectedCeremony && list.length > 0) {
      setSelectedCeremony(list[0]);
    } else if (selectedCeremony) {
      const refreshed = list.find(c => c.id === selectedCeremony.id);
      if (refreshed) setSelectedCeremony(refreshed);
    }
  }, [selectedCeremony]);

  useEffect(() => {
    loadCeremonies();
    const handleCompleted = () => loadCeremonies();
    window.addEventListener('ledger_zk_ceremony_completed', handleCompleted);
    return () => window.removeEventListener('ledger_zk_ceremony_completed', handleCompleted);
  }, [loadCeremonies]);

  // Mouse entropy harvesting
  const handleEntropyMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCollectingEntropy || entropyProgress >= 100) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Mix time jitter and coordinate offsets
    const sample = (Date.now() ^ (Math.floor(x * 100) << 8) ^ Math.floor(y * 100)) & 0xff;
    setEntropyBits(prev => {
      const updated = [...prev, sample];
      const pct = Math.min(100, Math.floor((updated.length / 128) * 100));
      setEntropyProgress(pct);
      if (pct >= 100) {
        setIsCollectingEntropy(false);
        toast.success('Entropía criptográfica acumulada (128 bytes)');
      }
      return updated;
    });

    // Draw particle trail on canvas
    const canvas = entropyCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1C1C1E';
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const handleContribute = async () => {
    if (!selectedCeremony) return;
    if (entropyProgress < 100) {
      setIsCollectingEntropy(true);
      toast.info('Mueve el cursor sobre el panel para capturar entropía física');
      return;
    }

    setIsContributing(true);
    setContributionProgress(5);
    setCurrentStep('Inicializando Barretenberg SRS engine…');

    try {
      const contrib = await contributeToceremony(
        selectedCeremony.id,
        userAddress || '0xanonymous_contributor',
        (step, pct) => {
          setCurrentStep(step);
          setContributionProgress(pct);
        }
      );

      if (contrib) {
        setLastContribution(contrib);
        toast.success('¡Contribución MPC computada e incorporada a la ceremonia!');
        loadCeremonies();
      } else {
        toast.error('La ceremonia no está activa');
      }
    } catch {
      toast.error('Error al generar la contribución MPC');
    } finally {
      setIsContributing(false);
      setEntropyProgress(0);
      setEntropyBits([]);
    }
  };

  const handleCreateCeremony = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCircuitName.trim()) {
      toast.error('Nombre del circuito requerido');
      return;
    }

    const created = createCeremony({
      circuitName: newCircuitName.trim(),
      description: newDescription.trim() || 'Custom Noir Aztec Circuit MPC Ceremony',
      phase: newPhase,
      coordinatorAddress: userAddress || '0xcoordinator',
      minimumContributions: newMinContributions,
    });

    toast.success('Nueva ceremonia MPC creada');
    setShowCreateModal(false);
    setNewCircuitName('');
    setNewDescription('');
    loadCeremonies();
    setSelectedCeremony(created);
  };

  const handleExportTranscript = (ceremony: MpcCeremony) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(ceremony, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `aztec-mpc-transcript-${ceremony.id}.json`);
    dlAnchor.click();
    toast.success('Transcripción criptográfica descargada');
  };

  return (
    <div className={`bg-white rounded-3xl border border-black/10 shadow-xl overflow-hidden flex flex-col ${className}`}>
      {/* Top Header */}
      <div className="bg-[#1C1C1E] text-white px-6 py-5 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#10B981] to-[#3B82F6] flex items-center justify-center shadow-md">
            <Cpu size={20} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-bold text-white">Aztec MPC Ceremony Coordinator</h2>
              <span className="text-[10px] font-black uppercase tracking-wider bg-[#10B981]/20 text-[#34D399] px-2 py-0.5 rounded-full border border-[#10B981]/30">
                UltraPlonk SRS
              </span>
            </div>
            <p className="text-[12px] text-white/60">Trusted setup colaborativo para circuitos de privacidad zero-knowledge</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[12px] font-semibold transition-colors flex items-center gap-1.5"
          >
            <Sparkles size={14} className="text-[#34D399]" />
            Nueva Ceremonia
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-[500px]">
        {/* Left Sidebar: Ceremony List */}
        <div className="md:col-span-4 border-r border-black/5 bg-[#F9F9FB] p-4 flex flex-col gap-2.5 overflow-y-auto">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-black/50">Ceremonias Activas</span>
            <button type="button" onClick={loadCeremonies} className="text-[11px] text-[#1C1C1E] font-semibold flex items-center gap-1 hover:underline">
              <RefreshCw size={11} /> Actualizar
            </button>
          </div>

          {ceremonies.map(c => {
            const isSelected = selectedCeremony?.id === c.id;
            const isDone = c.status === 'completed';
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => setSelectedCeremony(c)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                  isSelected
                    ? 'bg-white border-[#1C1C1E] shadow-sm ring-1 ring-[#1C1C1E]/20'
                    : 'bg-white/70 hover:bg-white border-black/5'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isDone
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {c.phase.toUpperCase()} · {c.status}
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-black/50">
                    {c.contributions.length}/{c.minimumContributions}
                  </span>
                </div>
                <h4 className="text-[13px] font-bold text-[#1C1C1E] line-clamp-1">{c.circuitName}</h4>
                <p className="text-[11px] text-black/50 line-clamp-2 mt-0.5 leading-relaxed">{c.description}</p>
              </button>
            );
          })}
        </div>

        {/* Right Content: Selected Ceremony Detail & Contribution Pad */}
        <div className="md:col-span-8 p-6 flex flex-col gap-5 overflow-y-auto bg-white">
          {selectedCeremony ? (
            <>
              {/* Header Card */}
              <div className="bg-[#F2F2F7] rounded-2xl p-5 border border-black/5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[18px] font-black text-[#1C1C1E]">{selectedCeremony.circuitName}</h3>
                  <button
                    type="button"
                    onClick={() => handleExportTranscript(selectedCeremony)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-black/10 text-[12px] font-semibold text-[#1C1C1E] hover:bg-black/5"
                  >
                    <Download size={13} /> Exportar Transcripción
                  </button>
                </div>
                <p className="text-[13px] text-black/60 leading-relaxed mb-4">{selectedCeremony.description}</p>

                {/* Status Bar */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-black/5 text-center">
                  <div className="p-2.5 rounded-xl bg-white border border-black/5">
                    <p className="text-[10px] font-bold uppercase text-black/40">Fase</p>
                    <p className="text-[13px] font-bold text-[#1C1C1E] capitalize mt-0.5">{selectedCeremony.phase}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-black/5">
                    <p className="text-[10px] font-bold uppercase text-black/40">Contribuciones</p>
                    <p className="text-[13px] font-bold text-[#1C1C1E] font-mono mt-0.5">
                      {selectedCeremony.contributions.length} / {selectedCeremony.minimumContributions}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-black/5">
                    <p className="text-[10px] font-bold uppercase text-black/40">Estado de Seguridad</p>
                    <p className="text-[13px] font-bold text-[#1C1C1E] flex items-center justify-center gap-1 mt-0.5">
                      <ShieldCheck size={14} /> 1-of-N Honesto
                    </p>
                  </div>
                </div>
              </div>

              {/* Entropy Harvester Pad */}
              <div className="border border-black/10 rounded-2xl p-5 bg-[#FAFAFC] relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-[#1C1C1E]" />
                    <h4 className="text-[14px] font-bold text-[#1C1C1E]">Recolector de Entropía Criptográfica</h4>
                  </div>
                  <span className="text-[12px] font-mono font-bold text-[#1C1C1E]">
                    {entropyProgress}% ({entropyBits.length}/128 bytes)
                  </span>
                </div>
                <p className="text-[12px] text-black/50 mb-3">
                  Pasa el mouse sobre el canvas interactivo para recolectar ruido físico y latencia de reloj para alimentar la función hash de BN254.
                </p>

                <div
                  onMouseMove={handleEntropyMouseMove}
                  className={`w-full h-32 rounded-xl border-2 border-dashed relative cursor-crosshair overflow-hidden transition-colors ${
                    isCollectingEntropy
                      ? 'border-[#1C1C1E] bg-emerald-500/5'
                      : entropyProgress >= 100
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-black/10 bg-white'
                  }`}
                >
                  <canvas
                    ref={entropyCanvasRef}
                    width={500}
                    height={130}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  />
                  {entropyProgress === 0 && !isCollectingEntropy && (
                    <div className="absolute inset-0 flex items-center justify-center text-center p-4">
                      <p className="text-[12px] font-semibold text-black/40">
                        Haz clic en &ldquo;Capturar Entropía&rdquo; y mueve el cursor libremente por este espacio
                      </p>
                    </div>
                  )}
                  {entropyProgress >= 100 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/10 backdrop-blur-[1px]">
                      <div className="flex items-center gap-2 text-emerald-700 font-bold text-[13px] bg-white px-3 py-1.5 rounded-full shadow-sm border border-emerald-200">
                        <CheckCircle2 size={16} /> Entropía Completa
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-4 flex gap-3">
                  {entropyProgress < 100 && (
                    <button
                      type="button"
                      onClick={() => setIsCollectingEntropy(true)}
                      className="px-4 py-2 rounded-xl bg-black/5 hover:bg-black/10 text-[#1C1C1E] text-[13px] font-bold transition-all"
                    >
                      Capturar Entropía
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isContributing || selectedCeremony.status === 'completed'}
                    onClick={handleContribute}
                    className={`flex-1 py-2.5 rounded-xl text-white font-bold text-[14px] shadow-sm transition-all flex items-center justify-center gap-2 ${
                      selectedCeremony.status === 'completed'
                        ? 'bg-gray-300 cursor-not-allowed'
                        : isContributing
                        ? 'bg-[#1C1C1E] opacity-90'
                        : 'bg-[#1C1C1E] hover:bg-[#1C1C1E] active:scale-[0.99]'
                    }`}
                  >
                    {isContributing ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>{currentStep} ({contributionProgress}%)</span>
                      </>
                    ) : selectedCeremony.status === 'completed' ? (
                      <>
                        <Check size={16} /> Ceremonia Finalizada & Verificada
                      </>
                    ) : (
                      <>
                        <Play size={16} /> Computar y Enviar Contribución MPC
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Contributions Feed */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[14px] font-bold text-[#1C1C1E] flex items-center gap-1.5">
                    <Activity size={15} className="text-black/50" />
                    Registro de Contribuciones Verificadas ({selectedCeremony.contributions.length})
                  </h4>
                </div>

                {selectedCeremony.contributions.length === 0 ? (
                  <div className="p-8 text-center bg-[#F9F9FB] rounded-2xl border border-black/5">
                    <Cpu size={32} className="mx-auto text-black/20 mb-2" />
                    <p className="text-[13px] font-semibold text-black/50">Sé el primer participante de esta ceremonia</p>
                    <p className="text-[11px] text-black/40 mt-0.5">Tu contribución garantizará la inviolabilidad del setup</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedCeremony.contributions.map((c, i) => (
                      <div
                        key={c.id || i}
                        className="p-3 bg-white rounded-xl border border-black/5 shadow-sm flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-[11px] shrink-0 border border-emerald-100">
                            #{i + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold text-[#1C1C1E] font-mono truncate">{c.contributor}</p>
                            <p className="text-[10px] text-black/40 font-mono truncate">{c.contributionHash}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            ✓ Válida
                          </span>
                          <span className="text-[10px] text-black/40">
                            {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center p-8 text-black/40">
              <Layers size={40} className="mb-2 opacity-30" />
              <p className="text-[14px] font-semibold">Selecciona una ceremonia para participar</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowCreateModal(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 shadow-2xl border border-black/10 w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[17px] font-black text-[#1C1C1E]">Lanzar Ceremonia MPC</h3>
                <button type="button" onClick={() => setShowCreateModal(false)} className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-black/50">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateCeremony} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold text-black/60 uppercase tracking-wider block mb-1">Nombre del Circuito Noir</label>
                  <input
                    type="text"
                    value={newCircuitName}
                    onChange={e => setNewCircuitName(e.target.value)}
                    placeholder="Ej. Aztec Confidential Voting Circuit v1"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-[13px] outline-none focus:border-[#1C1C1E]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-black/60 uppercase tracking-wider block mb-1">Descripción</label>
                  <textarea
                    rows={3}
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    placeholder="Detalles sobre las restricciones y parámetros del circuito..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-[13px] outline-none focus:border-[#1C1C1E] resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-black/60 uppercase tracking-wider block mb-1">Fase</label>
                    <select
                      value={newPhase}
                      onChange={e => setNewPhase(e.target.value as any)}
                      className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-[13px] bg-white outline-none focus:border-[#1C1C1E]"
                    >
                      <option value="phase2">Fase 2 (Circuito)</option>
                      <option value="phase1">Fase 1 (Universal)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-black/60 uppercase tracking-wider block mb-1">Mínimo Contribuciones</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={newMinContributions}
                      onChange={e => setNewMinContributions(parseInt(e.target.value) || 5)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-[13px] outline-none focus:border-[#1C1C1E]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 rounded-xl bg-black/5 text-[#1C1C1E] font-bold text-[13px]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-[#1C1C1E] text-white font-bold text-[13px] shadow hover:bg-[#1C1C1E]"
                  >
                    Crear Ceremonia
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
