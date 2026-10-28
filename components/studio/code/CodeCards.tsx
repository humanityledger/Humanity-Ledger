'use client';

/**
 * Code mode pieces of a Studio answer: approval of file changes (with the
 * exact diff), the proposed plan, a question from Studio, the task list,
 * reasoning, subagents and the files a turn changed.
 */

import React, { useMemo, useState } from 'react';
import { Bot, Brain, Check, ChevronDown, ChevronRight, CircleDashed, FileDiff, FilePlus2, FileX2, ListTodo, Loader2, MessageCircleQuestion, MoveRight, X } from 'lucide-react';
import { applyWsTool, diffHunks, diffLines, type WsFile } from '@/lib/studio/fs';
import type { FileChangeMeta, SubagentActivity } from '@/lib/studio/store';
import type { ResumeResult, TodoItem } from '@/lib/studio/protocol';
import type { StudioStrings } from '@/lib/studio/i18n';
import { StudioMarkdown } from '../StudioMarkdown';

/* ── diff ──────────────────────────────────────────────────────────────── */

export function DiffView({ before, after, maxLines = 400 }: { before: string | null; after: string | null; maxLines?: number }) {
  const rows = useMemo(() => diffHunks(diffLines(before ?? '', after ?? ''), 3), [before, after]);
  if (!rows.length) return null;
  const shown = rows.slice(0, maxLines);
  return (
    <div className="font-mono text-[11.5px] leading-[1.5] overflow-x-auto">
      {shown.map((l, i) => l === null ? (
        <div key={i} className="px-2 text-[#a3a9b4] bg-[#f8f9fb] select-none">⋯</div>
      ) : (
        <div key={i} className={`flex whitespace-pre ${l.kind === '+' ? 'bg-[#e9f7ef] text-[#0f5132]' : l.kind === '-' ? 'bg-[#fdecec] text-[#842029]' : 'text-[#4a505c]'}`}>
          <span className="w-10 shrink-0 text-right pr-2 text-[#a3a9b4] select-none tabular-nums">{l.kind === '-' ? l.a : l.b}</span>
          <span className="w-4 shrink-0 select-none">{l.kind === ' ' ? '' : l.kind}</span>
          <span className="pr-3">{l.text || ' '}</span>
        </div>
      ))}
      {rows.length > maxLines && <div className="px-2 py-1 text-[#727a88]">… {rows.length - maxLines}</div>}
    </div>
  );
}

/* ── approval ──────────────────────────────────────────────────────────── */

interface Preview { id: string; name: string; path: string; detail: string; before: string | null; after: string | null; error?: string }

/** What each proposed call would do to the files on this device, in order. */
export function previewCalls(files: WsFile[], calls: { id: string; name: string; input: any }[]): Preview[] {
  const map = new Map(files.map(f => [f.path, { ...f }]));
  return calls.map(c => {
    const path = String(c.input?.path ?? c.input?.from ?? '');
    const before = map.get(path);
    const beforeText = before && before.encoding !== 'base64' ? before.content : before ? '[binary]' : null;
    const r = applyWsTool(map, c.name, c.input);
    if (!r.ok) return { id: c.id, name: c.name, path, detail: path, before: beforeText, after: beforeText, error: r.error };
    const ch = r.changes.find(x => x.path === path);
    const target = c.name === 'move_file' ? `${path} → ${String(c.input?.to ?? '')}` : path;
    return { id: c.id, name: c.name, path, detail: target, before: beforeText, after: c.name === 'move_file' ? beforeText : ch?.content ?? null };
  });
}

const opIcon = (name: string) => name === 'delete_file' ? <FileX2 size={14} /> : name === 'move_file' ? <MoveRight size={14} /> : name === 'write_file' ? <FilePlus2 size={14} /> : <FileDiff size={14} />;

export function ApprovalCard({ calls, files, t, busy, onDecide }: {
  calls: { id: string; name: string; input: any }[];
  files: WsFile[];
  t: StudioStrings;
  busy: boolean;
  onDecide: (results: ResumeResult[], summary: string, autoAfter: boolean) => void;
}) {
  const previews = useMemo(() => previewCalls(files, calls), [files, calls]);
  const [allowed, setAllowed] = useState<Record<string, boolean>>(() => Object.fromEntries(calls.map(c => [c.id, true])));
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(calls.slice(0, 3).map(c => [c.id, true])));
  const [feedback, setFeedback] = useState('');
  const decide = (mode: 'selected' | 'none' | 'auto') => {
    const results: ResumeResult[] = calls.map(c => {
      const ok = mode === 'none' ? false : mode === 'auto' ? true : !!allowed[c.id];
      return { tool_use_id: c.id, decision: ok ? 'allow' : 'deny', ...(ok || !feedback.trim() ? {} : { text: feedback.trim().slice(0, 4000) }) };
    });
    const n = results.filter(r => r.decision === 'allow').length;
    onDecide(results, n === calls.length ? t.outcomeApproved : n === 0 ? t.outcomeDenied : t.outcomeSome, mode === 'auto');
  };
  return (
    <div className="mt-2 rounded-2xl border border-[#d9dde3] bg-white overflow-hidden">
      <div className="px-3 py-2.5 bg-[#f8f9fb] border-b border-[#eceef2] text-[13px] font-medium text-[#15171c]">{t.approvalTitle}</div>
      <ul className="divide-y divide-[#eceef2]">
        {previews.map(p => (
          <li key={p.id}>
            <div className="flex items-center gap-2 px-3 h-10">
              <input type="checkbox" checked={!!allowed[p.id]} onChange={e => setAllowed(a => ({ ...a, [p.id]: e.target.checked }))} aria-label={p.detail} className="w-4 h-4 accent-[#15171c]" />
              <button type="button" onClick={() => setOpen(o => ({ ...o, [p.id]: !o[p.id] }))} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                {open[p.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span className="text-[#4a505c]">{opIcon(p.name)}</span>
                <span className="font-mono text-[12.5px] truncate">{p.detail}</span>
              </button>
            </div>
            {open[p.id] && (
              <div className="border-t border-[#f0f1f4] max-h-[360px] overflow-auto">
                {p.error ? <p className="px-3 py-2 text-[12.5px] text-[#a3242a]">{p.error}</p> : <DiffView before={p.before} after={p.after} />}
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="p-3 border-t border-[#eceef2] space-y-2">
        <input value={feedback} onChange={e => setFeedback(e.target.value)} placeholder={t.feedbackPlaceholder} maxLength={4000}
          className="w-full h-9 px-3 rounded-lg border border-[#e4e7ec] text-[13px] outline-none focus:border-[#98a2b3]" />
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => decide('selected')} className="h-9 px-3 rounded-lg bg-[#15171c] text-white text-[13px] font-medium disabled:opacity-40 flex items-center gap-1.5"><Check size={14} />{calls.every(c => allowed[c.id]) ? t.approveAll : t.approve}</button>
          <button type="button" disabled={busy} onClick={() => decide('auto')} className="h-9 px-3 rounded-lg border border-[#e4e7ec] text-[13px] disabled:opacity-40 hover:bg-[#f2f4f7]">{t.approveAndAuto}</button>
          <button type="button" disabled={busy} onClick={() => decide('none')} className="h-9 px-3 rounded-lg text-[13px] text-[#a3242a] hover:bg-[#fdf2f2] disabled:opacity-40 flex items-center gap-1.5"><X size={14} />{t.deny}</button>
        </div>
      </div>
    </div>
  );
}

/* ── plan ──────────────────────────────────────────────────────────────── */

export function PlanCard({ id, plan, t, busy, onDecide }: {
  id: string; plan: string; t: StudioStrings; busy: boolean;
  onDecide: (results: ResumeResult[], summary: string, permissionAfter?: 'auto' | 'ask') => void;
}) {
  const [revising, setRevising] = useState(false);
  const [feedback, setFeedback] = useState('');
  return (
    <div className="mt-2 rounded-2xl border border-[#cdd6f4] bg-[#f7f9ff] overflow-hidden">
      <div className="px-3 py-2.5 border-b border-[#dfe5f7] text-[13px] font-medium text-[#1a3a8f] flex items-center gap-1.5"><ListTodo size={14} />{t.planTitle}</div>
      <div className="px-4 py-3 max-h-[480px] overflow-auto bg-white"><StudioMarkdown text={plan} copyLabel={t.copy} copiedLabel={t.copied} /></div>
      <div className="p-3 border-t border-[#dfe5f7] space-y-2">
        {revising && (
          <textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder={t.planFeedback} rows={3} maxLength={4000} autoFocus
            className="w-full px-3 py-2 rounded-lg border border-[#e4e7ec] text-[13px] outline-none focus:border-[#98a2b3] resize-y" />
        )}
        <div className="flex flex-wrap gap-2">
          {!revising ? (
            <>
              <button type="button" disabled={busy} onClick={() => onDecide([{ tool_use_id: id, decision: 'allow' }], t.outcomePlanApproved, 'auto')} className="h-9 px-3 rounded-lg bg-[#15171c] text-white text-[13px] font-medium disabled:opacity-40">{t.planApproveAuto}</button>
              <button type="button" disabled={busy} onClick={() => onDecide([{ tool_use_id: id, decision: 'allow' }], t.outcomePlanApproved, 'ask')} className="h-9 px-3 rounded-lg border border-[#e4e7ec] bg-white text-[13px] disabled:opacity-40 hover:bg-[#f2f4f7]">{t.planApproveAsk}</button>
              <button type="button" disabled={busy} onClick={() => setRevising(true)} className="h-9 px-3 rounded-lg text-[13px] text-[#4a505c] hover:bg-[#eef1f8] disabled:opacity-40">{t.planKeep}</button>
            </>
          ) : (
            <>
              <button type="button" disabled={busy || !feedback.trim()} onClick={() => onDecide([{ tool_use_id: id, decision: 'deny', text: feedback.trim() }], t.outcomePlanRevise)} className="h-9 px-3 rounded-lg bg-[#15171c] text-white text-[13px] font-medium disabled:opacity-40">{t.send}</button>
              <button type="button" onClick={() => setRevising(false)} className="h-9 px-3 rounded-lg text-[13px] text-[#4a505c] hover:bg-[#eef1f8]">{t.cancel}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── question ──────────────────────────────────────────────────────────── */

export function QuestionCard({ id, question, options, t, busy, onAnswer }: {
  id: string; question: string; options?: string[]; t: StudioStrings; busy: boolean;
  onAnswer: (results: ResumeResult[], summary: string) => void;
}) {
  const [text, setText] = useState('');
  const answer = (a: string) => { const v = a.trim(); if (v) onAnswer([{ tool_use_id: id, decision: 'answer', text: v.slice(0, 8000) }], `${t.outcomeAnswered}: ${v.slice(0, 120)}`); };
  return (
    <div className="mt-2 rounded-2xl border border-[#f0d9a8] bg-[#fffcf5] overflow-hidden">
      <div className="px-3 py-2.5 border-b border-[#f3e3c0] text-[13px] font-medium text-[#7a5200] flex items-center gap-1.5"><MessageCircleQuestion size={14} />{t.questionTitle}</div>
      <div className="p-3 space-y-2.5">
        <p className="text-[14px] text-[#15171c] whitespace-pre-wrap">{question}</p>
        {!!options?.length && (
          <div className="flex flex-col gap-1.5">
            {options.map((o, i) => (
              <button key={i} type="button" disabled={busy} onClick={() => answer(o)} className="text-left px-3 py-2 rounded-xl border border-[#e4e7ec] bg-white text-[13.5px] hover:bg-[#f8f9fb] disabled:opacity-40">{o}</button>
            ))}
          </div>
        )}
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); answer(text); }}>
          <input value={text} onChange={e => setText(e.target.value)} placeholder={t.answerPlaceholder} maxLength={8000}
            className="flex-1 min-w-0 h-9 px-3 rounded-lg border border-[#e4e7ec] bg-white text-[13px] outline-none focus:border-[#98a2b3]" />
          <button type="submit" disabled={busy || !text.trim()} className="h-9 px-3 rounded-lg bg-[#15171c] text-white text-[13px] font-medium disabled:opacity-40">{t.answer}</button>
        </form>
      </div>
    </div>
  );
}

/* ── todos, reasoning, subagents, file changes ─────────────────────────── */

export function TodoList({ todos, t, compact }: { todos: TodoItem[]; t: StudioStrings; compact?: boolean }) {
  if (!todos.length) return null;
  const done = todos.filter(x => x.status === 'completed').length;
  return (
    <div className={`rounded-xl border border-[#eceef2] bg-white ${compact ? 'p-2' : 'p-3'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-medium text-[#4a505c] flex items-center gap-1.5"><ListTodo size={13} />{t.todos}</span>
        <span className="text-[11.5px] text-[#727a88] tabular-nums">{done}/{todos.length}</span>
      </div>
      <ul className="space-y-1">
        {todos.map((x, i) => (
          <li key={i} className="flex items-start gap-2 text-[12.5px]">
            <span className="mt-[3px] shrink-0">
              {x.status === 'completed' ? <Check size={13} className="text-[#12805c]" /> : x.status === 'in_progress' ? <Loader2 size={13} className="animate-spin text-[#2456d6]" /> : <CircleDashed size={13} className="text-[#a3a9b4]" />}
            </span>
            <span className={x.status === 'completed' ? 'line-through text-[#a3a9b4]' : x.status === 'in_progress' ? 'text-[#15171c] font-medium' : 'text-[#4a505c]'}>
              {x.status === 'in_progress' && x.activeForm ? x.activeForm : x.content}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReasoningBlock({ text, t, live }: { text: string; t: StudioStrings; live: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex items-center gap-1.5 text-[12.5px] text-[#727a88] hover:text-[#15171c]">
        {live ? <Loader2 size={13} className="animate-spin" /> : <Brain size={13} />}{t.reasoning}{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      {open && <div className="mt-1.5 pl-3 border-l-2 border-[#e4e7ec] text-[12.5px] leading-[1.55] text-[#4a505c] whitespace-pre-wrap max-h-80 overflow-auto">{text}</div>}
    </div>
  );
}

export function SubagentList({ list, renderTools }: { list: SubagentActivity[]; renderTools?: (id: string) => React.ReactNode }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (!list.length) return null;
  return (
    <div className="mb-2 space-y-1.5">
      {list.map(s => (
        <div key={s.id} className="rounded-xl border border-[#e7e2f8] bg-[#fbfaff]">
          <button type="button" onClick={() => setOpen(o => ({ ...o, [s.id]: !o[s.id] }))} aria-expanded={!!open[s.id]} className="w-full flex items-center gap-2 px-2.5 h-9 text-left min-w-0">
            {s.status === 'running' ? <Loader2 size={13} className="animate-spin text-[#5b34c7] shrink-0" /> : <Bot size={13} className="text-[#5b34c7] shrink-0" />}
            <span className="text-[12.5px] font-medium text-[#3d2a85] shrink-0">{s.name}</span>
            <span className="text-[12.5px] text-[#4a505c] truncate flex-1">{s.description}</span>
            {open[s.id] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          {open[s.id] && (
            <div className="px-3 pb-2.5 space-y-1.5">
              {renderTools?.(s.id)}
              {s.summary && <p className="text-[12px] text-[#4a505c] whitespace-pre-wrap border-t border-[#eee9fb] pt-1.5">{s.summary}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function FileChangeList({ changes, t, onOpen }: { changes: FileChangeMeta[]; t: StudioStrings; onOpen: (path: string) => void }) {
  if (!changes.length) return null;
  const label = (op: FileChangeMeta['op']) => op === 'create' ? t.opCreate : op === 'delete' ? t.opDelete : op === 'move' ? t.opMove : t.opUpdate;
  return (
    <div className="mt-2 rounded-xl border border-[#eceef2] overflow-hidden">
      {changes.map(c => (
        <button key={c.path} type="button" disabled={c.op === 'delete'} onClick={() => onOpen(c.path)}
          className="w-full flex items-center gap-2 px-3 h-9 text-left bg-white hover:bg-[#f8f9fb] disabled:hover:bg-white border-b last:border-b-0 border-[#f0f1f4]">
          <span className="text-[#4a505c]">{c.op === 'delete' ? <FileX2 size={14} /> : c.op === 'create' ? <FilePlus2 size={14} /> : <FileDiff size={14} />}</span>
          <span className="text-[11.5px] text-[#727a88] w-14 shrink-0">{label(c.op)}</span>
          <span className="font-mono text-[12.5px] truncate flex-1">{c.path}</span>
          <span className="text-[11.5px] tabular-nums shrink-0"><span className="text-[#12805c]">+{c.added}</span> <span className="text-[#d93036]">−{c.removed}</span></span>
        </button>
      ))}
    </div>
  );
}
