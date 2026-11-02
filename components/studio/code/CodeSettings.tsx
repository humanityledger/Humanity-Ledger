'use client';

/**
 * Settings for Code mode, like Claude Code's customization: defaults,
 * personal memory (projects add STUDIO.md), slash commands and subagents.
 */

import React, { useEffect, useState } from 'react';
import { Bot, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import type { StudioApi } from '../useStudio';
import { DEFAULT_DENY_RULES, uid, type CustomCommand } from '@/lib/studio/store';
import type { CustomAgent, PermissionMode, StudioMode } from '@/lib/studio/protocol';
import { BUILTIN_COMMANDS, COMMAND_NAME_RE } from '@/lib/studio/commands';
import { STUDIO_MODELS } from '@/lib/studio/models';

const input = 'w-full h-10 px-3 rounded-xl border border-[#e4e7ec] bg-white text-[14px] text-[#15171c] outline-none focus:border-[#98a2b3]';
const area = 'w-full px-3 py-2 rounded-xl border border-[#e4e7ec] bg-white text-[14px] text-[#15171c] outline-none focus:border-[#98a2b3] resize-y font-mono';
const label = 'block text-[13px] font-medium text-[#15171c] mb-1.5';
const hint = 'text-[12.5px] text-[#727a88] mt-1';
const primary = 'h-10 px-4 rounded-xl bg-[#15171c] text-white text-[13.5px] font-medium disabled:opacity-40';
const ghost = 'h-9 px-3 rounded-xl border border-[#e4e7ec] text-[13px] text-[#15171c] hover:bg-[#f2f4f7] disabled:opacity-40 flex items-center gap-1.5';

const AGENT_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const RESERVED_AGENTS = new Set(['explore', 'general']);

function Toggle({ on, onChange, labelText }: { on: boolean; onChange: (v: boolean) => void; labelText: string }) {
  // icon-btn: exempt from the global 44px touch height (the switch has its own size).
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={labelText} onClick={() => onChange(!on)}
      className={`icon-btn w-[40px] h-[24px] min-w-[40px] min-h-[24px] rounded-full relative shrink-0 transition-colors ${on ? 'bg-[#15171c]' : 'bg-[#d0d5dd]'}`}>
      <span className={`absolute top-[2px] w-[20px] h-[20px] rounded-full bg-white shadow transition-[left] ${on ? 'left-[18px]' : 'left-[2px]'}`} />
    </button>
  );
}

export function CodeSettings({ api }: { api: StudioApi }) {
  const { t, prefs, savePrefs } = api;
  const [p, setP] = useState(prefs);
  const [saved, setSaved] = useState(false);
  const [cmd, setCmd] = useState<CustomCommand | null>(null);
  const [agent, setAgent] = useState<CustomAgent | null>(null);
  const [err, setErr] = useState('');
  const rulesOf = (x: typeof prefs) => x.rules ?? { allow: [], deny: DEFAULT_DENY_RULES };
  const [allowText, setAllowText] = useState(rulesOf(prefs).allow.join('\n'));
  const [denyText, setDenyText] = useState(rulesOf(prefs).deny.join('\n'));
  const [notifyBlocked, setNotifyBlocked] = useState(false);
  useEffect(() => { setP(prefs); setAllowText(rulesOf(prefs).allow.join('\n')); setDenyText(rulesOf(prefs).deny.join('\n')); }, [prefs]); // eslint-disable-line react-hooks/exhaustive-deps
  const parseRules = (s: string) => Array.from(new Set(s.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.includes('..')).map(l => l.slice(0, 200)))).slice(0, 50);
  const setNotify = async (v: boolean) => {
    if (!v) { setP({ ...p, notify: false }); return; }
    if (typeof Notification === 'undefined') { setNotifyBlocked(true); return; }
    let perm = Notification.permission;
    if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch { perm = 'denied'; } }
    setNotifyBlocked(perm !== 'granted');
    if (perm === 'granted') setP({ ...p, notify: true });
  };

  const persist = async (next = p) => { await savePrefs(next); setSaved(true); setTimeout(() => setSaved(false), 1500); };

  const saveCmd = async () => {
    if (!cmd) return;
    const name = cmd.name.trim().toLowerCase();
    if (!COMMAND_NAME_RE.test(name) || BUILTIN_COMMANDS.some(b => b.id === name) || p.customCommands.some(c => c.name === name && c.id !== cmd.id)) { setErr(t.commandNameInvalid); return; }
    const clean: CustomCommand = { ...cmd, name, description: cmd.description.trim().slice(0, 200), template: cmd.template.slice(0, 20_000) };
    if (!clean.template.trim()) return;
    const list = p.customCommands.some(c => c.id === clean.id) ? p.customCommands.map(c => (c.id === clean.id ? clean : c)) : [...p.customCommands, clean];
    const next = { ...p, customCommands: list.slice(0, 50) };
    setP(next); setCmd(null); setErr(''); await persist(next);
  };

  const saveAgent = async () => {
    if (!agent) return;
    const name = agent.name.trim().toLowerCase();
    if (!AGENT_NAME_RE.test(name) || RESERVED_AGENTS.has(name) || p.customAgents.some(a => a.name === name && a.id !== agent.id)) { setErr(t.commandNameInvalid); return; }
    const clean: CustomAgent = { ...agent, name, description: agent.description.trim().slice(0, 500), instructions: agent.instructions.slice(0, 12_000), model: agent.model || undefined };
    if (!clean.description || !clean.instructions.trim()) return;
    const list = p.customAgents.some(a => a.id === clean.id) ? p.customAgents.map(a => (a.id === clean.id ? clean : a)) : [...p.customAgents, clean];
    const next = { ...p, customAgents: list.slice(0, 20) };
    setP(next); setAgent(null); setErr(''); await persist(next);
  };

  return (
    <div className="space-y-7 max-w-xl">
      <section className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label} htmlFor="cs-mode">{t.defaultMode}</label>
            <select id="cs-mode" className={input} value={p.defaultMode} onChange={e => setP({ ...p, defaultMode: e.target.value as StudioMode })}>
              <option value="chat">{t.modeChat}</option>
              <option value="code">{t.modeCode}</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="cs-perm">{t.defaultPermission}</label>
            <select id="cs-perm" className={input} value={p.permission} onChange={e => setP({ ...p, permission: e.target.value as PermissionMode })}>
              <option value="plan">{t.permPlan}</option>
              <option value="ask">{t.permAsk}</option>
              <option value="auto">{t.permAuto}</option>
            </select>
          </div>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[13.5px] font-medium">{t.autoContinue}</p><p className={hint}>{t.autoContinueHint}</p></div>
          <Toggle on={p.autoContinue} onChange={v => setP({ ...p, autoContinue: v })} labelText={t.autoContinue} />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[13.5px] font-medium">{t.sandbox}</p><p className={hint}>{t.sandboxHint} {t.sandboxNoticeBody}</p></div>
          <Toggle on={p.sandbox} onChange={v => setP({ ...p, sandbox: v, acceptedSandboxNotice: p.acceptedSandboxNotice || v })} labelText={t.sandbox} />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13.5px] font-medium">{t.notifyLabel}</p>
            <p className={hint}>{t.notifyHint}</p>
            {notifyBlocked && <p className="text-[12.5px] text-[#b42318] mt-1">{t.notifyBlocked}</p>}
          </div>
          <Toggle on={!!p.notify} onChange={setNotify} labelText={t.notifyLabel} />
        </div>
        <div>
          <label className={label} htmlFor="cs-memory">{t.memory}</label>
          <textarea id="cs-memory" rows={6} maxLength={20_000} className={area} value={p.memory} onChange={e => setP({ ...p, memory: e.target.value })} placeholder="- I use pnpm and TypeScript strict mode&#10;- Prefer small, focused commits" />
          <p className={hint}>{t.memoryHint}</p>
        </div>
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-[13.5px] font-medium">{t.rulesTitle}</p>
            <button type="button" className="text-[12.5px] text-[#4a505c] underline-offset-2 hover:underline icon-btn"
              onClick={() => { setAllowText(''); setDenyText(DEFAULT_DENY_RULES.join('\n')); setP({ ...p, rules: { allow: [], deny: DEFAULT_DENY_RULES } }); }}>
              {t.rulesReset}
            </button>
          </div>
          <p className={`${hint} mb-2`}>{t.rulesHint}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="cs-allow"><span className="inline-block w-2 h-2 rounded-full bg-[#12805c] mr-1.5" />{t.rulesAllow}</label>
              <textarea id="cs-allow" rows={4} className={`${area} text-[13px]`} value={allowText} placeholder={t.rulesAllowPlaceholder} spellCheck={false}
                onChange={e => { setAllowText(e.target.value); setP({ ...p, rules: { ...rulesOf(p), allow: parseRules(e.target.value) } }); }} />
            </div>
            <div>
              <label className={label} htmlFor="cs-deny"><span className="inline-block w-2 h-2 rounded-full bg-[#d93036] mr-1.5" />{t.rulesDeny}</label>
              <textarea id="cs-deny" rows={4} className={`${area} text-[13px]`} value={denyText} placeholder={t.rulesDenyPlaceholder} spellCheck={false}
                onChange={e => { setDenyText(e.target.value); setP({ ...p, rules: { ...rulesOf(p), deny: parseRules(e.target.value) } }); }} />
            </div>
          </div>
        </div>
        <button type="button" className={primary} onClick={() => persist()}>{saved ? <span className="inline-flex items-center gap-1.5"><Check size={15} /> {t.saved}</span> : t.save}</button>
      </section>

      <section>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[14.5px] font-semibold">{t.customCommands}</h3>
          <button type="button" className={ghost} onClick={() => { setErr(''); setCmd({ id: uid('cmd_'), name: '', description: '', template: '' }); }}><Plus size={14} /> {t.addCommand}</button>
        </div>
        <p className={hint}>{t.customCommandsHint}</p>
        <ul className="mt-3 space-y-1.5">
          {p.customCommands.map(c => (
            <li key={c.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-[#eceef2]">
              <span className="font-mono text-[13px] text-[#15171c]">/{c.name}</span>
              <span className="text-[12.5px] text-[#727a88] truncate flex-1">{c.description}</span>
              <button type="button" aria-label={t.edit} onClick={() => { setErr(''); setCmd(c); }} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#f2f4f7]"><Pencil size={14} /></button>
              <button type="button" aria-label={t.delete} onClick={async () => { const next = { ...p, customCommands: p.customCommands.filter(x => x.id !== c.id) }; setP(next); await persist(next); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#d93036] hover:bg-[#fdf2f2]"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
        {cmd && (
          <div className="mt-3 p-3 rounded-2xl border border-[#e4e7ec] space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className={label}>{t.commandName}</label><input className={input} value={cmd.name} maxLength={40} placeholder="test" onChange={e => setCmd({ ...cmd, name: e.target.value })} /></div>
              <div><label className={label}>{t.commandDescription}</label><input className={input} value={cmd.description} maxLength={200} onChange={e => setCmd({ ...cmd, description: e.target.value })} /></div>
            </div>
            <div><label className={label}>{t.commandTemplate}</label><textarea rows={5} className={area} value={cmd.template} maxLength={20_000} placeholder="Write unit tests for $ARGUMENTS and run them." onChange={e => setCmd({ ...cmd, template: e.target.value })} /></div>
            {err && <p className="text-[12.5px] text-[#d93036]">{err}</p>}
            <div className="flex gap-2"><button type="button" className={primary} onClick={saveCmd} disabled={!cmd.name.trim() || !cmd.template.trim()}>{t.save}</button><button type="button" className={ghost} onClick={() => setCmd(null)}>{t.cancel}</button></div>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[14.5px] font-semibold">{t.subagents}</h3>
          <button type="button" className={ghost} onClick={() => { setErr(''); setAgent({ id: uid('ag_'), name: '', description: '', instructions: '', tools: 'readonly' }); }}><Plus size={14} /> {t.addAgent}</button>
        </div>
        <p className={hint}>{t.subagentsHint}</p>
        <ul className="mt-3 space-y-1.5">
          {p.customAgents.map(a => (
            <li key={a.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-[#eceef2]">
              <Bot size={14} className="text-[#5b34c7] shrink-0" />
              <span className="font-mono text-[13px] text-[#15171c]">{a.name}</span>
              <span className="text-[12.5px] text-[#727a88] truncate flex-1">{a.description}</span>
              <button type="button" aria-label={t.edit} onClick={() => { setErr(''); setAgent(a); }} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#f2f4f7]"><Pencil size={14} /></button>
              <button type="button" aria-label={t.delete} onClick={async () => { const next = { ...p, customAgents: p.customAgents.filter(x => x.id !== a.id) }; setP(next); await persist(next); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#d93036] hover:bg-[#fdf2f2]"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
        {agent && (
          <div className="mt-3 p-3 rounded-2xl border border-[#e4e7ec] space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className={label}>{t.agentName}</label><input className={input} value={agent.name} maxLength={40} placeholder="security-reviewer" onChange={e => setAgent({ ...agent, name: e.target.value })} /></div>
              <div>
                <label className={label}>{t.agentModel}</label>
                <select className={input} value={agent.model ?? ''} onChange={e => setAgent({ ...agent, model: e.target.value || undefined })}>
                  <option value="">{t.agentInherit}</option>
                  {Object.values(STUDIO_MODELS).map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div><label className={label}>{t.agentDescription}</label><input className={input} value={agent.description} maxLength={500} onChange={e => setAgent({ ...agent, description: e.target.value })} /></div>
            <div><label className={label}>{t.agentInstructions}</label><textarea rows={6} className={area} value={agent.instructions} maxLength={12_000} onChange={e => setAgent({ ...agent, instructions: e.target.value })} /></div>
            <div>
              <span className={label}>{t.agentTools}</span>
              <div className="flex flex-col gap-1.5">
                {(['readonly', 'edit'] as const).map(k => (
                  <label key={k} className="flex items-center gap-2 text-[13px]"><input type="radio" name="agent-tools" checked={agent.tools === k} onChange={() => setAgent({ ...agent, tools: k })} className="accent-[#15171c]" />{k === 'readonly' ? t.agentReadonly : t.agentEdit}</label>
                ))}
              </div>
            </div>
            {err && <p className="text-[12.5px] text-[#d93036]">{err}</p>}
            <div className="flex gap-2"><button type="button" className={primary} onClick={saveAgent} disabled={!agent.name.trim() || !agent.description.trim() || !agent.instructions.trim()}>{t.save}</button><button type="button" className={ghost} onClick={() => setAgent(null)}>{t.cancel}</button></div>
          </div>
        )}
      </section>
    </div>
  );
}
