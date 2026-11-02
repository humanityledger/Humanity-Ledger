'use client';

/**
 * The Apps tab of a community: the tools a community runs inside its own
 * space. Members add a ready-made one or describe what they need and a model
 * writes it. Every app starts as a draft only its creator sees; publishing
 * puts it in front of the whole community.
 *
 * Monochrome on purpose. Apps are tools, not features to advertise.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Plus, X, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { AppFrame } from './AppFrame';

interface Identity { id: string; label: string }
interface AppSummary {
  id: string;
  title: string;
  summary: string;
  status: 'draft' | 'published';
  version: number;
  source: 'model' | 'template';
  templateId: string | null;
  creator: Identity;
  mine: boolean;
  canRemove: boolean;
  updatedAt: string;
}
interface TemplateInfo { id: string; title: { es: string; en: string }; summary: { es: string; en: string } }
interface ListResponse {
  apps: AppSummary[];
  templates: TemplateInfo[];
  canCreate: boolean;
  canGenerate: boolean;
  generationConfigured: boolean;
}

type Selection = { kind: 'app'; id: string } | { kind: 'new' } | null;

export interface CommunityAppsProps {
  communityId: string;
  communityName: string;
}

const EXAMPLES = {
  es: [
    'Quién trae qué a la cena del sábado, con lo que falta por cubrir',
    'Un marcador de la liga de pádel: partidos, resultados y clasificación',
    'Reparto de gastos del viaje: quién pagó qué y quién debe a quién',
    'Un tablón de préstamos: qué cosas se prestan y a quién',
  ],
  en: [
    'Who brings what to Saturday dinner, with what is still missing',
    'A league table for our padel games: matches, scores and standings',
    'Split trip expenses: who paid what and who owes whom',
    'A board for lending things: what is lent and to whom',
  ],
};

function lang(): 'es' | 'en' {
  if (typeof navigator === 'undefined') return 'en';
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(body.error || `Request failed (${res.status}).`);
    err.status = res.status;
    err.problems = body.problems;
    throw err;
  }
  return body as T;
}

function useElapsed(running: boolean) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!running) { setS(0); return; }
    const t0 = Date.now();
    const t = setInterval(() => setS(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(t);
  }, [running]);
  return s;
}

const btn = 'inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-full text-[13px] font-medium border transition-colors duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hl-ink)] disabled:opacity-40 disabled:pointer-events-none';
const btnPrimary = `${btn} bg-[var(--hl-ink)] border-[var(--hl-ink)] text-[var(--hl-ink-inverse)] hover:bg-[var(--hl-primary-hover)]`;
const btnSecondary = `${btn} bg-[var(--hl-bg)] border-[var(--hl-border-strong)] text-[var(--hl-ink)] hover:bg-[var(--hl-bg-hover)]`;
const btnGhost = `${btn} bg-transparent border-transparent text-[var(--hl-ink-2)] hover:bg-[var(--hl-bg-hover)] hover:text-[var(--hl-ink)]`;
const label = 'font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--hl-ink-3)]';

export function CommunityApps({ communityId, communityName }: CommunityAppsProps) {
  const base = `/api/chat/communities/${encodeURIComponent(communityId)}/apps`;
  const [data, setData] = useState<ListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const L = useMemo(lang, []);

  const load = useCallback(async () => {
    try {
      const d = await api<ListResponse>(base);
      setData(d);
      setLoadError(null);
      return d;
    } catch (e: any) {
      setLoadError(e.message);
      return null;
    }
  }, [base]);

  useEffect(() => {
    load().then(d => {
      if (!d) return;
      const first = d.apps.find(a => a.status === 'published');
      setSelection(prev => prev ?? (first && typeof window !== 'undefined' && window.innerWidth >= 768 ? { kind: 'app', id: first.id } : null));
    });
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const apps = data?.apps ?? [];
  const published = apps.filter(a => a.status === 'published');
  const drafts = apps.filter(a => a.status === 'draft');
  const selected = selection?.kind === 'app' ? apps.find(a => a.id === selection.id) ?? null : null;

  const addTemplate = async (templateId: string) => {
    setBusy(`template:${templateId}`);
    try {
      const { app } = await api<{ app: AppSummary }>(base, { method: 'POST', body: JSON.stringify({ templateId, lang: L }) });
      await load();
      setSelection({ kind: 'app', id: app.id });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const onCreated = async (app: AppSummary) => {
    await load();
    setSelection({ kind: 'app', id: app.id });
  };

  const showDetail = selection !== null;

  return (
    <div className="flex-1 min-h-0 w-full flex bg-[var(--hl-bg)]">
      {/* ── List ─────────────────────────────────────────────────────────── */}
      <aside
        className={`${showDetail ? 'hidden md:flex' : 'flex'} w-full md:w-[288px] shrink-0 flex-col min-h-0 border-r border-[var(--hl-border)] bg-[var(--hl-bg)]`}
        aria-label="Community apps"
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-[var(--hl-ink)]">Apps</h2>
            <p className="text-[12.5px] text-[var(--hl-ink-3)] truncate">Tools this community runs</p>
          </div>
          {data?.canCreate && (
            <button type="button" className={btnPrimary} onClick={() => setSelection({ kind: 'new' })}>
              <Plus size={14} strokeWidth={2.25} /> New
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pb-6">
          {!data && !loadError && (
            <div className="px-4 space-y-3" aria-hidden>
              {[0, 1, 2].map(i => <div key={i} className="h-12 rounded-[var(--hl-radius)] bg-[var(--hl-bg-muted)] animate-pulse motion-reduce:animate-none" />)}
            </div>
          )}
          {loadError && <p className="px-4 text-[13px] text-[var(--hl-ink-3)]">{loadError}</p>}

          {data && (
            <>
              <AppSection title="In this community" empty="Nothing published yet." apps={published} selectedId={selected?.id} onSelect={id => setSelection({ kind: 'app', id })} />
              {drafts.length > 0 && (
                <AppSection title="Your drafts" apps={drafts} selectedId={selected?.id} onSelect={id => setSelection({ kind: 'app', id })} />
              )}
            </>
          )}
        </div>
      </aside>

      {/* ── Detail ───────────────────────────────────────────────────────── */}
      <section className={`${showDetail ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 min-h-0 flex-col bg-[var(--hl-bg-subtle)]`}>
        {selection?.kind === 'new' && data ? (
          <NewApp
            base={base}
            lang={L}
            data={data}
            busy={busy}
            onBack={() => setSelection(null)}
            onTemplate={addTemplate}
            onCreated={onCreated}
          />
        ) : selected ? (
          <AppView
            key={selected.id}
            base={base}
            communityId={communityId}
            app={selected}
            generationConfigured={!!data?.generationConfigured}
            onBack={() => setSelection(null)}
            onChanged={load}
            onRemoved={async () => { setSelection(null); await load(); }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="max-w-sm text-center">
              <p className="text-[15px] font-semibold text-[var(--hl-ink)]">Apps for {communityName}</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--hl-ink-3)]">
                Polls, sign-up sheets, shared lists, or anything the community describes. Each app runs isolated from your account and keeps its data with the community.
              </p>
              {data?.canCreate && (
                <button type="button" className={`${btnSecondary} mt-5`} onClick={() => setSelection({ kind: 'new' })}>
                  <Plus size={14} /> New app
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

function AppSection({ title, empty, apps, selectedId, onSelect }: {
  title: string; empty?: string; apps: AppSummary[]; selectedId?: string; onSelect: (id: string) => void;
}) {
  return (
    <div className="mt-2">
      <p className={`${label} px-4 py-2`}>{title}</p>
      {apps.length === 0 && empty && <p className="px-4 pb-2 text-[13px] text-[var(--hl-ink-4)]">{empty}</p>}
      <ul>
        {apps.map(a => {
          const active = a.id === selectedId;
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onSelect(a.id)}
                aria-current={active ? 'true' : undefined}
                className={`relative w-full text-left px-4 py-2.5 transition-colors duration-[120ms] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--hl-ink)] ${active ? 'bg-[var(--hl-bg-subtle)]' : 'hover:bg-[var(--hl-bg-subtle)]'}`}
              >
                {active && <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-[var(--hl-ink)]" aria-hidden />}
                <span className={`block text-[14px] truncate text-[var(--hl-ink)] ${active ? 'font-semibold' : 'font-medium'}`}>{a.title}</span>
                {a.summary && <span className="block text-[12.5px] leading-snug text-[var(--hl-ink-3)] line-clamp-2 mt-0.5">{a.summary}</span>}
                <span className="block mt-1 font-mono text-[11px] text-[var(--hl-ink-4)]">
                  {a.mine ? 'You' : a.creator.label} · v{a.version}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

function NewApp({ base, lang, data, busy, onBack, onTemplate, onCreated }: {
  base: string;
  lang: 'es' | 'en';
  data: ListResponse;
  busy: string | null;
  onBack: () => void;
  onTemplate: (id: string) => void;
  onCreated: (app: AppSummary) => void;
}) {
  const [text, setText] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<{ message: string; problems?: string[] } | null>(null);
  const elapsed = useElapsed(running);
  const area = useRef<HTMLTextAreaElement>(null);

  const submit = async () => {
    const request = text.trim();
    if (request.length < 8 || running) return;
    setRunning(true);
    setError(null);
    try {
      const { app } = await api<{ app: AppSummary }>(`${base}/generate`, { method: 'POST', body: JSON.stringify({ request }) });
      onCreated(app);
    } catch (e: any) {
      setError({ message: e.message, problems: e.problems });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[640px] mx-auto px-4 md:px-8 py-6 md:py-10 flex flex-col gap-9">
        <header className="flex items-start gap-2">
          <button type="button" onClick={onBack} className={`${btnGhost} md:hidden -ml-2 px-2`} aria-label="Back to apps">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-[var(--hl-ink)]">New app</h1>
            <p className="mt-1 text-[14px] text-[var(--hl-ink-3)]">Describe what the community needs, or start from a ready-made app.</p>
          </div>
        </header>

        {/* Describe */}
        <section className="flex flex-col gap-3" aria-labelledby="describe-label">
          <label id="describe-label" htmlFor="describe" className={label}>Describe it</label>
          {data.generationConfigured ? (
            <>
              <div className="rounded-[var(--hl-radius-lg)] border border-[var(--hl-border)] bg-[var(--hl-bg)] focus-within:border-[var(--hl-border-strong)] transition-colors duration-[120ms]">
                <textarea
                  id="describe"
                  ref={area}
                  rows={4}
                  maxLength={2000}
                  value={text}
                  disabled={running}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
                  placeholder={EXAMPLES[lang][0]}
                  className="block w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-relaxed text-[var(--hl-ink)] placeholder:text-[var(--hl-ink-4)] outline-none"
                />
                <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-[var(--hl-border)]">
                  <span className="font-mono text-[11px] text-[var(--hl-ink-4)] tabular-nums">
                    {running ? `Writing · ${elapsed}s` : `${text.length} / 2000`}
                  </span>
                  <button type="button" className={btnPrimary} disabled={running || !data.canGenerate || text.trim().length < 8} onClick={submit}>
                    {running ? 'Writing…' : 'Write app'}
                  </button>
                </div>
                {running && (
                  <div className="h-[2px] overflow-hidden bg-[var(--hl-bg-muted)]" aria-hidden>
                    <div className="h-full w-1/3 bg-[var(--hl-ink)] animate-[hl-indeterminate_1.4s_ease-in-out_infinite] motion-reduce:animate-none" />
                  </div>
                )}
              </div>

              {running ? (
                <p className="text-[13px] text-[var(--hl-ink-3)]">
                  This can take a minute. If you leave, the draft still appears under Your drafts when it is ready.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES[lang].slice(1).map(ex => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => { setText(ex); area.current?.focus(); }}
                      className="text-left rounded-full border border-[var(--hl-border)] bg-[var(--hl-bg)] px-3 py-1.5 text-[12.5px] text-[var(--hl-ink-2)] hover:bg-[var(--hl-bg-hover)] hover:text-[var(--hl-ink)] transition-colors duration-[120ms]"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              )}

              {error && (
                <div className="border-l-2 border-[var(--hl-ink)] pl-3 py-1" role="alert">
                  <p className="text-[13.5px] font-medium text-[var(--hl-ink)]">{error.message}</p>
                  {error.problems?.length ? (
                    <ul className="mt-1 text-[12.5px] text-[var(--hl-ink-3)] list-disc pl-4">
                      {error.problems.map(p => <li key={p}>{p}</li>)}
                    </ul>
                  ) : null}
                </div>
              )}

              <p className="text-[12.5px] leading-relaxed text-[var(--hl-ink-3)]">
                Your description goes to the language model this server is configured with. Messages, members and addresses are not sent.
                The app runs isolated: no network, no access to your account, and it only sees the data people enter into it.
              </p>
            </>
          ) : (
            <div className="border-l-2 border-[var(--hl-border-strong)] pl-3 py-1">
              <p className="text-[13.5px] text-[var(--hl-ink)]">Writing apps from a description is not set up on this server.</p>
              <p className="mt-1 text-[12.5px] text-[var(--hl-ink-3)]">
                It needs <span className="font-mono">ANTHROPIC_API_KEY</span>, or <span className="font-mono">OPENAI_API_KEY</span> with <span className="font-mono">COMMUNITY_APPS_MODEL</span>. The ready-made apps below work without it.
              </p>
            </div>
          )}
        </section>

        {/* Ready-made */}
        <section className="flex flex-col gap-3">
          <p className={label}>Ready-made</p>
          <ul className="rounded-[var(--hl-radius-lg)] border border-[var(--hl-border)] bg-[var(--hl-bg)] divide-y divide-[var(--hl-border)]">
            {data.templates.map(t => (
              <li key={t.id} className="flex items-center gap-4 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-[var(--hl-ink)]">{t.title[lang]}</p>
                  <p className="text-[12.5px] leading-snug text-[var(--hl-ink-3)]">{t.summary[lang]}</p>
                </div>
                <button type="button" className={btnSecondary} disabled={!!busy || !data.canCreate} onClick={() => onTemplate(t.id)}>
                  {busy === `template:${t.id}` ? 'Adding…' : 'Add'}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[12.5px] text-[var(--hl-ink-3)]">Added apps start as your draft. Set them up, then publish them to the community.</p>
        </section>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

function AppView({ base, communityId, app, generationConfigured, onBack, onChanged, onRemoved }: {
  base: string;
  communityId: string;
  app: AppSummary;
  generationConfigured: boolean;
  onBack: () => void;
  onChanged: () => Promise<unknown>;
  onRemoved: () => void;
}) {
  const [version, setVersion] = useState(app.version);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeText, setChangeText] = useState('');
  const [revising, setRevising] = useState(false);
  const [reviseError, setReviseError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [working, setWorking] = useState(false);
  const elapsed = useElapsed(revising);
  const draft = app.status === 'draft';
  const url = `${base}/${encodeURIComponent(app.id)}`;

  useEffect(() => { setVersion(app.version); setRuntimeError(null); }, [app.version]);
  useEffect(() => {
    if (!confirmRemove) return;
    const t = setTimeout(() => setConfirmRemove(false), 4000);
    return () => clearTimeout(t);
  }, [confirmRemove]);

  const revise = async (request: string, error?: string) => {
    if (revising) return;
    setRevising(true);
    setReviseError(null);
    try {
      const { app: next } = await api<{ app: AppSummary }>(`${base}/generate`, {
        method: 'POST',
        body: JSON.stringify({ request, appId: app.id, runtimeError: error }),
      });
      setVersion(next.version);
      setRuntimeError(null);
      setChangeText('');
      setChangeOpen(false);
      await onChanged();
    } catch (e: any) {
      setReviseError(e.problems?.length ? `${e.message} ${e.problems.join(' ')}` : e.message);
    } finally {
      setRevising(false);
    }
  };

  const patch = async (action: 'publish' | 'unpublish') => {
    setWorking(true);
    try {
      await api(url, { method: 'PATCH', body: JSON.stringify({ action }) });
      await onChanged();
      toast.success(action === 'publish' ? 'Published to the community' : 'Moved back to your drafts');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setWorking(false);
    }
  };

  const remove = async () => {
    if (!confirmRemove) { setConfirmRemove(true); return; }
    setWorking(true);
    try {
      await api(url, { method: 'DELETE' });
      toast.success('App removed');
      onRemoved();
    } catch (e: any) {
      toast.error(e.message);
      setWorking(false);
    }
  };

  const showCode = async () => {
    try {
      const { app: full } = await api<{ app: { html: string } }>(url);
      setCode(full.html);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 bg-[var(--hl-bg)] border-b border-[var(--hl-border)] px-4 py-3 flex flex-col gap-2.5">
        <div className="flex items-start gap-2">
          <button type="button" onClick={onBack} className={`${btnGhost} md:hidden -ml-2 px-2`} aria-label="Back to apps">
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-[15px] font-semibold text-[var(--hl-ink)] truncate">{app.title}</h2>
              {draft && <span className="shrink-0 rounded-full border border-[var(--hl-border-strong)] px-2 py-px font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--hl-ink-3)]">Draft</span>}
            </div>
            <p className="font-mono text-[11px] text-[var(--hl-ink-4)] truncate">
              {app.mine ? 'Made by you' : `Made by ${app.creator.label}`} · v{version} · Data readable by the server
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
            {app.mine && draft && <button type="button" className={btnPrimary} disabled={working} onClick={() => patch('publish')}>Publish</button>}
            {app.mine && generationConfigured && (
              <button type="button" className={btnSecondary} aria-expanded={changeOpen} onClick={() => setChangeOpen(o => !o)}>Change</button>
            )}
            <button type="button" className={btnGhost} onClick={showCode}>Code</button>
            {app.mine && !draft && <button type="button" className={btnGhost} disabled={working} onClick={() => patch('unpublish')}>Unpublish</button>}
            {app.canRemove && (
              <button type="button" className={confirmRemove ? btnSecondary : btnGhost} disabled={working} onClick={remove}>
                {confirmRemove ? 'Confirm remove' : 'Remove'}
              </button>
            )}
          </div>
        </div>

        {draft && (
          <p className="text-[12.5px] text-[var(--hl-ink-3)]">Only you can see this draft. Try it and set it up here; what you enter stays when you publish.</p>
        )}

        {changeOpen && (
          <form
            className="flex flex-col gap-2"
            onSubmit={e => { e.preventDefault(); if (changeText.trim().length >= 8) revise(changeText.trim()); }}
          >
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={changeText}
                disabled={revising}
                maxLength={2000}
                onChange={e => setChangeText(e.target.value)}
                placeholder="What should change? For example: add a deadline and show who has not answered"
                aria-label="Describe the change"
                className="flex-1 min-w-0 h-9 rounded-full border border-[var(--hl-border)] bg-[var(--hl-bg-subtle)] px-4 text-[13.5px] text-[var(--hl-ink)] placeholder:text-[var(--hl-ink-4)] outline-none focus:border-[var(--hl-border-strong)] focus:bg-[var(--hl-bg)]"
              />
              <button type="submit" className={btnPrimary} disabled={revising || changeText.trim().length < 8}>
                {revising ? `Writing · ${elapsed}s` : 'Apply'}
              </button>
              <button type="button" className={btnGhost} onClick={() => setChangeOpen(false)} aria-label="Close">
                <X size={15} />
              </button>
            </div>
            <p className="text-[12px] text-[var(--hl-ink-4)]">The new version replaces this one{draft ? '' : ' for everyone'}. Data already entered is kept.</p>
          </form>
        )}

        {reviseError && <p className="border-l-2 border-[var(--hl-ink)] pl-3 text-[13px] text-[var(--hl-ink)]" role="alert">{reviseError}</p>}

        {runtimeError && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-l-2 border-[var(--hl-ink)] pl-3" role="alert">
            <p className="text-[13px] text-[var(--hl-ink)] min-w-0 flex-1">
              <span className="font-medium">The app stopped with an error.</span>{' '}
              <span className="font-mono text-[12px] text-[var(--hl-ink-3)] break-words">{runtimeError}</span>
            </p>
            {app.mine && generationConfigured ? (
              <button type="button" className={btnSecondary} disabled={revising} onClick={() => revise('Fix the error so the app works as intended.', runtimeError)}>
                {revising ? `Fixing · ${elapsed}s` : 'Fix it'}
              </button>
            ) : (
              <span className="text-[12.5px] text-[var(--hl-ink-3)]">Tell {app.mine ? 'an admin' : app.creator.label} so it can be fixed.</span>
            )}
          </div>
        )}
      </div>

      <AppFrame
        communityId={communityId}
        appId={app.id}
        version={version}
        title={app.title}
        onRuntimeError={msg => setRuntimeError(prev => prev ?? msg)}
        onWriteRejected={msg => toast.error(msg)}
        onVersionChange={v => { setVersion(v); onChanged(); }}
      />

      {code !== null && <CodeSheet code={code} title={app.title} version={version} onClose={() => setCode(null)} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

function CodeSheet({ code, title, version, onClose }: { code: string; title: string; version: number; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 p-0 md:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Source of ${title}`}
        onClick={e => e.stopPropagation()}
        className="w-full md:max-w-3xl max-h-[85vh] flex flex-col bg-[var(--hl-bg)] rounded-t-[var(--hl-radius-xl)] md:rounded-[var(--hl-radius-xl)] shadow-[var(--hl-shadow-lg)] overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--hl-border)]">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[var(--hl-ink)] truncate">{title}</p>
            <p className="font-mono text-[11px] text-[var(--hl-ink-4)]">HTML · v{version} · {code.length.toLocaleString()} characters</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className={btnSecondary}
              onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" className={btnGhost} onClick={onClose} aria-label="Close"><X size={16} /></button>
          </div>
        </div>
        <pre className="flex-1 overflow-auto px-4 py-3 font-mono text-[12px] leading-[1.6] text-[var(--hl-ink-2)] bg-[var(--hl-bg-subtle)] whitespace-pre">{code}</pre>
      </div>
    </div>
  );
}
