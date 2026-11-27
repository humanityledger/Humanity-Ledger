'use client';

/**
 * The Apps tab of a community: the tools a community runs inside its own
 * space. Members add a ready-made one or describe what they need and a model
 * writes it. Every app starts as a draft only its creator sees; publishing
 * puts it in front of the whole community.
 *
 * Monochrome on purpose. Apps are tools, not features to advertise.
 *
 * Layout (V2): a full-width catalog, then an app opens across the whole space
 * below a 52 px command bar; Edit code splits that space into code and a live,
 * sandboxed preview. Nothing is squeezed beside a list any more.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Plus, X, Copy, Check, Code2, EyeOff, RotateCcw, Search, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppFrame } from './AppFrame';
import { ErrorState } from '../ErrorState';
import { useT } from '@/lib/i18n/client';
import { buildAppDocument } from '@/lib/community-apps/sdk';
import { validateAppHtml } from '@/lib/community-apps/validate';
import { APP_FRAME_SANDBOX } from '@/lib/community-apps/framePolicy';

interface Identity { id: string; label: string }
interface AppSummary {
  id: string;
  title: string;
  summary: string;
  status: 'draft' | 'published';
  version: number;
  source: 'model' | 'template' | 'manual';
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

/** A failed request, with what the server said about it (routeErrors.ts). */
class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly errorId?: string, readonly problems?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection.', 0, 'NETWORK');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fallback = res.status === 401 ? 'Your session has ended. Sign in again.'
      : res.status === 403 ? 'You do not have access to this.'
      : res.status === 404 ? 'This was not found.'
      : res.status === 429 ? 'Too many requests. Wait a moment and try again.'
      : 'Something went wrong on the server.';
    throw new ApiError(typeof body.error === 'string' && body.error ? body.error : fallback, res.status, body.code, body.errorId, body.problems);
  }
  return body as T;
}

/** Title and explanation for the Apps list failing to load. */
function describeLoadError(e: ApiError): { title: string; message: string } {
  switch (e.code) {
    case 'APPS_NOT_PROVISIONED':
    case 'APPS_CLIENT_OUTDATED':
      return {
        title: 'Apps are not set up on this server',
        message: 'The server is missing the storage for community apps. Whoever runs it can add it; nothing in this community is lost.',
      };
    case 'DATABASE_UNAVAILABLE':
      return { title: 'The server cannot reach its database', message: 'This is usually brief. Try again in a moment.' };
    case 'NETWORK':
      return { title: 'You appear to be offline', message: 'Apps will load when your connection is back.' };
    default:
      if (e.status === 401) return { title: 'Your session has ended', message: 'Sign in again to see this community\'s apps.' };
      return { title: 'Apps could not load', message: e.message };
  }
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

const btn = 'inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-full text-[14px] font-medium border transition-colors duration-[120ms] ease-[var(--hl-ease)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hl-ink)] disabled:opacity-40 disabled:pointer-events-none';
const btnPrimary = `${btn} bg-[var(--hl-ink)] border-[var(--hl-ink)] text-[var(--hl-ink-inverse)] hover:bg-[var(--hl-primary-hover)]`;
const btnSecondary = `${btn} bg-[var(--hl-bg)] border-[var(--hl-border-strong)] text-[var(--hl-ink)] hover:bg-[var(--hl-bg-hover)]`;
const btnGhost = `${btn} bg-transparent border-transparent text-[var(--hl-ink-2)] hover:bg-[var(--hl-bg-hover)] hover:text-[var(--hl-ink)]`;
const btnDanger = `${btn} bg-[var(--hl-bg)] border-[var(--hl-danger)] text-[var(--hl-danger)] hover:bg-[var(--hl-danger-subtle)]`;
const label = 'font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--hl-ink-3)]';
/** The whole space below Manage's header: no fixed widths, no side columns. */
const shell = 'flex-1 min-h-0 w-full flex flex-col bg-[var(--hl-bg)]';

type Filter = 'all' | 'published' | 'drafts';

function StatusBadge({ draft }: { draft: boolean }) {
  const tr = useT();
  return draft ? (
    <span className="shrink-0 rounded-full border border-[var(--hl-border-strong)] px-2 py-px font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--hl-ink-3)]">{tr("Draft")}</span>
  ) : (
    <span className="shrink-0 rounded-full bg-[var(--hl-success-subtle)] px-2 py-px font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--hl-success)]">{tr("Published")}</span>
  );
}

export function CommunityApps({ communityId, communityName }: CommunityAppsProps) {
  const tr = useT();
  const base = `/api/chat/communities/${encodeURIComponent(communityId)}/apps`;
  const [data, setData] = useState<ListResponse | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [armed, setArmed] = useState<string | null>(null);
  const L = useMemo(lang, []);

  const load = useCallback(async () => {
    try {
      const d = await api<ListResponse>(base);
      setData(d);
      setLoadError(null);
      return d;
    } catch (e) {
      setLoadError(e instanceof ApiError ? e : new ApiError('Apps could not load.', 0));
      return null;
    }
  }, [base]);
  // A missing table will not fix itself in 30 s: stop polling until a manual retry.
  const pollRef = useRef(true);
  useEffect(() => {
    pollRef.current = !(loadError && (loadError.code === 'APPS_NOT_PROVISIONED' || loadError.code === 'APPS_CLIENT_OUTDATED'));
  }, [loadError]);

  useEffect(() => {
    void load();
    const t = setInterval(() => { if (pollRef.current && document.visibilityState === 'visible') load(); }, 30_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const apps = useMemo(() => data?.apps ?? [], [data]);
  const selected = selection?.kind === 'app' ? apps.find(a => a.id === selection.id) ?? null : null;
  // An app removed by someone else while it was open: back to the catalog.
  useEffect(() => {
    if (selection?.kind === 'app' && data && !data.apps.some(a => a.id === selection.id)) setSelection(null);
  }, [selection, data]);

  const counts = useMemo(() => ({
    all: apps.length,
    published: apps.filter(a => a.status === 'published').length,
    drafts: apps.filter(a => a.status === 'draft').length,
  }), [apps]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps
      .filter(a => filter === 'all' || (filter === 'published' ? a.status === 'published' : a.status === 'draft'))
      .filter(a => !q || `${a.title} ${a.summary} ${a.creator.label}`.toLowerCase().includes(q))
      .sort((a, b) => (a.status === b.status ? (a.updatedAt < b.updatedAt ? 1 : -1) : a.status === 'published' ? -1 : 1));
  }, [apps, filter, query]);

  const addTemplate = async (templateId: string) => {
    setBusy(`template:${templateId}`);
    try {
      const { app } = await api<{ app: AppSummary }>(base, { method: 'POST', body: JSON.stringify({ templateId, lang: L }) });
      await load();
      setSelection({ kind: 'app', id: app.id });
    } catch (e: any) {
      toast.error(tr(e.message));
    } finally {
      setBusy(null);
    }
  };

  const onCreated = async (app: AppSummary) => {
    await load();
    setSelection({ kind: 'app', id: app.id });
  };

  const removeApp = async (a: AppSummary) => {
    if (armed !== a.id) { setArmed(a.id); return; }
    setBusy(`remove:${a.id}`);
    try {
      await api(`${base}/${encodeURIComponent(a.id)}`, { method: 'DELETE' });
      toast.success(tr("App removed"));
      setArmed(null);
      await load();
    } catch (e: any) {
      toast.error(tr(e.message));
    } finally {
      setBusy(null);
    }
  };

  if (selection?.kind === 'app' && selected) {
    return (
      <div className={shell}>
        <AppView
          key={selected.id}
          base={base}
          communityId={communityId}
          communityName={communityName}
          app={selected}
          generationConfigured={!!data?.generationConfigured}
          onBack={() => setSelection(null)}
          onChanged={load}
          onRemoved={async () => { setSelection(null); await load(); }}
        />
      </div>
    );
  }

  if (selection?.kind === 'new' && data) {
    return (
      <div className={shell}>
        <NewApp base={base} lang={L} data={data} busy={busy} onBack={() => setSelection(null)} onTemplate={addTemplate} onCreated={onCreated} />
      </div>
    );
  }

  const filters: Array<{ id: Filter; text: string }> = [
    { id: 'all', text: tr("All") },
    { id: 'published', text: tr("Published") },
    { id: 'drafts', text: tr("Drafts") },
  ];

  return (
    <div className={shell}>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="w-full max-w-[1160px] mx-auto px-4 sm:px-8 py-6 flex flex-col gap-6" aria-label={tr("Community apps")}>
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-[var(--hl-ink)] truncate">{tr("Apps for {communityName}", { communityName })}</h2>
              <p className="mt-1 text-[14px] leading-relaxed text-[var(--hl-ink-3)] max-w-[640px]">
                {tr("Polls, sign-up sheets, shared lists, or anything the community describes. Each app runs isolated from your account and keeps its data with the community.")}
              </p>
            </div>
            {data?.canCreate && (
              <button type="button" className={btnPrimary} onClick={() => setSelection({ kind: 'new' })}>
                <Plus size={16} strokeWidth={2.25} aria-hidden />{tr("New app")}
              </button>
            )}
          </header>

          {!data && !loadError && (
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]" aria-hidden>
              {[0, 1, 2].map(i => <div key={i} className="h-[148px] rounded-[var(--hl-radius-lg)] bg-[var(--hl-bg-muted)]" />)}
            </div>
          )}
          {loadError && !data && (
            <div className="flex justify-center pt-10">
              <ErrorState {...describeLoadError(loadError)} errorId={loadError.errorId} onRetry={load} />
            </div>
          )}

          {data && (
            <>
              {apps.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="relative flex-1 min-w-[200px]">
                    <span className="sr-only">{tr("Search apps")}</span>
                    <Search size={16} aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--hl-ink-3)]" />
                    <input
                      type="search"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder={tr("Search apps")}
                      className="w-full min-h-[44px] rounded-full border border-[var(--hl-border)] bg-[var(--hl-bg-subtle)] pl-10 pr-4 text-[15px] text-[var(--hl-ink)] placeholder:text-[var(--hl-ink-4)] outline-none focus:border-[var(--hl-border-strong)] focus:bg-[var(--hl-bg)]"
                    />
                  </label>
                  <div role="tablist" aria-label={tr("Filter apps")} className="flex gap-1 rounded-full bg-[var(--hl-bg-muted)] p-1">
                    {filters.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        role="tab"
                        aria-selected={filter === f.id}
                        onClick={() => setFilter(f.id)}
                        className={`min-h-[40px] rounded-full px-3.5 text-[13.5px] font-medium transition-colors duration-[120ms] ${filter === f.id ? 'bg-[var(--hl-bg)] text-[var(--hl-ink)] shadow-[var(--hl-shadow-xs)]' : 'text-[var(--hl-ink-3)] hover:text-[var(--hl-ink)]'}`}
                      >
                        {f.text} <span className="tabular-nums text-[var(--hl-ink-4)]">{counts[f.id]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {apps.length === 0 ? (
                <div className="rounded-[var(--hl-radius-lg)] border border-dashed border-[var(--hl-border-strong)] px-6 py-10 text-center">
                  <p className="text-[15px] font-semibold text-[var(--hl-ink)]">{tr("Nothing published yet.")}</p>
                  <p className="mt-1 text-[14px] text-[var(--hl-ink-3)]">{tr("Describe what the community needs, or start from a ready-made app.")}</p>
                </div>
              ) : shown.length === 0 ? (
                <p className="text-[14px] text-[var(--hl-ink-3)]" role="status">{tr("No apps match your search.")}</p>
              ) : (
                <ul className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
                  {shown.map(a => (
                    <li key={a.id}>
                      <article className="h-full flex flex-col gap-2 rounded-[var(--hl-radius-lg)] border border-[var(--hl-border)] bg-[var(--hl-bg)] p-4 shadow-[var(--hl-shadow-xs)] transition-colors duration-[120ms] hover:border-[var(--hl-border-strong)]">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[16px] font-semibold leading-snug text-[var(--hl-ink)] line-clamp-2">{tr(a.title)}</h3>
                          <StatusBadge draft={a.status === 'draft'} />
                        </div>
                        {a.summary && <p className="text-[14px] leading-snug text-[var(--hl-ink-3)] line-clamp-2">{tr(a.summary)}</p>}
                        <p className="mt-auto font-mono text-[11.5px] text-[var(--hl-ink-4)] truncate">{a.mine ? tr("You") : a.creator.label} · v{a.version}</p>
                        <div className="flex items-center gap-2 pt-1">
                          <button type="button" className={`${btnPrimary} flex-1`} onClick={() => setSelection({ kind: 'app', id: a.id })}>{tr("Open")}</button>
                          {a.canRemove && (
                            <button type="button" className={armed === a.id ? btnDanger : btnGhost} disabled={busy === `remove:${a.id}`} onClick={() => removeApp(a)}>
                              {armed === a.id ? tr("Confirm remove") : tr("Remove")}
                            </button>
                          )}
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              )}

              {data.canCreate && data.templates.length > 0 && (
                <section className="flex flex-col gap-3" aria-labelledby="apps-ready-made">
                  <h3 id="apps-ready-made" className={label}>{tr("Ready-made")}</h3>
                  <ul className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
                    {data.templates.map(t => (
                      <li key={t.id} className="flex flex-col gap-2 rounded-[var(--hl-radius-lg)] border border-[var(--hl-border)] bg-[var(--hl-bg-subtle)] p-4">
                        <p className="text-[15px] font-semibold text-[var(--hl-ink)]">{t.title[L]}</p>
                        <p className="text-[13.5px] leading-snug text-[var(--hl-ink-3)] flex-1">{t.summary[L]}</p>
                        <button type="button" className={btnSecondary} disabled={!!busy} onClick={() => addTemplate(t.id)}>
                          {busy === `template:${t.id}` ? tr("Adding…") : tr("Add")}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[12.5px] text-[var(--hl-ink-3)]">{tr("Added apps start as your draft. Set them up, then publish them to the community.")}</p>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

/** What happens while a model writes an app, in order. The step shown follows the time spent. */
const STAGES = ['Analyzing the need', 'Writing the app', 'Checking the sandbox rules'] as const;
function stageAt(elapsed: number): number {
  return elapsed < 4 ? 0 : elapsed < 45 ? 1 : 2;
}

function NewApp({ base, lang, data, busy, onBack, onTemplate, onCreated }: {
  base: string;
  lang: 'es' | 'en';
  data: ListResponse;
  busy: string | null;
  onBack: () => void;
  onTemplate: (id: string) => void;
  onCreated: (app: AppSummary) => void;
}) {
  const tr = useT();
  const [text, setText] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<{ message: string; problems?: string[] } | null>(null);
  const elapsed = useElapsed(running);
  const area = useRef<HTMLTextAreaElement>(null);
  const stage = stageAt(elapsed);

  useEffect(() => { area.current?.focus(); }, []);

  const submit = async () => {
    const request = text.trim();
    if (request.length < 8 || running) return;
    setRunning(true);
    setError(null);
    try {
      const { app } = await api<{ app: AppSummary }>(`${base}/generate`, { method: 'POST', body: JSON.stringify({ request }) });
      toast.success(tr("Your app is ready as a draft."));
      onCreated(app);
    } catch (e: any) {
      setError({ message: e.message, problems: Array.isArray(e.problems) ? e.problems : undefined });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 h-[52px] flex items-center gap-2 px-2 sm:px-3 border-b border-[var(--hl-border)] bg-[var(--hl-bg)]">
        <button type="button" onClick={onBack} className={btnGhost} aria-label={tr("All apps")}>
          <ArrowLeft size={18} aria-hidden /><span className="hidden sm:inline">{tr("All apps")}</span>
        </button>
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[var(--hl-ink)]">{tr("New app")}</h2>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-8 py-8 flex flex-col gap-9">
          <header>
            <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-[var(--hl-ink)]">{tr("Describe the app you need")}</h1>
            <p className="mt-1.5 text-[15px] text-[var(--hl-ink-3)]">{tr("Describe what the community needs, or start from a ready-made app.")}</p>
          </header>

          <section className="flex flex-col gap-3" aria-labelledby="describe-label">
            <label id="describe-label" htmlFor="describe" className={label}>{tr("Describe it")}</label>
            {data.generationConfigured ? (
              <>
                <div className="rounded-[var(--hl-radius-lg)] border border-[var(--hl-border)] bg-[var(--hl-bg)] focus-within:border-[var(--hl-border-strong)] transition-colors duration-[120ms]">
                  <textarea
                    id="describe"
                    ref={area}
                    rows={6}
                    maxLength={2000}
                    value={text}
                    disabled={running}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
                    placeholder={tr(EXAMPLES[lang][0])}
                    className="block w-full min-h-[160px] resize-y bg-transparent px-4 py-3 text-[16px] leading-relaxed text-[var(--hl-ink)] placeholder:text-[var(--hl-ink-4)] outline-none"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-t border-[var(--hl-border)]">
                    <span className="font-mono text-[11px] text-[var(--hl-ink-4)] tabular-nums">
                      {running ? tr("Writing · {elapsed}s", { elapsed }) : `${text.length} / 2000 · ${tr("Ctrl+Enter to write")}`}
                    </span>
                    <button type="button" className={btnPrimary} disabled={running || !data.canGenerate || text.trim().length < 8} onClick={submit}>
                      {running ? tr("Writing…") : tr("Write app")}
                    </button>
                  </div>
                </div>

                {running ? (
                  <div className="flex flex-col gap-3" role="status" aria-live="polite">
                    <ol className="flex flex-wrap gap-2">
                      {STAGES.map((s, i) => (
                        <li
                          key={s}
                          className={`rounded-full border px-3 py-1.5 text-[13px] ${i < stage ? 'border-[var(--hl-border)] text-[var(--hl-ink-3)]' : i === stage ? 'border-[var(--hl-ink)] text-[var(--hl-ink)] font-medium' : 'border-[var(--hl-border)] text-[var(--hl-ink-4)]'}`}
                          aria-current={i === stage ? 'step' : undefined}
                        >
                          {i + 1}. {tr(s)}
                        </li>
                      ))}
                    </ol>
                    <div className="h-1 rounded-full bg-[var(--hl-bg-muted)] overflow-hidden" aria-hidden>
                      <div className="h-full bg-[var(--hl-ink)] transition-[width] duration-700 ease-[var(--hl-ease)]" style={{ width: `${Math.min(92, 8 + elapsed * 1.4)}%` }} />
                    </div>
                    <p className="text-[13px] text-[var(--hl-ink-3)]">
                      {tr("This can take a minute. If you leave, the draft still appears under Your drafts when it is ready.")}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {EXAMPLES[lang].map(ex => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => { setText(tr(ex)); area.current?.focus(); }}
                        className="text-left min-h-[40px] rounded-full border border-[var(--hl-border)] bg-[var(--hl-bg)] px-3.5 py-2 text-[13.5px] text-[var(--hl-ink-2)] hover:bg-[var(--hl-bg-hover)] hover:text-[var(--hl-ink)] transition-colors duration-[120ms]"
                      >
                        {tr(ex)}
                      </button>
                    ))}
                  </div>
                )}

                {error && (
                  <div className="rounded-[var(--hl-radius)] border border-[var(--hl-danger)] bg-[var(--hl-danger-subtle)] px-4 py-3" role="alert">
                    <p className="text-[14px] font-medium text-[var(--hl-danger)]">{tr(error.message)}</p>
                    {error.problems?.length ? (
                      <ul className="mt-1 text-[13px] text-[var(--hl-ink-2)] list-disc pl-4">
                        {error.problems.map(p => <li key={p}>{tr(p)}</li>)}
                      </ul>
                    ) : null}
                  </div>
                )}

                <p className="text-[12.5px] leading-relaxed text-[var(--hl-ink-3)]">
                  {tr("Your description goes to the language model this server is configured with. Messages, members and addresses are not sent. The app runs isolated: no network, no access to your account, and it only sees the data people enter into it.")}
                </p>
              </>
            ) : (
              <div className="border-l-2 border-[var(--hl-border-strong)] pl-3 py-1">
                <p className="text-[13.5px] text-[var(--hl-ink)]">{tr("Writing apps from a description is not set up on this server.")}</p>
                <p className="mt-1 text-[12.5px] text-[var(--hl-ink-3)]">{tr("It needs {0}, or {1} with {2}. The ready-made apps below work without it.", { 0: <span className="font-mono">{tr("GROQ_API_KEY")}</span>, 1: <span className="font-mono">{tr("OPENAI_API_KEY")}</span>, 2: <span className="font-mono">{tr("COMMUNITY_APPS_MODEL")}</span> })}</p>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <p className={label}>{tr("Ready-made")}</p>
            <ul className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
              {data.templates.map(t => (
                <li key={t.id} className="flex flex-col gap-2 rounded-[var(--hl-radius-lg)] border border-[var(--hl-border)] bg-[var(--hl-bg)] p-4">
                  <p className="text-[15px] font-semibold text-[var(--hl-ink)]">{t.title[lang]}</p>
                  <p className="text-[13px] leading-snug text-[var(--hl-ink-3)] flex-1">{t.summary[lang]}</p>
                  <button type="button" className={btnSecondary} disabled={!!busy || !data.canCreate} onClick={() => onTemplate(t.id)}>
                    {busy === `template:${t.id}` ? tr("Adding…") : tr("Add")}
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-[12.5px] text-[var(--hl-ink-3)]">{tr("Added apps start as your draft. Set them up, then publish them to the community.")}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

function AppView({ base, communityId, communityName, app, generationConfigured, onBack, onChanged, onRemoved }: {
  base: string;
  communityId: string;
  communityName: string;
  app: AppSummary;
  generationConfigured: boolean;
  onBack: () => void;
  onChanged: () => Promise<unknown>;
  onRemoved: () => void;
}) {
  const tr = useT();
  const [version, setVersion] = useState(app.version);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeText, setChangeText] = useState('');
  const [revising, setRevising] = useState(false);
  const [reviseError, setReviseError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
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
      toast.success(tr("Saved as version {version}", { version: next.version }));
      await onChanged();
    } catch (e: any) {
      setReviseError(e.problems?.length ? `${tr(e.message)} ${e.problems.map((p: string) => tr(p)).join(' ')}` : tr(e.message));
    } finally {
      setRevising(false);
    }
  };

  const patch = async (action: 'publish' | 'unpublish') => {
    setWorking(true);
    try {
      await api(url, { method: 'PATCH', body: JSON.stringify({ action }) });
      await onChanged();
      toast.success(action === 'publish' ? tr("Published to the community") : tr("Moved back to your drafts"));
    } catch (e: any) {
      toast.error(tr(e.message));
    } finally {
      setWorking(false);
    }
  };

  const remove = async () => {
    if (!confirmRemove) { setConfirmRemove(true); return; }
    setWorking(true);
    try {
      await api(url, { method: 'DELETE' });
      toast.success(tr("App removed"));
      onRemoved();
    } catch (e: any) {
      toast.error(tr(e.message));
      setWorking(false);
    }
  };

  const codeLabel = app.mine ? tr("Edit code") : tr("View code");
  const notes = draft || changeOpen || !!reviseError || !!runtimeError;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Command bar: 52 px; everything below it is the app. */}
      <div className="shrink-0 h-[52px] flex items-center gap-1.5 px-2 sm:px-3 border-b border-[var(--hl-border)] bg-[var(--hl-bg)]">
        <button type="button" onClick={onBack} className={`${btnGhost} px-3`} aria-label={tr("All apps")} title={tr("All apps")}>
          <ArrowLeft size={18} aria-hidden /><span className="hidden lg:inline">{tr("All apps")}</span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-[15px] font-semibold text-[var(--hl-ink)] truncate">{tr(app.title)}</h2>
            <StatusBadge draft={draft} />
          </div>
          <p className="hidden sm:block font-mono text-[11px] text-[var(--hl-ink-4)] truncate">
            {tr("{value} · v{version} · Data readable by the server", { value: app.mine ? tr("Made by you") : tr("Made by {label}", { label: app.creator.label }), version })}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {app.mine && draft && <button type="button" className={btnPrimary} disabled={working} onClick={() => patch('publish')}>{tr("Publish")}</button>}
          {app.mine && !draft && (
            <button type="button" className={`${btnGhost} px-3`} disabled={working} onClick={() => patch('unpublish')} aria-label={tr("Unpublish")} title={tr("Unpublish")}>
              <EyeOff size={17} aria-hidden /><span className="hidden xl:inline">{tr("Unpublish")}</span>
            </button>
          )}
          {app.mine && generationConfigured && (
            <button type="button" className={`${btnGhost} px-3`} aria-expanded={changeOpen} onClick={() => setChangeOpen(o => !o)} aria-label={tr("Change with AI")} title={tr("Change with AI")}>
              <Sparkles size={17} aria-hidden /><span className="hidden xl:inline">{tr("Change with AI")}</span>
            </button>
          )}
          <button type="button" className={`${editing ? btnSecondary : btnGhost} px-3`} aria-pressed={editing} onClick={() => setEditing(v => !v)} aria-label={codeLabel} title={codeLabel}>
            <Code2 size={17} aria-hidden /><span className="hidden xl:inline">{codeLabel}</span>
          </button>
          {app.canRemove && (
            <button type="button" className={`${confirmRemove ? btnDanger : btnGhost} px-3`} disabled={working} onClick={remove} aria-label={confirmRemove ? tr("Confirm remove") : tr("Remove")} title={tr("Remove")}>
              <Trash2 size={17} aria-hidden /><span className={confirmRemove ? 'inline' : 'hidden xl:inline'}>{confirmRemove ? tr("Confirm remove") : tr("Remove")}</span>
            </button>
          )}
        </div>
      </div>

      {notes && (
        <div className="shrink-0 flex flex-col gap-2 px-4 py-2.5 border-b border-[var(--hl-border)] bg-[var(--hl-bg-subtle)]">
          {draft && !changeOpen && !runtimeError && !reviseError && (
            <p className="text-[12.5px] text-[var(--hl-ink-3)]">{tr("Only you can see this draft. Try it and set it up here; what you enter stays when you publish.")}</p>
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
                  placeholder={tr("What should change? For example: add a deadline and show who has not answered")}
                  aria-label={tr("Describe the change")}
                  className="flex-1 min-w-0 min-h-[44px] rounded-full border border-[var(--hl-border)] bg-[var(--hl-bg)] px-4 text-[15px] text-[var(--hl-ink)] placeholder:text-[var(--hl-ink-4)] outline-none focus:border-[var(--hl-border-strong)]"
                />
                <button type="submit" className={btnPrimary} disabled={revising || changeText.trim().length < 8}>
                  {revising ? tr("Writing · {elapsed}s", { elapsed }) : tr("Apply")}
                </button>
                <button type="button" className={`${btnGhost} px-3`} onClick={() => setChangeOpen(false)} aria-label={tr("Close")}>
                  <X size={16} aria-hidden />
                </button>
              </div>
              <p className="text-[12px] text-[var(--hl-ink-4)]">{tr("The new version replaces this one{value}. Data already entered is kept.", { value: draft ? '' : tr(" for everyone") })}</p>
            </form>
          )}
          {reviseError && <p className="border-l-2 border-[var(--hl-danger)] pl-3 text-[13px] text-[var(--hl-ink)]" role="alert">{reviseError}</p>}
          {runtimeError && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-l-2 border-[var(--hl-danger)] pl-3" role="alert">
              <p className="text-[13px] text-[var(--hl-ink)] min-w-0 flex-1">
                <span className="font-medium">{tr("The app stopped with an error.")}</span>{' '}
                <span className="font-mono text-[12px] text-[var(--hl-ink-3)] break-words">{runtimeError}</span>
              </p>
              {app.mine && generationConfigured ? (
                <button type="button" className={btnSecondary} disabled={revising} onClick={() => revise('Fix the error so the app works as intended.', runtimeError)}>
                  {revising ? tr("Fixing · {elapsed}s", { elapsed }) : tr("Fix it")}
                </button>
              ) : (
                <span className="text-[12.5px] text-[var(--hl-ink-3)]">{tr("Tell {value} so it can be fixed.", { value: app.mine ? tr("an admin") : app.creator.label })}</span>
              )}
              <button type="button" className={`${btnGhost} px-3`} onClick={() => setRuntimeError(null)} aria-label={tr("Close")}><X size={16} aria-hidden /></button>
            </div>
          )}
        </div>
      )}

      {editing ? (
        <CodeWorkspace
          url={url}
          communityName={communityName}
          title={app.title}
          version={version}
          editable={app.mine}
          onSaved={async (v) => { setVersion(v); setRuntimeError(null); await onChanged(); }}
        />
      ) : (
        <AppFrame
          communityId={communityId}
          appId={app.id}
          version={version}
          title={app.title}
          onRuntimeError={msg => setRuntimeError(prev => prev ?? msg)}
          onWriteRejected={msg => toast.error(tr(msg))}
          onVersionChange={v => { setVersion(v); onChanged(); }}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Code and live preview side by side (tabs on a phone). The preview loads the app frame route
 * in preview mode, a shell served with the frame's own CSP and sandbox, and hands it the
 * document being edited; its hl answers come from here and are never saved. Saving goes through
 * PATCH { html }, which runs the same checks on the server and bumps the version.
 */
function CodeWorkspace({ url, communityName, title, version, editable, onSaved }: {
  url: string;
  communityName: string;
  title: string;
  version: number;
  editable: boolean;
  onSaved: (version: number) => void | Promise<void>;
}) {
  const tr = useT();
  const [original, setOriginal] = useState<string | null>(null);
  const [source, setSource] = useState('');
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<{ message: string; problems?: string[] } | null>(null);
  const [pane, setPane] = useState<'code' | 'preview'>('code');
  const [previewKey, setPreviewKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const docRef = useRef('');

  useEffect(() => {
    let live = true;
    setLoadErr(null);
    api<{ app: { html: string } }>(url)
      .then(({ app }) => { if (live) { setOriginal(app.html); setSource(app.html); } })
      .catch((e: any) => { if (live) setLoadErr(e.message); });
    return () => { live = false; };
  }, [url, version]);

  // Rebuild the preview 400 ms after the last keystroke (only the creator previews edits).
  useEffect(() => {
    if (original === null || !editable) return;
    const t = setTimeout(() => { docRef.current = buildAppDocument(source, title); setPreviewKey(k => k + 1); }, 400);
    return () => clearTimeout(t);
  }, [source, title, original, editable]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const w = previewRef.current?.contentWindow;
      if (!w || event.source !== w) return;
      const m = event.data;
      if (!m || m.hl !== 1 || typeof m.op !== 'string') return;
      if (m.op === 'preview-ready') { w.postMessage({ hl: 1, op: 'preview', html: docRef.current }, '*'); return; }
      if (m.op === 'error') return;
      if (typeof m.id !== 'number') return;
      if (m.op === 'hello') {
        w.postMessage({ hl: 1, id: m.id, ok: true, result: {
          context: { me: { id: 'preview', label: tr("You"), isAdmin: true, isCreator: true }, community: { name: communityName }, app: { id: 'preview', title }, preview: true },
          state: { shared: {}, mine: {}, members: {} },
        } }, '*');
        return;
      }
      if (m.op === 'set') { w.postMessage({ hl: 1, id: m.id, ok: true, result: { at: new Date().toISOString() } }, '*'); return; }
      w.postMessage({ hl: 1, id: m.id, ok: false, error: 'Not available in the preview.' }, '*');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [communityName, title, tr]);

  const check = useMemo(() => validateAppHtml(source), [source]);
  const dirty = original !== null && source !== original;
  const lines = useMemo(() => source.split('\n').length, [source]);

  const save = async () => {
    if (!editable || !dirty || !check.ok || saving) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const { app } = await api<{ app: AppSummary }>(url, { method: 'PATCH', body: JSON.stringify({ html: source }) });
      setOriginal(source);
      toast.success(tr("Saved as version {version}", { version: app.version }));
      await onSaved(app.version);
    } catch (e: any) {
      setSaveErr({ message: e.message, problems: Array.isArray(e.problems) ? e.problems : undefined });
    } finally {
      setSaving(false);
    }
  };

  if (loadErr) {
    return <div className="flex-1 flex items-center justify-center px-6"><p className="text-[14px] text-[var(--hl-ink)]" role="alert">{tr(loadErr)}</p></div>;
  }
  if (original === null) {
    return <div className="flex-1 flex items-center justify-center"><p className="text-[13px] text-[var(--hl-ink-3)]" role="status">{tr("Loading…")}</p></div>;
  }

  const problems = saveErr?.problems ?? (check.ok ? [] : check.problems);
  const tabCls = (on: boolean) => `min-h-[40px] rounded-full px-3.5 text-[13.5px] font-medium ${on ? 'bg-[var(--hl-bg)] text-[var(--hl-ink)] shadow-[var(--hl-shadow-xs)]' : 'text-[var(--hl-ink-3)]'}`;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[var(--hl-border)] bg-[var(--hl-bg-subtle)]">
        {editable && <div role="tablist" aria-label={tr("Code or preview")} className="md:hidden flex gap-1 rounded-full bg-[var(--hl-bg-muted)] p-1">
          <button type="button" role="tab" aria-selected={pane === 'code'} className={tabCls(pane === 'code')} onClick={() => setPane('code')}>{tr("Code")}</button>
          <button type="button" role="tab" aria-selected={pane === 'preview'} className={tabCls(pane === 'preview')} onClick={() => setPane('preview')}>{tr("Preview")}</button>
        </div>}
        <span className="font-mono text-[11.5px] text-[var(--hl-ink-3)] tabular-nums">{tr("{lines} lines · {length} characters", { lines, length: source.length.toLocaleString() })}</span>
        {check.ok ? (
          <span className="rounded-full bg-[var(--hl-success-subtle)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--hl-success)]">{tr("Passes the safety checks")}</span>
        ) : (
          <span className="rounded-full bg-[var(--hl-danger-subtle)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--hl-danger)]">{tr("{count} problems", { count: check.problems.length })}</span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          className={`${btnGhost} px-3`}
          onClick={async () => { try { await navigator.clipboard.writeText(source); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { toast.error(tr("Could not copy")); } }}
        >
          {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}{copied ? tr("Copied") : tr("Copy")}
        </button>
        {editable && (
          <>
            <button type="button" className={`${btnGhost} px-3`} disabled={!dirty || saving} onClick={() => { setSource(original); setSaveErr(null); }}>
              <RotateCcw size={15} aria-hidden />{tr("Revert")}
            </button>
            <button type="button" className={btnPrimary} disabled={!dirty || !check.ok || saving} onClick={save}>
              {saving ? tr("Saving…") : tr("Save as v{version}", { version: version + 1 })}
            </button>
          </>
        )}
      </div>
      {(problems.length > 0 || saveErr) && (
        <div className="shrink-0 px-4 py-2 border-b border-[var(--hl-border)] bg-[var(--hl-danger-subtle)]" role="alert">
          {saveErr && <p className="text-[13px] font-medium text-[var(--hl-danger)]">{tr(saveErr.message)}</p>}
          <ul className="text-[12.5px] text-[var(--hl-ink-2)] list-disc pl-4">{problems.map(p => <li key={p}>{tr(p)}</li>)}</ul>
        </div>
      )}
      <div className={`flex-1 min-h-0 flex ${editable ? 'md:grid md:grid-cols-2' : ''}`}>
        <div className={`${pane === 'code' || !editable ? 'flex' : 'hidden'} md:flex flex-1 min-w-0 min-h-0 flex-col md:border-r border-[var(--hl-border)]`}>
          <textarea
            value={source}
            readOnly={!editable}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            onChange={e => setSource(e.target.value)}
            onKeyDown={e => { if (e.key === 's' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save(); } }}
            aria-label={tr("App code")}
            className="flex-1 min-h-0 w-full resize-none px-4 py-3 font-['IBM_Plex_Mono',ui-monospace,monospace] text-[12.5px] leading-[1.6] text-[var(--hl-ink)] bg-[var(--hl-bg)] outline-none whitespace-pre overflow-auto"
          />
        </div>
        {editable && <div className={`${pane === 'preview' ? 'flex' : 'hidden'} md:flex flex-1 min-w-0 min-h-0 flex-col bg-[var(--hl-bg)]`}>
          <p className="shrink-0 px-3 py-1.5 text-[12px] text-[var(--hl-ink-3)] border-b border-[var(--hl-border)]">{tr("Live preview. What you enter here is not saved.")}</p>
          <div className="relative flex-1 min-h-0">
            {previewKey > 0 && (
              <iframe
                key={previewKey}
                ref={previewRef}
                title={tr("Preview of {title}", { title })}
                src={`${url}/frame?preview=1&n=${previewKey}`}
                sandbox={APP_FRAME_SANDBOX}
                allow=""
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full border-0 bg-[var(--hl-bg)]"
              />
            )}
          </div>
        </div>}
      </div>
    </div>
  );
}
