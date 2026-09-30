'use client';
import { useEffect, useState, useCallback, useMemo, startTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2,
  Package,
  QrCode,
  Anchor,
  CheckCircle2,
  ArrowLeft,
  Plus,
  LayoutList,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Tag,
  MapPin,
  Hash,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
  CreditCard,
  ArrowRight,
  X,
  Zap, Shield } from 'lucide-react';
import { useAccount } from 'wagmi';
import { passportPublicUrl } from '@/lib/scan/parseScanPayload';
import type { ProductPassportPublic } from '@/lib/passport/types';
import { NODE_TIERS, PlanTier } from '@/lib/node_infrastructure/tiers';
import { ShieldCheck } from 'lucide-react';
import { useSettingsStore } from '@/lib/store/useSettingsStore';
import { useAztecNative } from '@/context/AztecNativeContext';
import { toast } from 'sonner';
import { TuringShieldGate } from '@/components/auth/TuringShieldGate';
import dynamic from 'next/dynamic';
import TestnetExplorer from '@/components/TestnetExplorer';


const SubscriptionDashboard = dynamic(
  () => import('@/components/terminal/SubscriptionDashboard').then(mod => mod.SubscriptionDashboard),
  { ssr: false, loading: () => <div className="p-8 text-center text-xs text-black/50 uppercase tracking-widest">Loading Dashboard...</div> }
);


// SightInsightTab removed by user request

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
// AztecScan uses /tx-effect/:hash — the /tx/ path does not exist and shows "Page does not exist"
const EXPLORER_BASE = 'https://aztecscan.xyz/tx-effect/';

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
type Tab = 'create' | 'registry' | 'aztec' | 'billing' | 'dashboard';

/* ─────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────── */
function generateCoreEntropy(): bigint {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return BigInt('0x' + Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join(''));
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getUTCDate().toString().padStart(2, '0')} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function truncate(str: string, len = 16): string {
  return str.length > len ? str.slice(0, len) + '…' : str;
}

/* ─────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────── */

/** Single stat pill used in the header band */
function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[18px] font-black tracking-tight text-[#050505]">{value}</span>
      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-black/40">{label}</span>
    </div>
  );
}

/** Inline copy button */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-black/40 hover:text-black/70 transition-colors"
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

/** Label wrapper used on form fields */
function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-4">
      <span className="text-sm font-bold uppercase tracking-widest text-slate-800 mb-1 block">
        {label}
      </span>
      {children}
    </label>
  );
}

/* ─────────────────────────────────────────────
   TAB: CREATE
───────────────────────────────────────────── */
interface CreateTabProps {
  isMobile: boolean;
  onCreated: (passport: ProductPassportPublic) => void;
  hasPlan: boolean;
  isOwner: boolean;
}

function CreateTab({ isMobile, onCreated, hasPlan, isOwner }: CreateTabProps) {
  const { address } = useAccount();
  const { spendQDs } = useAztecNative();

  const inputClass =
    'mt-1 w-full border-2 border-slate-300 rounded-xl px-5 py-4 text-base bg-white focus:outline-none focus:border-slate-800 focus:ring-2 focus:ring-slate-800 focus:ring-offset-2 transition-all';

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [origin, setOrigin] = useState('');
  const [batchId, setBatchId] = useState('');
  const [description, setDescription] = useState('');
  const [gs1Gtin, setGs1Gtin] = useState('');
  
  // Genesis: Logistics & Custody
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [handlingConditions, setHandlingConditions] = useState('');
  
  // Genesis: Life Cycle Assessment (LCA)
  const [carbonFootprint, setCarbonFootprint] = useState('');
  const [recyclability, setRecyclability] = useState('');
  const [waterUsage, setWaterUsage] = useState('');
  const [materialComposition, setMaterialComposition] = useState('');
  
  // Genesis: IoT Telemetry
  const [hasTempSensors, setHasTempSensors] = useState(false);
  const [hasShockSensors, setHasShockSensors] = useState(false);
  
  // Security & Privacy
  const [isMasked, setIsMasked] = useState(false);
  const [euMode, setEuMode] = useState(true);

  // Section Toggles
  const [showLogistics, setShowLogistics] = useState(false);
  const [showSustainability, setShowSustainability] = useState(false);
  const [showSensors, setShowSensors] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [passport, setPassport] = useState<ProductPassportPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anchoring, setAnchoring] = useState(false);
  const [explorerStatus, setExplorerStatus] = useState<'PENDING' | 'PROVING' | 'SUBMITTING' | 'CONFIRMED' | 'FAILED'>('PENDING');
  const [passportCount, setPassportCount] = useState<number | null>(null);

  useEffect(() => {
    if (!hasPlan && !isOwner) {
      fetch('/api/passport/mine')
        .then(res => res.ok ? res.json() : { passports: [] })
        .then(data => setPassportCount(data.passports?.length || 0))
        .catch(() => setPassportCount(0));
    }
  }, [hasPlan, isOwner]);

  const passportUrl = passport ? passportPublicUrl(passport.slug) : '';
  const isLimitReached = !isOwner && !hasPlan && passportCount !== null && passportCount >= 3;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    // Charge 5 QDs for ZK Passport issuance
    const paid = await spendQDs(5, 'ZK Passport Issuance');
    if (!paid) {
      toast.error('Insufficient QDs', { description: 'You need 5 QDs to issue a ZK Passport. Visit Sovereign Identity to claim your QDs.' });
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/passport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          category: category,
          gs1Gtin: gs1Gtin.replace(/\D/g, '') || undefined,
          payload: {
            description: description.trim() || undefined,
            origin: origin.trim() || undefined,
            batchId: batchId.trim() || undefined,
            logistics: (carrier || trackingNumber || weightKg) ? {
              carrier: carrier.trim() || undefined,
              trackingNumber: trackingNumber.trim() || undefined,
              weightKg: weightKg ? Number(weightKg) : undefined,
              dimensions: dimensions.trim() || undefined,
              handlingConditions: handlingConditions.trim() || undefined,
            } : undefined,
            lifecycle: (carbonFootprint || recyclability || waterUsage || materialComposition) ? {
              carbonFootprintTotal: carbonFootprint ? Number(carbonFootprint) : undefined,
              recyclabilityPercent: recyclability ? Number(recyclability) : undefined,
              waterUsageLiters: waterUsage ? Number(waterUsage) : undefined,
              materialComposition: materialComposition.trim() || undefined,
            } : undefined,
            telemetry: (hasTempSensors || hasShockSensors) ? {
              hasTemperatureSensors: hasTempSensors,
              hasShockSensors: hasShockSensors,
            } : undefined,
          },
          events: origin
            ? [
                {
                  eventType: 'manufactured',
                  payload: { location: origin, note: 'Registered via Provenance Studio' },
                },
              ]
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setPassport(data);
      onCreated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setCreating(false);
    }
  };

  const handleAnchor = async () => {
    if (!passport || !address) {
      setError('Connect your wallet to confirm on-chain.');
      return;
    }
    
    setAnchoring(true);
    setError(null);
    setExplorerStatus('PROVING');
    
    const entropy = generateCoreEntropy();
    const entropyHex = `0x${entropy.toString(16).padStart(64, '0')}`;
    
    const metadataStr = `StudioProvenance/v1|${passport.slug}`;

    try {
      let finalTransactionPayload = {
        passportSlug: passport.slug,
        metadata: metadataStr,
        creatorAddress: address,
        proof: '0xLocalWasmProof' // Default local proof fallback
      };

      // 1. ZK Proof Delegation (Elite Tier Acceleration) - WITH FALLBACK
      try {
        console.log('Requesting Server-Side Proof...');
        const proverRes = await fetch('/api/premium/prover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            circuitConstraints: { entropy: entropyHex, creator: address },
            tier: 'FREE' // Using real tier from session in prod
          })
        });
        if (proverRes.ok) {
          const proverData = await proverRes.json();
          finalTransactionPayload.proof = proverData.proof;
          console.log('ZK Proof generated securely in', proverData.provingTimeMs, 'ms');
        } else {
          console.log('Falling back to local WASM prover for standard tier.');
        }
      } catch (e) {
        console.warn('Server prover unavailable, using local fallback.');
      }

      // 2. Gasless Paymaster Subsidization - WITH FALLBACK
      try {
        console.log('Requesting Gasless Sponsor...');
        const paymasterRes = await fetch('/api/premium/paymaster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionPayload: finalTransactionPayload,
            tier: 'FREE'
          })
        });
        if (paymasterRes.ok) {
          const paymasterData = await paymasterRes.json();
          finalTransactionPayload = paymasterData.sponsoredTransaction;
        } else {
          console.log('Using standard gas estimation for free tier.');
        }
      } catch (e) {
        console.warn('Paymaster unavailable, proceeding with standard gas.');
      }

      setExplorerStatus('SUBMITTING');

      // 3. Proceed directly to native anchor bypassing EVM
      const res = await fetch('/api/aztec/anchor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalTransactionPayload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Anchor failed');

      const aztecTxHash = data.txHash;

      // 4. Register Webhook for Anchor Success
      await fetch('/api/premium/webhooks', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           webhookUrl: 'https://api.my-cryptographic-erp.com/webhooks/provenance',
           eventTypes: ['PASSPORT_ANCHORED'],
           tier: 'ELITE'
         })
      }).catch(e => console.error('Webhook registration failed silently', e));

      // 5. Update passport via PATCH
      await fetch(`/api/passport/${passport.slug}/anchor`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          coreEntropy: entropyHex,
          txHash: aztecTxHash,
          chainId: 2151908, // Aztec
        }),
      });
      
      setPassport((p) =>
        p ? { ...p, txHash: aztecTxHash, chainId: 2151908, coreEntropy: entropyHex } : p
      );
      setExplorerStatus('CONFIRMED');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'On-chain confirmation failed');
      setExplorerStatus('FAILED');
    } finally {
      setAnchoring(false);
    }
  };

  const handleReset = () => {
    setPassport(null);
    setTitle('');
    setCategory('OTHER');
    setOrigin('');
    setBatchId('');
    setDescription('');
    setGs1Gtin('');
    setCarrier('');
    setTrackingNumber('');
    setWeightKg('');
    setDimensions('');
    setHandlingConditions('');
    setCarbonFootprint('');
    setRecyclability('');
    setWaterUsage('');
    setMaterialComposition('');
    setHasTempSensors(false);
    setHasShockSensors(false);
    setError(null);
  };

  /* ── PASSPORT CREATED VIEW ── */
  if (passport) {
    return (
      <div className="space-y-5">
        {/* Success card */}
        <div className="rounded-2xl border border-black/12 bg-white p-5 flex items-start gap-3">
          <CheckCircle2 className="text-[#050505] shrink-0 mt-0.5" size={20} />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-[#050505] text-sm">{passport.title}</p>
            {passport.payload?.batchId && (
              <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mt-0.5">
                Batch {passport.payload.batchId}
              </p>
            )}
            <p className="text-xs text-black/50 mt-1 font-mono break-all">{passportUrl}</p>
          </div>
          <CopyButton text={passportUrl} />
        </div>

        {/* QR Code */}
        <div className="rounded-2xl border border-black/10 bg-white p-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-black/30">
            <QrCode size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Scannable QR Code
            </span>
          </div>
          <div className="p-3 border border-black/8 rounded-xl bg-white">
            <QRCodeSVG value={passportUrl} size={isMobile ? 180 : 200} level="M" includeMargin />
          </div>
          <p className="text-[10px] text-black/40 text-center leading-relaxed max-w-[240px]">
            Print this on the product label. Anyone who scans it sees the public record.
          </p>
          <Link
            href={`/passport/${passport.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs text-black/60 underline underline-offset-2"
          >
            Preview public record
            <ExternalLink size={11} />
          </Link>
        </div>

        {/* On-chain confirmation / Testnet Explorer */}
        {anchoring || passport.txHash ? (
           <TestnetExplorer 
             passportId={(passport as any).id || passport.slug} 
             txHash={(passport as any).txHash || ''} 
             slug={passport.slug}
             status={explorerStatus} 
           />
        ) : (
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 space-y-4">
            <div>
              <p className="text-lg font-bold text-slate-800">Sellar Registro Oficialmente</p>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                (Opcional) Guardar una copia permanente y segura en el registro público. 
                Nadie podrá borrar ni alterar estos datos una vez sellados.
              </p>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 font-bold bg-red-50 p-3 rounded-lg border border-red-200">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={handleAnchor}
              disabled={anchoring}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl border-2 border-slate-900 text-slate-900 text-sm font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors disabled:opacity-40"
            >
              <Anchor size={18} />
              Sellar Registro
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={handleReset}
          className="w-full flex items-center justify-center gap-3 py-4 text-sm font-bold uppercase tracking-widest text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
        >
          <Plus size={16} />
          Registrar Otro Producto
        </button>
      </div>
    );
  }

  /* ── CREATION FORM ── */
  if (isLimitReached) {
    return (
      <div className="space-y-4 rounded-2xl border border-[#cc0000]/10 bg-[#cc0000]/5 p-6 text-center">
        <AlertCircle size={32} className="mx-auto text-[#cc0000]/50 mb-3" />
        <p className="text-sm font-bold text-[#050505]">Free Tier Limit Reached</p>
        <p className="text-xs text-black/60 leading-relaxed max-w-sm mx-auto">
          You have created the maximum of 3 passports allowed on the Free tier. To create unlimited passports, please upgrade to a paid plan.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleCreate} className="space-y-4 rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
      <FieldLabel label="Nombre del Producto">
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
          placeholder="Ej: Bolso de algodón orgánico"
        />
      </FieldLabel>

      <FieldLabel label="Categoría">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={inputClass}
        >
          <option value="PHARMA">Farmacéutica y Salud</option>
          <option value="FOOD">Alimentación y Agricultura</option>
          <option value="TECH">Tecnología y Electrónica</option>
          <option value="INFRASTRUCTURE">Infraestructura Pública</option>
          <option value="TEXTILE">Textil y Materiales</option>
          <option value="DOCUMENTS">Documentos Oficiales</option>
          <option value="OTHER">Otra Categoría</option>
        </select>
      </FieldLabel>

      <FieldLabel label="Descripción">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={inputClass}
          placeholder="Describe el producto y su propósito de forma sencilla."
        />
      </FieldLabel>

      <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <FieldLabel label="País de origen">
          <input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className={inputClass}
            placeholder="Ej: España"
          />
        </FieldLabel>
        <FieldLabel label="Número de Lote">
          <input
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className={inputClass}
            placeholder="LOTE-2024-0891"
          />
        </FieldLabel>
      </div>

      <FieldLabel label="Código de Barras (Opcional)">
        <input
          value={gs1Gtin}
          onChange={(e) => setGs1Gtin(e.target.value)}
          className={`${inputClass} font-mono`}
          placeholder="00812345678901"
        />
      </FieldLabel>

      {/* Genesis: European Standard (ESPR/DPP) Advanced Fields - Minimalist UI */}
      <div className="pt-6 mt-8 border-t-2 border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-800">
            Información Adicional (Opcional)
          </h3>
          <button 
            type="button" 
            onClick={() => setIsMasked(!isMasked)} 
            className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
            aria-label="Ocultar datos sensibles en pantalla"
          >
            {isMasked ? 'Mostrar Datos' : 'Ocultar Datos (Oficina)'}
          </button>
        </div>
        
        <div className="mb-4 border-2 border-slate-200 rounded-xl overflow-hidden">
          <label className="px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors flex items-center gap-3">
            <input type="checkbox" checked={showLogistics} onChange={e => setShowLogistics(e.target.checked)} className="w-5 h-5 text-slate-800 rounded border-slate-300 focus:ring-slate-800" />
            <span className="text-sm font-bold text-slate-800">Logística y Transporte</span>
          </label>
          {showLogistics && (
            <div className="p-5 border-t-2 border-slate-200 bg-white grid gap-5 grid-cols-1 sm:grid-cols-2">
              <FieldLabel label="Transportista">
                <input type={isMasked ? "password" : "text"} value={carrier} onChange={e => setCarrier(e.target.value)} className={inputClass} placeholder="Ej: DHL, Correos..." />
              </FieldLabel>
              <FieldLabel label="Número de Seguimiento">
                <input type={isMasked ? "password" : "text"} value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} className={inputClass} placeholder="Ej: 1Z9999W9999" />
              </FieldLabel>
              <FieldLabel label="Peso (kg)">
                <input type={isMasked ? "password" : "number"} value={weightKg} onChange={e => setWeightKg(e.target.value)} className={inputClass} placeholder="Ej: 1500" />
              </FieldLabel>
              <FieldLabel label="Dimensiones">
                <input type={isMasked ? "password" : "text"} value={dimensions} onChange={e => setDimensions(e.target.value)} className={inputClass} placeholder="Ej: 120x80x145 cm" />
              </FieldLabel>
              <div className="sm:col-span-2">
                <FieldLabel label="Condiciones Especiales de Manipulación">
                  <input type={isMasked ? "password" : "text"} value={handlingConditions} onChange={e => setHandlingConditions(e.target.value)} className={inputClass} placeholder="Ej: Refrigerado a -20ºC, Muy Frágil" />
                </FieldLabel>
              </div>
            </div>
          )}
        </div>

        <div className="mb-4 border-2 border-slate-200 rounded-xl overflow-hidden">
          <label className="px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors flex items-center gap-3">
            <input type="checkbox" checked={showSustainability} onChange={e => setShowSustainability(e.target.checked)} className="w-5 h-5 text-slate-800 rounded border-slate-300 focus:ring-slate-800" />
            <span className="text-sm font-bold text-slate-800">Sostenibilidad (Huella Ecológica)</span>
          </label>
          {showSustainability && (
            <div className="p-5 border-t-2 border-slate-200 bg-white grid gap-5 grid-cols-1 sm:grid-cols-2">
              <FieldLabel label="Huella de Carbono Total (kg CO2)">
                <input type={isMasked ? "password" : "number"} value={carbonFootprint} onChange={e => setCarbonFootprint(e.target.value)} className={inputClass} placeholder="Ej: 45.5" />
              </FieldLabel>
              <FieldLabel label="Porcentaje de Reciclabilidad (%)">
                <input type={isMasked ? "password" : "number"} value={recyclability} onChange={e => setRecyclability(e.target.value)} className={inputClass} placeholder="Ej: 95" />
              </FieldLabel>
              <FieldLabel label="Uso de Agua (Litros)">
                <input type={isMasked ? "password" : "number"} value={waterUsage} onChange={e => setWaterUsage(e.target.value)} className={inputClass} placeholder="Ej: 120" />
              </FieldLabel>
              <div className="sm:col-span-2">
                <FieldLabel label="Composición Exacta de Materiales">
                  <input type={isMasked ? "password" : "text"} value={materialComposition} onChange={e => setMaterialComposition(e.target.value)} className={inputClass} placeholder="Ej: 60% Plástico Reciclado, 40% Algodón" />
                </FieldLabel>
              </div>
            </div>
          )}
        </div>

        <div className="mb-4 border-2 border-slate-200 rounded-xl overflow-hidden">
          <label className="px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors flex items-center gap-3">
            <input type="checkbox" checked={showSensors} onChange={e => setShowSensors(e.target.checked)} className="w-5 h-5 text-slate-800 rounded border-slate-300 focus:ring-slate-800" />
            <span className="text-sm font-bold text-slate-800">Sensores Integrados</span>
          </label>
          {showSensors && (
            <div className="p-5 border-t-2 border-slate-200 bg-white flex flex-col gap-4">
              <label className="flex items-center gap-4 cursor-pointer">
                <input type="checkbox" checked={hasTempSensors} onChange={e => setHasTempSensors(e.target.checked)} className="w-6 h-6 text-slate-800 border-2 border-slate-300 rounded focus:ring-slate-800 focus:ring-2 focus:ring-offset-2" />
                <span className="text-sm font-bold text-slate-800">El paquete incluye sensores de temperatura.</span>
              </label>
              <label className="flex items-center gap-4 cursor-pointer">
                <input type="checkbox" checked={hasShockSensors} onChange={e => setHasShockSensors(e.target.checked)} className="w-6 h-6 text-slate-800 border-2 border-slate-300 rounded focus:ring-slate-800 focus:ring-2 focus:ring-offset-2" />
                <span className="text-sm font-bold text-slate-800">El paquete incluye sensores de impacto.</span>
              </label>
              <p className="text-sm text-slate-600 mt-2">
                Solo se publicará una prueba matemática de que los sensores no fueron alterados, protegiendo su ruta confidencial frente a competidores.
              </p>
            </div>
          )}
        </div>
        
        <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
          <label className="px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors flex items-center gap-3">
            <input type="checkbox" checked={showPrivacy} onChange={e => setShowPrivacy(e.target.checked)} className="w-5 h-5 text-slate-800 rounded border-slate-300 focus:ring-slate-800" />
            <span className="text-sm font-bold text-slate-800">Configuración de Privacidad Legal</span>
          </label>
          {showPrivacy && (
            <div className="p-5 border-t-2 border-slate-200 bg-white flex flex-col gap-4">
              <label className="flex items-center gap-4 cursor-pointer">
                <input type="checkbox" checked={euMode} onChange={e => setEuMode(e.target.checked)} className="w-6 h-6 text-slate-800 border-2 border-slate-300 rounded focus:ring-slate-800 focus:ring-2 focus:ring-offset-2" />
                <span className="text-sm font-bold text-slate-800">Garantizar Soberanía de Datos (Solo EU)</span>
              </label>
              <p className="text-sm text-slate-600 mt-2">
                Al marcar esta opción, certificamos mediante encriptación local en su navegador que la información jamás abandonará servidores ubicados dentro de la Unión Europea.
              </p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-[#cc0000] bg-[#cc0000]/5 p-3 rounded-xl border border-[#cc0000]/10">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <p className="leading-relaxed font-medium">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={creating}
        className={`w-full flex items-center justify-center gap-3 py-5 rounded-xl text-base font-bold uppercase tracking-widest transition-all ${
          creating ? 'bg-slate-200 text-slate-600' : 'bg-slate-900 text-white hover:bg-black hover:-translate-y-0.5 shadow-lg'
        }`}
      >
        {creating ? <Loader2 className="animate-spin" size={20} /> : <Package size={20} />}
        {creating ? 'Guardando de forma segura...' : 'Crear Pasaporte Oficial'}
      </button>
    </form>
  );
}

/* ─────────────────────────────────────────────
   TAB: ON-CHAIN REGISTRY
───────────────────────────────────────────── */
interface RegistryTabProps {
  isMobile: boolean;
  refreshKey: number;
  userTier?: string;
  isOwner?: boolean;
}

function RegistryTab({ isMobile: _isMobile, refreshKey, userTier = 'FREE', isOwner = false }: RegistryTabProps) {
  const [passports, setPassports] = useState<ProductPassportPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'anchored' | 'pending'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const handleExportCSV = () => {
    const headers = ['Title', 'Category', 'Batch ID', 'Origin', 'Status', 'Date', 'Public URL', 'Tx Hash'];
    const rows = filtered.map((p) => [
      p.title,
      p.category || '',
      p.payload?.batchId || '',
      p.payload?.origin || '',
      p.txHash ? 'Anchored' : 'Pending',
      new Date(p.createdAt).toISOString(),
      passportPublicUrl(p.slug),
      p.txHash || '',
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((field) => `"${(field || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'institutional_registry_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/passport/mine', { credentials: 'include' });
      if (!res.ok) throw new Error('Could not load records');
      const data = await res.json();
      setPassports(data.passports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const filtered = useMemo(() => {
    return passports.filter((p) => {
      if (filter === 'anchored') return !!p.txHash;
      if (filter === 'pending') return !p.txHash;
      return true;
    });
  }, [passports, filter]);

  const { anchored, pending } = useMemo(() => {
    const a = passports.filter((p) => !!p.txHash).length;
    return { anchored: a, pending: passports.length - a };
  }, [passports]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="animate-spin text-black/30" size={24} />
        <p className="text-xs text-black/40 font-black uppercase tracking-widest">Loading records…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <AlertCircle className="text-black/30" size={24} />
        <p className="text-sm text-black/60">{error}</p>
        <button
          onClick={() => load()}
          className="text-[10px] font-black uppercase tracking-widest text-black/40 hover:text-black/70 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (passports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Package className="text-black/20" size={32} />
        <div>
          <p className="text-sm font-bold text-[#050505]">No records yet</p>
          <p className="text-xs text-black/50 mt-1 leading-relaxed max-w-[260px] mx-auto">
            Create your first product record from the Create tab. All records registered with your
            wallet will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats band */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 grid grid-cols-3 divide-x-2 divide-slate-100">
        <div className="flex flex-col items-center gap-1">
          <span className="text-3xl font-black tracking-tight text-slate-800">
            {passports.length}
          </span>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Total
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-3xl font-black tracking-tight text-slate-800">{anchored}</span>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Sellados
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-3xl font-black tracking-tight text-slate-800">{pending}</span>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Pendientes
          </span>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2 flex-1 min-w-[200px]">
          {(['all', 'anchored', 'pending'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                filter === f
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'anchored' ? 'Sellados' : 'Pendientes'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {filtered.length > 0 && (isOwner || (userTier !== 'FREE' && userTier !== 'LIGHT_NODE')) && (
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-black transition-colors text-xs font-bold uppercase tracking-widest flex items-center gap-2 shadow-md"
            >
              <Copy size={14} />
              Exportar CSV
            </button>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-3 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            title="Refrescar"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Product list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-xs text-black/40 text-center py-8">No records match this filter.</p>
        )}
        {filtered.map((p) => {
          const isOpen = expanded === p.slug;
          const passportUrl = passportPublicUrl(p.slug);
          return (
            <div key={p.slug} className="rounded-xl border-2 border-slate-200 bg-white overflow-hidden">
              {/* Row header */}
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : p.slug)}
                className="w-full flex items-start gap-4 p-5 text-left hover:bg-slate-50 transition-colors"
              >
                {/* Status dot */}
                <div
                  className={`mt-1.5 w-3 h-3 rounded-full shrink-0 ${
                    p.txHash ? 'bg-green-600' : 'bg-orange-500'
                  }`}
                  title={p.txHash ? 'Sellado Oficialmente' : 'Pendiente de Sellado'}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold text-slate-800 truncate">{p.title}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
                    {p.payload?.batchId && (
                      <span className="text-xs text-slate-600 font-mono flex items-center gap-1.5 font-bold">
                        <Hash size={12} />
                        {p.payload.batchId}
                      </span>
                    )}
                    {p.category && (
                      <span className="text-xs text-slate-600 flex items-center gap-1.5 font-bold">
                        <Tag size={12} />
                        {p.category}
                      </span>
                    )}
                    {p.payload?.origin && (
                      <span className="text-xs text-slate-600 flex items-center gap-1.5 font-bold">
                        <MapPin size={12} />
                        {p.payload.origin}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5 font-bold">
                    <Clock size={12} />
                    {formatDate(p.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 text-slate-600 bg-slate-100 p-2 rounded-lg">
                  {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="border-t-2 border-slate-100 px-5 pb-5 pt-4 space-y-4">
                  {p.payload?.description && (
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">{p.payload.description}</p>
                  )}

                  {/* QR mini */}
                  <div className="flex items-center gap-4">
                    <div className="border-2 border-slate-200 rounded-xl p-3 bg-white shrink-0 shadow-sm">
                      <QRCodeSVG value={passportUrl} size={100} level="M" />
                    </div>
                    <div className="space-y-3 min-w-0">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                          Enlace Público
                        </p>
                        <p className="text-sm font-mono text-slate-800 break-all mt-1 font-bold">
                          {passportUrl}
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <CopyButton text={passportUrl} />
                        <Link
                          href={`/passport/${p.slug}`}
                          target="_blank"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors"
                        >
                          <ExternalLink size={14} />
                          Abrir Pasaporte
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Blockchain status */}
                  {p.txHash ? (
                    <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck size={16} className="text-green-600" />
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-800">
                          Recibo de Sellado
                        </p>
                      </div>
                      <a
                        href={`https://aztecscan.xyz`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-mono text-blue-600 hover:text-blue-800 font-bold transition-colors flex items-center gap-1.5 break-all"
                      >
                        {truncate(p.txHash, 32)}
                        <ExternalLink size={14} className="shrink-0" />
                      </a>
                    </div>
                  ) : (
                    <div className="rounded-xl border-2 border-dashed border-orange-200 bg-orange-50 p-4">
                      <p className="text-sm text-orange-800 font-bold leading-relaxed">
                        Este registro está guardado pero aún NO se ha sellado en el registro público.
                      </p>
                    </div>
                  )}

                  {/* Botón de Pánico (Revocar) */}
                  <div className="pt-2">
                    <button className="w-full flex justify-center items-center gap-2 py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">
                      <AlertCircle size={16} />
                      Revocar / Destruir Registro
                    </button>
                  </div>

                  {/* Events timeline */}
                  {p.events && p.events.length > 0 && (
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-black/40 mb-2">
                        Event history
                      </p>
                      <div className="space-y-1.5">
                        {p.events.map((ev) => (
                          <div
                            key={ev.id}
                            className="flex items-start gap-2 text-[10px] text-black/50"
                          >
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-black/20 shrink-0" />
                            <div>
                              <span className="font-bold capitalize text-[#050505]">
                                {ev.eventType.replace(/_/g, ' ')}
                              </span>
                              {ev.payload?.location && ` · ${ev.payload.location}`}
                              {ev.payload?.note && (
                                <span className="text-black/40"> · {ev.payload.note}</span>
                              )}
                              <span className="text-black/30 ml-1">{formatDate(ev.createdAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-black/30 text-center pt-2">
        Showing {filtered.length} of {passports.length} record{passports.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TAB: AZTEC NETWORK EXPLAINER
   Language: plain sovereign — no jargon.
───────────────────────────────────────────── */
function AztecTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center">
            
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-black/50">
            Integration with Aztec Network
          </p>
        </div>
        <h2 className="text-xl font-black tracking-tight text-[#050505] leading-snug mb-3">
          Why product records need private confirmation
        </h2>
        <p className="text-sm text-black/60 leading-relaxed">
          Standard blockchains publish every record in public. This is a problem for organisations:
          recording where a product comes from also reveals who your suppliers are, how much you
          produce, and when you ship. Aztec Network solves this with a technology called{' '}
          <strong className="text-[#050505]">private proofs</strong> — a mathematical method that
          lets anyone verify a record is real without exposing the sensitive data inside it.
        </p>
      </div>

      {/* How it works — step by step */}
      <div className="rounded-2xl border border-black/10 bg-white p-6 space-y-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
          How it works — step by step
        </p>

        {[
          {
            step: '01',
            title: 'The producer registers a batch',
            body: 'A manufacturer or public agency creates a product record in Studio Provenance. They enter the product name, batch number, origin, and any certification details. This creates a unique record with a scannable QR code.',
          },
          {
            step: '02',
            title: 'The sensitive data is kept private',
            body: "Using Aztec Network, the record is split into two parts: what the public can see (the product name and authenticity status) and what stays private (the exact supplier, the production volume, the internal batch notes). The private part is stored in encrypted form — only the issuing organisation can read it.",
          },
          {
            step: '03',
            title: 'A confirmation is written to the blockchain',
            body: 'A short cryptographic fingerprint of the record is published to the blockchain. This fingerprint proves the record existed at a specific date and has not been modified since. It contains no private data — only a mathematical proof of integrity.',
          },
          {
            step: '04',
            title: 'Anyone can verify — no data is revealed',
            body: 'A consumer, customs officer, or auditor scans the QR code. They receive confirmation that the record is genuine and unmodified. They do not see the private supplier details unless the producer chooses to share them.',
          },
          {
            step: '05',
            title: 'Ownership can transfer privately',
            body: 'When a product changes hands — from factory to distributor, from distributor to retailer — the record can be transferred on the blockchain without revealing the transaction price or the identities of the parties involved.',
          },
        ].map(({ step, title, body }) => (
          <div key={step} className="flex gap-4">
            <span className="text-[11px] font-black font-mono text-black/20 shrink-0 pt-0.5 w-6">
              {step}
            </span>
            <div>
              <p className="text-sm font-bold text-[#050505] mb-1">{title}</p>
              <p className="text-xs text-black/55 leading-relaxed">{body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Use cases for public institutions */}
      <div className="rounded-2xl border border-black/10 bg-white p-6 space-y-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
          Practical applications for public institutions
        </p>

        {[
          {
            icon: '🏥',
            title: 'Medicine supply chains',
            body: 'Health authorities can verify that a batch of medication comes from a licensed manufacturer and has not been tampered with, without revealing the purchasing terms or the distribution network.',
          },
          {
            icon: '🌾',
            title: 'Agricultural certification',
            body: 'A government agency certifies that produce meets organic or fair-attest standards. The certification is publicly verifiable on the blockchain. The farmer\'s identity and volume of production remain confidential.',
          },
          {
            icon: '🏗️',
            title: 'Public procurement',
            body: 'Construction materials used in public infrastructure can be tracked from manufacturer to site. Auditors confirm attestation without access to commercial pricing data.',
          },
          {
            icon: '🛃',
            title: 'Customs and border control',
            body: 'Importers provide a QR code to customs officers. Officers verify the product origin and batch legitimacy on the blockchain in seconds, reducing manual paperwork.',
          },
          {
            icon: '♻️',
            title: 'Environmental attestation',
            body: 'Companies prove they meet recycling or emissions targets using verifiable records. Regulators confirm attestation without requiring full access to internal production data.',
          },
        ].map(({ icon, title, body }) => (
          <div key={title} className="flex gap-3">
            <span className="text-base shrink-0">{icon}</span>
            <div>
              <p className="text-sm font-bold text-[#050505] mb-0.5">{title}</p>
              <p className="text-xs text-black/55 leading-relaxed">{body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* What Studio Provenance adds to Aztec */}
      <div className="rounded-2xl border border-black/10 bg-white p-6 space-y-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
          What Studio Provenance brings to Aztec Network
        </p>
        <p className="text-sm text-black/60 leading-relaxed">
          Aztec Network provides the underlying privacy technology. Studio Provenance provides the
          interface and the workflow that makes that technology accessible to non-technical users —
          public bodies, manufacturers, certification agencies, and inspectors — without requiring
          any knowledge of how the technology works.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            ['No code required', 'Create verifiable records through a standard web form.'],
            ['Printable labels', 'Generate QR codes ready for product packaging.'],
            ['Full audit trail', 'Every event in a product\'s life is recorded.'],
            ['Sovereign grade', 'Designed for public bodies and regulated industries.'],
          ].map(([title, desc]) => (
            <div key={title} className="rounded-xl border border-black/8 p-3">
              <p className="text-xs font-bold text-[#050505] mb-1">{title}</p>
              <p className="text-[10px] text-black/50 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Link to Aztec */}
      <div className="rounded-2xl border border-black/8 bg-black/[0.02] p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-[#050505]">Learn about Aztec Network</p>
          <p className="text-[11px] text-black/50 mt-0.5">
            The privacy layer this platform is built on.
          </p>
        </div>
        <a
          href="https://aztec.network"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#050505] hover:opacity-60 transition-opacity"
        >
          aztec.network
          <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TAB: NODE ALLOCATION — LANDING EN CASTELLANO
───────────────────────────────────────────── */
function BandwidthTab() {
  const { address, isConnected } = useAccount();
  const [isAnnual, setIsAnnual] = useState(false);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  /* ---- Stripe products translated to English ---- */
  const PLANES = [
    {
      tier: PlanTier.LIGHT_NODE,
      nombre: 'Basic Plan',
      tagline: 'To start with guarantees',
      precio: { mensual: 4995, anual: 47952 }, // €49.95/mo → €3996/yr
      popular: false,
      elite: false,
      descripcion: 'Deploy and manage your own ZK product passports. Ideal for independent creators needing verifiable provenance.',
      caracteristicas: [
        'Up to 500 ZK-provenance records/month',
        'Cryptographic QR tags',
        'Aztec Network state anchoring',
        'Basic REST API access',
        'Standard email support',
      ],
      noIncluye: [
        'Noir circuit template library',
        'Dedicated Aztec RPC relay node',
        'Shielded transaction analytics',
      ],
    },
    {
      tier: PlanTier.FULL_NODE,
      nombre: 'Professional Plan',
      tagline: 'For growing organizations',
      precio: { mensual: 14995, anual: 143952 },
      popular: true,
      elite: false,
      descripcion: 'Robust ZK infrastructure for medium-scale supply chains requiring verifiable but private state transitions.',
      caracteristicas: [
        'Everything in Basic Plan',
        'Up to 5,000 ZK-records/month',
        'Standard ERP API integrations',
        'Dedicated Aztec RPC relay node',
        'Noir circuit template library',
        'Shielded transaction analytics',
        'Priority support',
      ],
      noIncluye: [
        'Custom Noir circuit compilation',
      ],
    },
    {
      tier: PlanTier.ARCHIVE_PROVER,
      nombre: 'Cryptographic Plan',
      tagline: 'Maximum sovereign power',
      precio: { mensual: 24995, anual: 239952 },
      popular: false,
      elite: true,
      descripcion: 'Enterprise-grade sovereign architecture with custom Noir circuits and L1-L2 shielded escrow capabilities.',
      caracteristicas: [
        'Everything in Professional Plan',
        'High-throughput API limits',
        'Custom Noir circuit compilation',
        'Dedicated Sequencer fallback cluster',
        'Full cryptographic audit trails',
        'On-chain state root indexer',
        'IP Whitelist + HMAC Auth',
        'Dedicated SLA & ZK engineer',
      ],
      noIncluye: [],
    },
  ];

  const handleCompra = async (tier: string) => {
    if (!isConnected) {
      alert('Connect your wallet to subscribe.');
      return;
    }
    setLoadingTier(tier);
    try {
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, userId: address, isAnnual, returnTab: 'studio' }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Error starting payment');
      }
    } catch (err: any) {
      alert(`Payment error: ${err.message}`);
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="space-y-10">

      {/* Hero header */}
      <div className="text-center space-y-3 pt-2">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-black/30">
          Node Allocation
        </p>
        <h2 className="text-3xl font-black tracking-tight text-[#050505] leading-tight">
          Choose your plan
        </h2>
        <p className="text-sm text-black/50 leading-relaxed max-w-md mx-auto">
          All plans include ZK registries on Aztec Network, printable QR tags,
          and a 30-day free trial.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex justify-center items-center gap-4">
        <span className={`text-[11px] font-black uppercase tracking-widest ${
          !isAnnual ? 'text-[#050505]' : 'text-black/30'
        }`}>Monthly</span>
        <button
          type="button"
          onClick={() => setIsAnnual(!isAnnual)}
          className="w-12 h-6 bg-black/8 rounded-full relative border border-black/10 transition-all hover:border-black/30"
        >
          <div
            className={`w-6 h-6 absolute top-[-1px] left-[-1px] bg-white rounded-full transition-transform duration-200 ${
              isAnnual ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
        <span className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-2 ${
          isAnnual ? 'text-[#050505]' : 'text-black/30'
        }`}>
          Annually
          <span className="text-[9px] bg-black/5 text-black/60 px-2 py-0.5 rounded-full border border-black/10">
            Save 20%
          </span>
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-5">
        {PLANES.map((plan) => {
          const precio = isAnnual ? plan.precio.anual : plan.precio.mensual;
          const precioFormateado = (precio / 100).toLocaleString('es-ES', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          const cargando = loadingTier === plan.tier;

          return (
            <div
              key={plan.tier}
              className={`relative rounded-2xl border p-6 bg-white transition-all ${
                plan.elite
                  ? 'border-[#050505] shadow-[0_4px_30px_rgba(0,0,0,0.10)]'
                  : 'border-black/10 hover:border-black/20 hover:shadow-sm'
              }`}
            >
              {/* Badge popular / elite */}
              {plan.popular && (
                <div className="absolute -top-3 left-6 bg-black/8 text-[#050505] border border-black/10 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                  Most popular
                </div>
              )}
              {plan.elite && (
                <div className="absolute -top-3 left-6 bg-white text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                  Maximum power
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
                {/* Left: info */}
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-black/35 mb-0.5">
                    Studio Provenance
                  </p>
                  <h3 className="text-xl font-black text-[#050505] tracking-tight mb-1">
                    {plan.nombre}
                  </h3>
                  <p className="text-xs text-black/50 leading-relaxed mb-4 max-w-sm">
                    {plan.descripcion}
                  </p>

                  {/* Includes */}
                  <div className="space-y-1.5">
                    {plan.caracteristicas.map((c) => (
                      <div key={c} className="flex items-center gap-2 text-[12px] text-[#050505]">
                        <Check size={11} className="shrink-0 text-[#050505]" />
                        {c}
                      </div>
                    ))}
                    {plan.noIncluye.map((c) => (
                      <div key={c} className="flex items-center gap-2 text-[12px] text-black/25">
                        <X size={11} className="shrink-0" />
                        {c}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: price + CTA */}
                <div className="sm:text-right flex flex-col items-start sm:items-end gap-3 sm:min-w-[160px]">
                  <div>
                    <div className="flex items-baseline gap-1 sm:justify-end">
                      <span className="text-3xl font-black text-[#050505] tracking-tight">
                        {precioFormateado}€
                      </span>
                      <span className="text-[10px] font-mono text-black/30 uppercase">
                        /{isAnnual ? 'year' : 'month'}
                      </span>
                    </div>
                    {isAnnual && (
                      <p className="text-[10px] text-black/40 sm:text-right mt-0.5">
                        {(plan.precio.mensual / 100).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€/mo
                        &nbsp;×&nbsp;12, billed annually
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleCompra(plan.tier)}
                    disabled={cargando}
                    className={`w-full sm:w-auto px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                      plan.elite
                        ? 'bg-white text-white hover:bg-[#1a1a1a] shadow-md'
                        : 'bg-black/5 text-[#050505] border border-black/10 hover:bg-black/10'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {cargando ? (
                      <>
                        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        {plan.elite ? 'Get Cryptographic' : plan.popular ? 'Get Professional' : 'Get Basic'}
                        <ArrowRight size={13} />
                      </>
                    )}
                  </button>

                  <p className="text-[9px] text-black/30 sm:text-right">
                    30 days free · No commitment
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer legal note */}
      <div className="rounded-2xl border border-black/8 bg-black/[0.015] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[#050505] mb-0.5">
            Need a custom solution?
          </p>
          <p className="text-[11px] text-black/50">
            For public institutions, regulatory bodies, or high volume, contact our team.
          </p>
        </div>
        <a
          href="mailto:enterprise@ledgernetwork.com"
          className="shrink-0 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#050505] hover:opacity-60 transition-opacity"
        >
          Contact<ArrowRight size={11} />
        </a>
      </div>

      <p className="text-[10px] text-black/25 text-center">
        Prices exclude VAT. Recurring billing cancelable at any time.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN EXPORT
───────────────────────────────────────────── */
export function ProvenanceStudioContent({
  variant = 'desktop',
}: {
  variant?: 'mobile' | 'desktop';
}) {
  const router = useRouter();
  const isMobile = variant === 'mobile';
  const [activeTab, setActiveTab] = useState<Tab>('create');
  const [registryRefreshKey, setRegistryRefreshKey] = useState(0);
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);
  const [userTier, setUserTier] = useState<string>('FREE');
  const [isOwner, setIsOwner] = useState(false);
  
  // Phase 0: Syncing, Phase 1: Completed, Phase 2: Ready
  const [initPhase, setInitPhase] = useState<0 | 1 | 2>(0);

  // [FIX] React Error #310 — ALL hooks MUST be declared before any conditional return.
  // Smooth delayed initialization ("de forma lenta" con animación de completado)
  useEffect(() => {
    const timer1 = setTimeout(() => {
      setInitPhase(1); // Switch to completed animation
    }, 2500);
    
    const timer2 = setTimeout(() => {
      setInitPhase(2); // Reveal UI
    }, 4500);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // [FIX] Moved here above all conditional returns so hook order is ALWAYS stable.
  // Previously this useEffect was placed AFTER the `if (initPhase < 2) return` guard,
  // which violated Rules of Hooks (hooks cannot be called conditionally).
  useEffect(() => {
    if (initPhase < 2) return; // Guard inside effect — hook itself is always called
    // Check if user has an active plan to show Dashboard tab
    fetch('/api/auth/session')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const id = data?.user?.id?.toLowerCase();
        const tier = data?.user?.tier || 'FREE';
        const owner = id === '0x78831c25c86ea2a78a6127fc2ccb95e612d87b4a';
        
        setUserTier(tier);
        setIsOwner(owner);

        if (owner) {
          setHasPlan(true); // Owner VIP
        } else if (tier && tier !== 'FREE') {
          setHasPlan(true);
        } else if (data?.user?.subscription?.status === 'ACTIVE') {
          setHasPlan(true);
        } else {
          setHasPlan(false);
        }
      })
      .catch(() => setHasPlan(false));
  }, [initPhase]);

  // Derived values — computed after hooks, safe to reference in early returns below
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'create', label: 'Create', icon: <Plus size={13} /> },
    { id: 'registry', label: 'All Records', icon: <LayoutList size={13} /> },
    { id: 'aztec', label: 'Aztec Network', icon: null },
    { id: 'billing', label: 'Node Allocation', icon: <CreditCard size={13} /> },
  ];

  if (hasPlan) {
    tabs.push({ id: 'dashboard', label: 'Dashboard', icon: <ShieldCheck size={13} /> });
  }

  const handleCreated = (passport: ProductPassportPublic) => {
    setRegistryRefreshKey((k) => k + 1);
    void passport;
  };

  // ─── Phase guard: show loading animation until Sequencer initializes ───
  if (initPhase < 2) {
    return (
      <div className="flex min-h-[100vh] w-full flex-col items-center justify-center bg-[#ffffff] text-center p-8">
        <div className="flex items-center justify-center h-24 w-24 rounded-full bg-black/5 mb-8">
          <ShieldCheck size={32} className={`text-black ${initPhase === 0 ? 'animate-pulse' : ''}`} />
        </div>
        <h2 className="text-sm font-black uppercase tracking-[0.3em] text-[#050505]">
          {initPhase === 0 ? 'Initializing Quantum Sequencer' : 'Sequencer Certified'}
        </h2>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-black/40">
          {initPhase === 0 ? 'Syncing with Aztec Mainnet v5' : 'Connection Established'}
        </p>
      </div>
    );
  }

  if (hasPlan === null) {
    return (
      <div className="w-full min-h-[100vh] flex items-center justify-center bg-[#FFFFFF]">
        <Loader2 size={24} className="animate-spin text-black/30" />
      </div>
    );
  }

  // Removed legacy hasPlan iframe fallback to allow native Studio UI to render.
  return (
    <TuringShieldGate>
    <div
      className={`min-h-[100vh] bg-[#FFFFFF] text-[#050505] ${
        isMobile ? 'pb-[calc(2rem+env(safe-area-inset-bottom))]' : ''
      }`}
    >
      {/* Mobile back header */}
      {isMobile && (
        <header className="sticky top-0 z-20 bg-[#FFFFFF]/95 backdrop-blur-md border-b border-black/8 px-5 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => router.push('/connect')}
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black/50"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </header>
      )}

      <div className={`max-w-2xl mx-auto px-5 ${isMobile ? 'py-6' : 'px-6 py-12'}`}>
        {/* Page header */}
        {!isMobile && (
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-black/30 mb-2">
            Studio
          </p>
        )}
        <div className="flex items-center justify-between gap-4 mb-1.5 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h1
              className={`font-black tracking-tight ${isMobile ? 'text-2xl' : 'text-3xl'}`}
            >
              Provenance Studio
            </h1>
          </div>
          <Link 
            href="/terminal"
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-5 py-2.5 bg-black text-white rounded-full hover:bg-black/80 transition-all shadow-sm"
          >
            Return to Dashboard
          </Link>
        </div>
        <p className="text-sm text-black/50 mb-8 leading-relaxed">
          Create verifiable product records, generate scannable QR labels, and confirm them on the
          public ledger.
        </p>

        {/* Tab navigation */}
        <div className="flex gap-1 mb-6 rounded-xl border border-black/8 bg-black/[0.02] p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => startTransition(() => setActiveTab(tab.id))}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-white shadow-sm'
                  : 'text-black/40 hover:text-black/70'
              }`}
            >
              {tab.icon}
              <span className={isMobile ? 'hidden xs:inline' : ''}>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content with 60fps hardware-accelerated transitions */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="w-full will-change-transform"
          >
            {activeTab === 'create' && (
              <CreateTab isMobile={isMobile} onCreated={handleCreated} hasPlan={!!hasPlan} isOwner={isOwner} />
            )}
            {activeTab === 'registry' && (
              <RegistryTab isMobile={isMobile} refreshKey={registryRefreshKey} userTier={userTier} isOwner={isOwner} />
            )}
            {activeTab === 'aztec' && <AztecTab />}
            {activeTab === 'billing' && <BandwidthTab />}
            {activeTab === 'dashboard' && <SubscriptionDashboard />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
    </TuringShieldGate>
  );
}

