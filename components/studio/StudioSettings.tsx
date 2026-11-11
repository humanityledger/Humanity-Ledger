'use client';

/**
 * Studio settings: personalization, language, skills, usage and plan (with
 * the AI provider's status), and the data on this device.
 *
 * Since the Groq migration (Nov 2026) there are no MCP connectors or web
 * search settings: the provider has no equivalent (see STUDIO_CAPABILITIES).
 */

import React, { useEffect, useState } from 'react';
import { Check, Download, Plus, Sparkles, Trash2, User, Gauge, Database, X, Globe, SquareTerminal, Cpu } from 'lucide-react';
import type { StudioApi } from './useStudio';
import { CodeSettings } from './code/CodeSettings';
import { BUILTIN_SKILLS, MAX_SKILL_CHARS, type StudioSkill } from '@/lib/studio/skills';
import { STUDIO_LANGUAGES, type StudioLanguage } from '@/lib/studio/protocol';
import { formatUnits, normalizeModel, STUDIO_MODELS, STUDIO_PLANS, planAllowsModel, type StudioModelId } from '@/lib/studio/models';
import { uid } from '@/lib/studio/store';

export type SettingsTab = 'general' | 'code' | 'skills' | 'usage' | 'data';

const LANG_LABEL: Record<StudioLanguage, string> = {
  auto: '', es: 'Español', en: 'English', pt: 'Português', fr: 'Français', de: 'Deutsch', it: 'Italiano', ro: 'Română',
};

const input = 'w-full h-10 px-3 rounded-xl border border-[#e4e7ec] bg-white text-[14px] text-[#15171c] outline-none focus:border-[#98a2b3]';
const area = 'w-full px-3 py-2 rounded-xl border border-[#e4e7ec] bg-white text-[14px] text-[#15171c] outline-none focus:border-[#98a2b3] resize-y';
const label = 'block text-[13px] font-medium text-[#15171c] mb-1.5';
const hint = 'text-[12.5px] text-[#727a88] mt-1';
const primary = 'h-10 px-4 rounded-xl bg-[#15171c] text-white text-[13.5px] font-medium disabled:opacity-40';
const ghost = 'h-10 px-4 rounded-xl border border-[#e4e7ec] text-[13.5px] text-[#15171c] hover:bg-[#f2f4f7] disabled:opacity-40';

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 rounded-full bg-[#eff1f4] overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${pct >= 90 ? 'bg-[#d93036]' : pct >= 70 ? 'bg-[#e08a00]' : 'bg-[#15171c]'}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function StudioSettings({ api, initialTab = 'general', onClose }: { api: StudioApi; initialTab?: SettingsTab; onClose: () => void }) {
  const { t, lang, prefs, savePrefs, usage, plan, startCheckout, store, refreshUsage } = api;
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [p, setP] = useState(prefs);
  const [saved, setSaved] = useState(false);
  const [editingSkill, setEditingSkill] = useState<StudioSkill | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkoutMsg, setCheckoutMsg] = useState('');

  useEffect(() => { setP(prefs); }, [prefs]);
  useEffect(() => { if (tab === 'usage') refreshUsage(); }, [tab, refreshUsage]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => { await savePrefs(p); setSaved(true); setTimeout(() => setSaved(false), 1500); };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: t.personalization, icon: <User size={16} /> },
    { id: 'code', label: t.codeTab, icon: <SquareTerminal size={16} /> },
    { id: 'skills', label: t.skills, icon: <Sparkles size={16} /> },
    { id: 'usage', label: `${t.usage} · ${t.plan}`, icon: <Gauge size={16} /> },
    { id: 'data', label: t.dataTab, icon: <Database size={16} /> },
  ];

  const saveSkill = async (s: StudioSkill) => {
    const clean: StudioSkill = { ...s, name: s.name.trim().slice(0, 120) || 'Skill', description: s.description.trim().slice(0, 300), instructions: s.instructions.slice(0, MAX_SKILL_CHARS) };
    const list = p.customSkills.some(x => x.id === clean.id) ? p.customSkills.map(x => (x.id === clean.id ? clean : x)) : [...p.customSkills, clean];
    const next = { ...p, customSkills: list.slice(0, 50) };
    setP(next); await savePrefs(next); setEditingSkill(null);
  };
  const deleteSkill = async (id: string) => {
    const next = { ...p, customSkills: p.customSkills.filter(s => s.id !== id) };
    setP(next); await savePrefs(next);
  };

  const exportData = async () => {
    const json = await store.exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ledger-studio-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const wipe = async () => {
    if (!window.confirm(t.wipeConfirm)) return;
    await store.wipe();
    window.location.reload();
  };

  const checkout = async (action?: 'portal') => {
    setBusy(true); setCheckoutMsg('');
    try {
      const r = await startCheckout(action);
      if (!r.url) setCheckoutMsg(r.message || r.error || t.error);
    } finally { setBusy(false); }
  };

  const u = usage?.usage;
  // Allowance units are tokens (1 unit = 1M tokens), shown as tokens: Studio costs the user nothing.
  const fmtUnits = (n: number) => formatUnits(n, lang);

  return (
    <div className="fixed inset-0 z-[320] bg-[#15171c]/30 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.settings}
        className="w-full sm:max-w-3xl h-[92dvh] sm:h-[min(720px,90dvh)] bg-white rounded-t-3xl sm:rounded-3xl shadow-[0_24px_60px_-20px_rgba(16,24,40,0.35)] flex flex-col sm:flex-row overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <nav className="sm:w-52 shrink-0 border-b sm:border-b-0 sm:border-r border-[#eceef2] p-2 flex sm:flex-col gap-1 overflow-x-auto">
          <div className="hidden sm:flex items-center justify-between px-2 h-10 mb-1">
            <span className="text-[15px] font-semibold text-[#15171c]">{t.settings}</span>
          </div>
          {tabs.map(x => (
            <button
              key={x.id}
              type="button"
              onClick={() => setTab(x.id)}
              className={`shrink-0 h-9 px-3 rounded-lg flex items-center gap-2 text-[13.5px] whitespace-nowrap ${tab === x.id ? 'bg-[#f2f4f7] text-[#15171c] font-medium' : 'text-[#4a505c] hover:bg-[#f7f8fa]'}`}
            >
              {x.icon} {x.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-end px-3 h-12 shrink-0">
            <button type="button" onClick={onClose} aria-label={t.close} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#eff1f4] text-[#15171c]"><X size={18} /></button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
            {tab === 'code' && <CodeSettings api={api} />}
            {tab === 'general' && (
              <div className="space-y-5 max-w-xl">
                <div>
                  <label className={label} htmlFor="st-callme">{t.callMe}</label>
                  <input id="st-callme" className={input} maxLength={80} value={p.personalization.callMe ?? ''} onChange={e => setP({ ...p, personalization: { ...p.personalization, callMe: e.target.value } })} />
                </div>
                <div>
                  <label className={label} htmlFor="st-instr">{t.customInstructions}</label>
                  <textarea id="st-instr" rows={5} maxLength={8000} className={area} value={p.personalization.instructions ?? ''} onChange={e => setP({ ...p, personalization: { ...p.personalization, instructions: e.target.value } })} />
                  <p className={hint}>{t.customInstructionsHint}</p>
                </div>
                <div>
                  <span className={label}>{t.style}</span>
                  <div className="flex gap-1 p-1 rounded-xl bg-[#eff1f4] w-fit">
                    {(['concise', 'balanced', 'detailed'] as const).map(s => (
                      <button key={s} type="button" onClick={() => setP({ ...p, personalization: { ...p.personalization, style: s } })}
                        className={`h-8 px-3 rounded-lg text-[13px] ${p.personalization.style === s ? 'bg-white shadow-sm text-[#15171c] font-medium' : 'text-[#4a505c]'}`}>{t[s]}</button>
                    ))}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={label} htmlFor="st-uilang"><Globe size={13} className="inline mr-1 -mt-0.5" />{t.uiLanguage}</label>
                    <select id="st-uilang" className={input} value={p.uiLanguage} onChange={e => setP({ ...p, uiLanguage: e.target.value as any })}>
                      <option value="auto">{t.auto}</option>
                      <option value="es">Español</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div>
                    <label className={label} htmlFor="st-resplang">{t.responseLanguage}</label>
                    <select id="st-resplang" className={input} value={p.personalization.responseLanguage ?? 'auto'} onChange={e => setP({ ...p, personalization: { ...p.personalization, responseLanguage: e.target.value as StudioLanguage } })}>
                      {STUDIO_LANGUAGES.map(l => <option key={l} value={l}>{l === 'auto' ? t.auto : LANG_LABEL[l]}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={label} htmlFor="st-model">{t.model}</label>
                  <select id="st-model" className={input} value={normalizeModel(p.defaultModel)} onChange={e => setP({ ...p, defaultModel: e.target.value as StudioModelId })}>
                    {Object.values(STUDIO_MODELS).map(m => (
                      <option key={m.id} value={m.id} disabled={!planAllowsModel(plan, m.id)}>{m.label}{m.plan === 'pro' ? ` (${t.proOnly})` : ''}</option>
                    ))}
                  </select>
                </div>
                <p className={hint}>{t.modelHint}</p>
                <button type="button" onClick={save} className={primary}>{saved ? <><Check size={15} className="inline mr-1" />{t.saved}</> : t.save}</button>
              </div>
            )}

            {tab === 'skills' && (
              <div className="space-y-5">
                <p className="text-[13.5px] text-[#4a505c]">{t.skillsHint}</p>
                {editingSkill ? (
                  <div className="space-y-3 max-w-xl">
                    <div>
                      <label className={label} htmlFor="sk-name">{t.skillName}</label>
                      <input id="sk-name" className={input} maxLength={120} value={editingSkill.name} onChange={e => setEditingSkill({ ...editingSkill, name: e.target.value })} />
                    </div>
                    <div>
                      <label className={label} htmlFor="sk-desc">{t.skillDescription}</label>
                      <input id="sk-desc" className={input} maxLength={300} value={editingSkill.description} onChange={e => setEditingSkill({ ...editingSkill, description: e.target.value })} />
                    </div>
                    <div>
                      <label className={label} htmlFor="sk-instr">{t.skillInstructions}</label>
                      <textarea id="sk-instr" rows={12} maxLength={MAX_SKILL_CHARS} className={`${area} font-mono text-[13px]`} value={editingSkill.instructions} onChange={e => setEditingSkill({ ...editingSkill, instructions: e.target.value })} />
                      <p className={hint}>{editingSkill.instructions.length.toLocaleString()} / {MAX_SKILL_CHARS.toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className={primary} disabled={!editingSkill.name.trim() || !editingSkill.instructions.trim()} onClick={() => saveSkill(editingSkill)}>{t.save}</button>
                      <button type="button" className={ghost} onClick={() => setEditingSkill(null)}>{t.cancel}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[14px] font-semibold text-[#15171c]">{t.yourSkills}</h3>
                        <button type="button" className="h-8 px-3 rounded-lg border border-[#e4e7ec] text-[13px] flex items-center gap-1.5 hover:bg-[#f2f4f7]"
                          onClick={() => setEditingSkill({ id: uid('sk_').slice(0, 40), name: '', description: '', instructions: '', builtin: false })}>
                          <Plus size={14} /> {t.newSkill}
                        </button>
                      </div>
                      {p.customSkills.length === 0 ? <p className="text-[13px] text-[#727a88]">—</p> : (
                        <ul className="space-y-2">
                          {p.customSkills.map(s => (
                            <li key={s.id} className="flex items-start gap-3 p-3 rounded-xl border border-[#e4e7ec]">
                              <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-medium text-[#15171c]">{s.name}</p>
                                <p className="text-[12.5px] text-[#727a88] line-clamp-2">{s.description}</p>
                              </div>
                              <button type="button" className="text-[12.5px] text-[#4a505c] hover:underline" onClick={() => setEditingSkill(s)}>{t.edit}</button>
                              <button type="button" aria-label={t.delete} className="text-[#d93036]" onClick={() => deleteSkill(s.id)}><Trash2 size={15} /></button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#15171c] mb-2">{t.builtIn}</h3>
                      <ul className="grid sm:grid-cols-2 gap-2">
                        {BUILTIN_SKILLS.map(s => (
                          <li key={s.id} className="p-3 rounded-xl border border-[#e4e7ec] bg-[#fbfcfd]">
                            <p className="text-[14px] font-medium text-[#15171c]">{s.name}</p>
                            <p className="text-[12.5px] text-[#727a88]">{s.description}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === 'usage' && (
              <div className="space-y-6 max-w-xl">
                {/* The AI provider, as the server reports it (/api/studio/usage). */}
                {usage && (
                  <div className="p-4 rounded-2xl border border-[#e4e7ec] flex items-start gap-3">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${usage.configured ? 'bg-[#e9f7ef] text-[#0f6b45]' : 'bg-[#fdf2f2] text-[#b42318]'}`}><Cpu size={17} /></span>
                    <div className="min-w-0 text-[13px]">
                      <p className="font-medium text-[#15171c]">{t.providerTitle}: Groq · <span className={usage.configured ? 'text-[#0f6b45]' : 'text-[#b42318]'}>{usage.configured ? t.providerReady : t.providerMissing}</span></p>
                      {usage.configured && (
                        <p className="text-[#4a505c] mt-0.5">
                          {t.model}: {STUDIO_MODELS[normalizeModel(usage.defaultModel)].label}
                          {usage.tpmLimit ? ` · ${usage.tpmLimit.toLocaleString(lang)} ${t.tokensPerMinute}` : ''}
                        </p>
                      )}
                      <p className={hint}>{t.providerHint}</p>
                    </div>
                  </div>
                )}
                {!usage ? <p className="text-[13.5px] text-[#727a88]">…</p> : !usage.configured ? (
                  <p className="text-[13.5px] text-[#4a505c]">{t.notConfigured}</p>
                ) : u && (
                  <>
                    <div className="grid gap-4">
                      <div>
                        <div className="flex justify-between text-[13px] mb-1.5"><span className="font-medium text-[#15171c]">{t.today}</span><span className="text-[#4a505c]">{fmtUnits(u.todayUsd)} {t.of} {fmtUnits(u.plan.dailyBudgetUsd)}</span></div>
                        <Bar value={u.todayUsd} max={u.plan.dailyBudgetUsd} />
                        <p className={hint}>{t.resetsAt} {new Date(u.resetsDayAt).toLocaleString()}</p>
                      </div>
                      <div>
                        <div className="flex justify-between text-[13px] mb-1.5"><span className="font-medium text-[#15171c]">{t.thisMonth}</span><span className="text-[#4a505c]">{fmtUnits(u.monthUsd)} {t.of} {fmtUnits(u.plan.monthlyBudgetUsd)}</span></div>
                        <Bar value={u.monthUsd} max={u.plan.monthlyBudgetUsd} />
                        <p className={hint}>{t.resetsAt} {new Date(u.resetsMonthAt).toLocaleDateString()}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[[u.monthRequests, t.requests], [u.monthTokens, t.tokens]].map(([n, l]) => (
                          <div key={String(l)} className="p-3 rounded-xl bg-[#f8f9fb]">
                            <p className="text-[17px] font-semibold text-[#15171c] tabular-nums">{Number(n).toLocaleString()}</p>
                            <p className="text-[12px] text-[#727a88]">{l}</p>
                          </div>
                        ))}
                      </div>
                      <p className={hint}>{t.usageHint}</p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      {(['free', 'pro'] as const).map(id => (
                        <div key={id} className={`p-4 rounded-2xl border ${plan === id ? 'border-[#15171c]' : 'border-[#e4e7ec]'}`}>
                          <div className="flex items-baseline justify-between">
                            <p className="text-[15px] font-semibold text-[#15171c]">{id === 'free' ? t.free : t.pro}</p>
                            <p className="text-[13px] text-[#4a505c]">{STUDIO_PLANS[id].priceLabel}</p>
                          </div>
                          <p className="text-[12.5px] text-[#727a88] mt-1">{id === 'free' ? t.planFreeDesc : t.planProDesc}</p>
                          {plan === id && <p className="text-[12px] font-medium text-[#15171c] mt-2"><Check size={13} className="inline -mt-0.5" /> {t.plan}</p>}
                        </div>
                      ))}
                    </div>
                    {plan === 'free' ? (
                      <button type="button" className={primary} disabled={busy || !usage.checkoutAvailable} onClick={() => checkout()}>{t.upgrade}</button>
                    ) : (
                      <button type="button" className={ghost} disabled={busy || !usage.checkoutAvailable} onClick={() => checkout('portal')}>{t.manageBilling}</button>
                    )}
                    {checkoutMsg && <p className="text-[12.5px] text-[#4a505c]">{checkoutMsg}</p>}
                  </>
                )}
              </div>
            )}

            {tab === 'data' && (
              <div className="space-y-4 max-w-xl">
                <p className="text-[13.5px] text-[#4a505c]">{t.privacyBody}</p>
                <button type="button" className={`${ghost} flex items-center gap-2`} onClick={exportData}><Download size={15} /> {t.exportData}</button>
                <button type="button" className="h-10 px-4 rounded-xl border border-[#f3c5c7] text-[13.5px] text-[#d93036] hover:bg-[#fdf2f2] flex items-center gap-2" onClick={wipe}><Trash2 size={15} /> {t.wipeData}</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
