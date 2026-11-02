'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  FileText, BrainCircuit, Lock, Loader2, CheckCircle2,
  Upload, XCircle, ChevronDown, ChevronUp, Copy, Check, ShieldAlert,
  Globe
} from 'lucide-react';
import { 
  runAcademicIntegrityAnalysis, 
  AnalysisResult, 
  AnalysisPhase, 
  ProgressUpdate
} from '@/lib/academic-integrity-engine';
import { turingTranslations, Language } from '@/lib/i18n-turing';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function TuringAcademicShield() {
  const [lang, setLang] = useState<Language>('es');
  const t = (key: keyof typeof turingTranslations['es']) => turingTranslations[lang][key];

  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [phase, setPhase] = useState<AnalysisPhase | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [completedPhases, setCompletedPhases] = useState<string[]>([]);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phase Order for UI Checklist
  const PHASE_KEYS: AnalysisPhase[] = [
    'normalizing', 'scanning_unicode', 'shingling', 'winnowing',
    'minhash', 'entropy', 'stylometry', 'zk_commit'
  ];

  const [isUploading, setIsUploading] = useState(false);

  // ── Handle file reading safely (supports .pdf, .docx, .txt, .md, .csv)
  const readFile = async (file: File) => {
    setFileName(file.name);
    setErrorMsg('');
    const ext = file.name.split('.').pop()?.toLowerCase();

    // Word documents and PDFs are extracted via our server parser
    if (ext === 'docx' || ext === 'pdf' || ext === 'doc') {
      try {
        setIsUploading(true);
        const form = new FormData();
        form.append('file', file);

        const res = await fetch('/api/academy/parse-document', {
          method: 'POST',
          body: form,
        });

        const data = await res.json();
        if (data.ok && data.text) {
          setText(data.text);
          setPhase(null);
          setErrorMsg('');
        } else {
          setPhase('error');
          setErrorMsg(data.error || 'Error al procesar el archivo. Asegúrate de que no esté protegido.');
        }
      } catch (err: any) {
        setPhase('error');
        setErrorMsg('Error de red al procesar el archivo: ' + (err.message || 'Error desconocido'));
      } finally {
        setIsUploading(false);
      }
      return;
    }
    
    // Plain text formats (.txt, .md, .csv, etc.)
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setText(content || '');
      setPhase(null);
      setErrorMsg('');
    };
    reader.onerror = () => {
      setPhase('error');
      setErrorMsg(t('errShort'));
    };
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
    if (e.target) e.target.value = '';
  };

  // ── Start analysis
  const handleAnalyze = async () => {
    setErrorMsg('');

    if (!text || text.trim().length < 50) {
      setPhase('error');
      setErrorMsg(t('errShort'));
      return;
    }
    
    setPhase('normalizing');
    setProgress(5);
    setResult(null);
    setCompletedPhases([]);

    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const submissionId = `ID-${ts}-${rand}`;

    try {
      const res = await runAcademicIntegrityAnalysis(
        text, 
        submissionId,
        (update: ProgressUpdate) => {
          setPhase(update.phase);
          setProgress(update.progress);
          setCompletedPhases(prev => {
            const idx = PHASE_KEYS.indexOf(update.phase);
            if (idx === -1) return prev;
            return PHASE_KEYS.slice(0, idx + 1); 
          });
        }
      );
      
      setResult(res);
      setPhase('complete');
      setProgress(100);
      setCompletedPhases(PHASE_KEYS);
    } catch (err: any) {
      console.error('[TuringShield] Analysis error:', err);
      setPhase('error');
      setErrorMsg(err.message || t('errShort'));
      setProgress(0);
    }
  };

  const handleReset = () => {
    setPhase(null);
    setText('');
    setFileName('');
    setResult(null);
    setProgress(0);
    setCompletedPhases([]);
    setShowDetails(false);
    setErrorMsg('');
  };

  const handleCopyCommitment = () => {
    if (result?.zkCommitment) {
      navigator.clipboard.writeText(result.zkCommitment);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isProcessing = phase !== null && phase !== 'complete' && phase !== 'error';
  const isIdle = phase === null;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-10 animate-in fade-in duration-700 text-gray-900 font-sans px-4 sm:px-0 pb-16">

      {/* ─── Header & Language Selector ──────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-gray-200 pb-8 relative">
        <div className="space-y-3 max-w-2xl">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900">
            {t('heroTitle').replace('Academic', '')} <span className="text-emerald-600">Academic</span>
          </h2>
          <h3 className="text-lg md:text-xl font-medium text-gray-600 tracking-wide">
            {t('heroSubtitle')}
          </h3>
          <p className="text-gray-500 leading-relaxed text-sm md:text-base pt-2">
            {t('heroDesc')}
          </p>
        </div>

        {/* Language Selector */}
        <div className="relative">
          <button 
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 px-4 py-2.5 rounded-full text-sm font-semibold transition-all shadow-sm"
          >
            <Globe size={16} className="text-gray-400" />
            {lang.toUpperCase()}
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          
          {showLangMenu && (
            <div className="absolute right-0 top-full mt-2 w-40 bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden z-50 animate-in slide-in-from-top-2 duration-200">
              {(['en', 'es', 'fr', 'de', 'pt', 'zh'] as Language[]).map(l => (
                <button
                  key={l}
                  onClick={() => { setLang(l); setShowLangMenu(false); }}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors hover:bg-gray-50
                    ${lang === l ? 'font-bold text-emerald-600 bg-emerald-50/50' : 'font-medium text-gray-700'}`}
                >
                  {l === 'en' && 'English'}
                  {l === 'es' && 'Español'}
                  {l === 'fr' && 'Français'}
                  {l === 'de' && 'Deutsch'}
                  {l === 'pt' && 'Português'}
                  {l === 'zh' && '中文'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Main Interactive Card ───────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-[24px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        
        <div className="p-8 md:p-12">

          {/* ── IDLE STATE ── */}
          {(isIdle || phase === 'error') && (
            <div className="flex flex-col gap-6 max-w-3xl mx-auto">

              {/* Error */}
              {phase === 'error' && (
                <div className="bg-red-50/80 border border-red-100 rounded-xl p-4 flex items-start gap-3 animate-in fade-in zoom-in duration-300">
                  <XCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                  <p className="text-red-700 text-sm font-medium leading-relaxed">{errorMsg}</p>
                </div>
              )}

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center gap-4
                  ${isDragging ? 'border-[#25D366] bg-emerald-50 scale-[1.02]' : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50/50'}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-300 ${isDragging || isUploading ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                  {isUploading ? (
                    <Loader2 size={24} className="text-emerald-600 animate-spin" />
                  ) : (
                    <Upload size={24} className={isDragging ? 'text-emerald-600' : 'text-gray-400'} />
                  )}
                </div>
                <div className="text-center flex flex-col items-center gap-2">
                  <p className="text-gray-900 font-bold text-base">
                    {isUploading ? 'Extrayendo texto del documento...' : t('dropzoneTitle')}
                  </p>
                  <p className="text-gray-500 text-xs">{t('dropzoneSub')}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="mt-2 px-5 py-2.5 bg-black hover:bg-gray-800 text-white rounded-xl text-xs font-bold shadow transition-all active:scale-95"
                  >
                    📂 Seleccionar archivo PDF o Word (.docx)
                  </button>
                </div>
                {fileName && !isUploading && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-4 py-1.5 text-emerald-700 text-sm font-medium mt-2">
                    <FileText size={14} />
                    {fileName}
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md,.csv"
                  className="hidden"
                  onClick={(e) => {
                    e.stopPropagation();
                    (e.target as any).value = null;
                  }}
                  onChange={handleFileInput}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 py-1">
                <span className="text-gray-400 text-xs font-bold tracking-widest uppercase">{t('orPaste')}</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const sample = `PROPUNERE DE CERCETARE / FIȘĂ DE TEMĂ\n\nAdaptarea autorităților de management la noua arhitectură a fondurilor europene post-2027: provocări, riscuri și oportunități pentru România\n\nOprișan Elena Gratiela\n\n1. Tema și scurtă prezentare\nTema cercetării se înscrie în contextul reformei profunde a Politicii de Coeziune și a Cadrului Financiar Multianual 2028–2034. Comisia Europeană propune o arhitectură integrată, centrată pe Planuri de Parteneriat Național și Regional (PPNR / National and Regional Partnership Plans), care comasează instrumente anterior separate (coeziune, agricultură, politici sociale etc.) într-un număr redus de planuri naționale, cu accent sporit pe performanță, flexibilitate și legătura investiții–reforme. Pentru România, miza financiară estimată se situează în jurul a 60 de miliarde de euro.\nAutoritățile de management (AM) – atât cele naționale (în cadrul MIPE și al altor ministere), cât și cele regionale (Agențiile pentru Dezvoltare Regională, care în perioada 2021–2027 au preluat rolul de AM pentru programele regionale) – se află în fața unei transformări instituționale majore. Noua arhitectură poate aduce simplificare și mai bună coordonare strategică, dar generează și riscuri de recentralizare, reducerea autonomiei regionale, presiune pe capacitatea administrativă și necesitatea unor competențe noi ale personalului. Cercetarea explorează modul în care aceste autorități se pot adapta, identificând provocările, riscurile și oportunitățile pentru sistemul românesc de gestionare a fondurilor europene.\n\n2. Obiectivul principal al cercetării\nObiectivul principal este de a analiza și evalua procesul de adaptare instituțională și organizațională a autorităților de management din România la noua arhitectură a fondurilor europene post-2027, cu accent pe implicațiile pentru capacitatea administrativă, resursele umane și performanța sistemului de management și control.\nDe ce este relevant pentru managementul resurselor umane? Succesul absorbției și al utilizării eficiente a fondurilor europene depinde critic de calitatea resurselor umane din AM: competențe tehnice, capacitate de coordonare multi-nivel, abilități de management al schimbării și de lucru pe bază de rezultate.`;
                      setText(sample);
                      setFileName('propunere_cercetare_elena.docx');
                      setPhase(null);
                      setErrorMsg('');
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors"
                  >
                    📄 Cargar propuesta de Elena (ejemplo)
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const clipText = await navigator.clipboard.readText();
                        if (clipText) {
                          setText(clipText);
                          setPhase(null);
                          setErrorMsg('');
                        }
                      } catch {
                        textareaRef.current?.focus();
                      }
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
                  >
                    📋 Pegar portapapeles
                  </button>
                  {text && (
                    <button
                      type="button"
                      onClick={() => {
                        setText('');
                        setFileName('');
                        setPhase(null);
                        setErrorMsg('');
                      }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

              {/* Textarea */}
              <div className="relative group">
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onInput={(e: any) => setText(e.target.value)}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files[0];
                    if (file) {
                      readFile(file);
                    } else {
                      const droppedText = e.dataTransfer.getData('text');
                      if (droppedText) setText(droppedText);
                    }
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text');
                    if (pasted) {
                      setText(pasted);
                    }
                  }}
                  placeholder={t('textareaPlaceholder')}
                  className="w-full h-48 bg-white border border-gray-200 rounded-2xl p-5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#25D366]/10 focus:border-emerald-400 resize-none text-sm transition-all shadow-inner"
                />
                {text && (
                  <div className="absolute bottom-4 right-4 text-xs font-semibold text-gray-400 bg-white px-2 py-1 rounded-md border border-gray-100 shadow-sm">
                    {text.split(/\s+/).filter(Boolean).length.toLocaleString()} {t('wordCount')}
                  </div>
                )}
              </div>

              {/* CTA */}
              <button
                type="button"
                onClick={() => {
                  if (!text || text.trim().length === 0) {
                    setErrorMsg('Por favor carga un documento PDF/Word o pega texto en el recuadro para comenzar el análisis.');
                    setPhase('error');
                    textareaRef.current?.focus();
                    return;
                  }
                  handleAnalyze();
                }}
                disabled={isUploading}
                className="w-full bg-black hover:bg-gray-900 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold text-base py-4 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-black/10 active:scale-[0.98] cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Extrayendo texto del documento...</span>
                  </>
                ) : (
                  <>
                    <BrainCircuit size={20} />
                    <span>{t('analyzeBtn')}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ── PROCESSING STATE ── */}
          {isProcessing && (
            <div className="flex flex-col items-center gap-12 py-10 max-w-2xl mx-auto">
              <div className="relative">
                <div className="absolute inset-0 bg-[#25D366] blur-2xl opacity-20 rounded-full animate-pulse" />
                <div className="w-24 h-24 bg-white border border-gray-100 shadow-xl rounded-2xl flex items-center justify-center relative z-10">
                  <Loader2 size={40} className="text-emerald-600 animate-spin" />
                </div>
              </div>

              <div className="w-full flex flex-col gap-3">
                {PHASE_KEYS.map((key) => {
                  const isDone = completedPhases.includes(key);
                  const isActive = phase === key;
                  return (
                    <div key={key} className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300
                      ${isActive ? 'bg-emerald-50/50 border border-emerald-100 scale-[1.02]' : isDone ? 'opacity-50' : 'opacity-30'}`}>
                      <div className="shrink-0 w-6 h-6 flex items-center justify-center">
                        {isDone ? <Check size={18} className="text-emerald-500" /> : isActive ? <Loader2 size={16} className="text-emerald-600 animate-spin" /> : <div className="w-2 h-2 rounded-full bg-gray-300" />}
                      </div>
                      <span className={`text-sm font-semibold tracking-wide ${isActive ? 'text-emerald-900' : 'text-gray-600'}`}>
                        {t(`phase_${key}` as keyof typeof turingTranslations['es'])}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="w-full">
                <div className="flex justify-between text-xs font-bold text-gray-400 tracking-wider mb-2">
                  <span className="uppercase">{t(`phase_${phase}` as keyof typeof turingTranslations['es'])}</span>
                  <span>{progress.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── RESULTS STATE ── */}
          {phase === 'complete' && result && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto">

              {/* Verdict banner */}
              {(() => {
                let vc = { color: '', bg: '', border: '', label: '', desc: '' };
                if (result.plagiarismVerdict === 'LIKELY_ORIGINAL') {
                  vc = { color: 'text-emerald-700', bg: 'bg-emerald-50/50', border: 'border-emerald-200', label: t('verdict_LIKELY_ORIGINAL_title'), desc: t('verdict_LIKELY_ORIGINAL_desc') };
                } else if (result.plagiarismVerdict === 'REVIEW_REQUIRED') {
                  vc = { color: 'text-amber-700', bg: 'bg-amber-50/50', border: 'border-amber-200', label: t('verdict_REVIEW_REQUIRED_title'), desc: t('verdict_REVIEW_REQUIRED_desc') };
                } else {
                  vc = { color: 'text-red-700', bg: 'bg-red-50/50', border: 'border-red-200', label: t('verdict_HIGH_RISK_title'), desc: t('verdict_HIGH_RISK_desc') };
                }

                return (
                  <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6 rounded-[20px] border ${vc.bg} ${vc.border} shadow-sm`}>
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 bg-white shadow-sm border ${vc.border}`}>
                      <CheckCircle2 size={28} className={vc.color} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                        <h3 className={`text-xl font-black tracking-tight ${vc.color}`}>{vc.label}</h3>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-lg bg-white border ${vc.border} ${vc.color} shadow-sm uppercase tracking-wider`}>
                          {t('riskLevel')}: {result.overallRisk}/100
                        </span>
                      </div>
                      <p className={`text-sm font-medium opacity-90 leading-relaxed max-w-2xl ${vc.color}`}>{vc.desc}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Security Alerts */}
              {(result.securityAlerts.homoglyphsFound > 0 || result.securityAlerts.zeroWidthCharsFound > 0) && (
                <div className="bg-red-50/50 border border-red-200 rounded-[20px] p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <ShieldAlert size={20} className="text-red-600" />
                    <h4 className="text-base font-black text-red-900 tracking-tight">{t('alertTitle')}</h4>
                  </div>
                  <ul className="list-disc pl-5 space-y-1.5 text-sm text-red-800 font-medium mb-3">
                    {result.securityAlerts.unicodeAnomalies.map((anom, i) => (
                      <li key={i}>{anom}</li>
                    ))}
                  </ul>
                  <p className="text-sm text-red-700/80 leading-relaxed font-medium max-w-3xl">
                    {t('alertDesc')}
                  </p>
                </div>
              )}

              {/* Premium Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: t('metricIntegrity'), value: `${(result.documentIntegrityScore * 100).toFixed(1)}%`, color: 'text-gray-900', sub: t('metricIntegritySub') },
                  { label: t('metricAIProb'), value: `${(result.aiProbability * 100).toFixed(1)}%`, color: result.aiProbability > 0.5 ? 'text-red-600' : 'text-emerald-600', sub: t(`ai_${result.aiVerdict}` as keyof typeof turingTranslations['es']) },
                  { label: t('metricEntropy'), value: result.shannonEntropy, color: 'text-gray-800', sub: t('metricEntropySub') },
                  { label: t('metricBurstiness'), value: result.burstinessScore, color: 'text-gray-800', sub: t('metricBurstinessSub') },
                  { label: t('metricLexical'), value: result.stylometrics.ttr, color: 'text-gray-800', sub: t('metricLexicalSub') },
                  { label: t('metricWords'), value: result.totalWords.toLocaleString(), color: 'text-gray-900', sub: `${result.uniqueWords.toLocaleString()} ${t('metricWordsSub')}` },
                ].map((m, i) => (
                  <div key={i} className="bg-white border border-gray-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] rounded-[16px] p-5 flex flex-col gap-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-gray-200 transition-all">
                    <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">{m.label}</span>
                    <span className={`text-2xl font-black tracking-tight ${m.color}`}>{m.value}</span>
                    <span className="text-gray-400 text-xs font-medium">{m.sub}</span>
                  </div>
                ))}
              </div>

              {/* Expandable: Stylometric details */}
              <div className="bg-white border border-gray-200 rounded-[16px] overflow-hidden shadow-sm">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-bold text-gray-900 tracking-wide">
                    {t('viewFullReport')}
                  </span>
                  {showDetails ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </button>
                {showDetails && (
                  <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-gray-100 pt-6 bg-gray-50/30">
                    {Object.entries(result.stylometrics).map(([k, v]) => (
                      <div key={k} className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{k.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="text-sm font-bold text-gray-900 font-mono bg-white px-3 py-2 rounded-lg border border-gray-100 inline-block w-max">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ZK Commitment - Minimalist Premium */}
              <div className="bg-gray-900 rounded-[20px] p-6 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#25D366]/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 mb-4">
                  <div className="flex items-center gap-2">
                    <Lock size={16} className="text-emerald-400" />
                    <span className="text-sm font-bold text-white tracking-wide">{t('zkTitle')}</span>
                  </div>
                  <button
                    onClick={handleCopyCommitment}
                    className="flex items-center gap-2 text-xs font-bold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-all px-3 py-1.5 rounded-lg border border-white/10"
                  >
                    {copied ? <><Check size={14} className="text-emerald-400" /> {t('copiedBtn')}</> : <><Copy size={14} /> {t('copyBtn')}</>}
                  </button>
                </div>
                
                <div className="bg-black/50 border border-white/10 rounded-xl p-4 mb-3 relative z-10">
                  <p className="text-sm text-emerald-300 font-mono break-all leading-relaxed">{result.zkCommitment}</p>
                </div>
                
                <div className="flex justify-between text-xs font-semibold text-gray-500 relative z-10 uppercase tracking-wider">
                  <span>{t('idLabel')}: {result.submissionId}</span>
                  <span>{new Date(result.timestamp).toLocaleString(lang)}</span>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="w-full bg-white hover:bg-gray-50 border-2 border-gray-200 text-gray-900 font-bold text-base py-4 rounded-2xl transition-all shadow-sm active:scale-[0.99] mt-2"
              >
                {t('newAnalysis')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Redesigned Typographic Footer (The "WOW" Factor) ──────────────────────── */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-16 pt-10 border-t border-gray-200">
        {[
          { title: t('usp1Title'), desc: t('usp1Desc') },
          { title: t('usp2Title'), desc: t('usp2Desc') },
          { title: t('usp3Title'), desc: t('usp3Desc') },
        ].map((block, i) => (
          <div key={i} className="flex flex-col gap-3">
            <h4 className="text-gray-900 font-black text-lg tracking-tight border-b-2 border-emerald-600 inline-block w-max pb-1 mb-1">
              {block.title}
            </h4>
            <p className="text-gray-500 text-sm leading-relaxed font-medium">
              {block.desc}
            </p>
          </div>
        ))}
      </div>

    </div>
  );
}

