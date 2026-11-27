'use client';
/**
 * The body of one community post, rendered the way private chats render the same formats:
 * encrypted photos, videos, voice notes and files (decrypted on this device), files above 20 MB,
 * GIFs, polls with one vote per member and live results, and text with tappable links.
 * Text is never rendered as markup.
 */
import React, { useMemo, useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { parseAttachmentMessage } from '@/lib/chat/remote-attachment';
import { parseLargeFileMessage } from '@/lib/chat/large-file';
import { RemoteAttachmentBubble } from '@/components/chat/RemoteAttachmentBubble';
import { LargeFileBubble } from '@/components/chat/LargeFileBubble';
import { encodePoll, encodeVote, parsePoll, tallyVotes, type IndexInput } from '@/lib/communities/media-index';

const INK = '#15171c';
const URL_SPLIT = /(\bhttps?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]])/gi;

function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_SPLIT);
  return (
    <p className="text-[18px] leading-relaxed mt-2 whitespace-pre-wrap break-words" style={{ color: INK }}>
      {parts.map((part, i) => (i % 2 === 1
        ? <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="text-[#1f5fd6] underline underline-offset-2 break-all">{part}</a>
        : <React.Fragment key={i}>{part}</React.Fragment>))}
    </p>
  );
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const t = useT();
  return (
    <div className="fixed inset-0 z-[260] bg-black/95 grid place-items-center p-3" role="dialog" aria-modal="true" onClick={onClose}>
      <button type="button" onClick={onClose} className="absolute right-3 top-[max(10px,env(safe-area-inset-top))] w-11 h-11 grid place-items-center rounded-full text-white hover:bg-white/10" aria-label={t('Close')}><X size={22} /></button>
      <img src={url} alt="" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

export function PollCard({ pollId, question, options, messages, me, onVote }: {
  pollId: string; question: string; options: string[]; messages: IndexInput[]; me: string; onVote?: (encodedVote: string) => Promise<unknown>;
}) {
  const t = useT();
  const { counts, voters } = useMemo(() => tallyVotes(messages, pollId, options.length), [messages, pollId, options.length]);
  const mine = voters.get(me.toLowerCase());
  const [pending, setPending] = useState<number | null>(null);
  const shown = pending ?? mine;
  const total = counts.reduce((a, b) => a + b, 0) + (pending !== null && pending !== mine ? (mine === undefined ? 1 : 0) : 0);
  const vote = async (k: number) => {
    if (!onVote || k === shown) return;
    setPending(k);
    try { await onVote(encodeVote(pollId, k)); } finally { setPending(null); }
  };
  return (
    <div className="mt-2 rounded-2xl border border-[#d4d8de] p-3.5 bg-white">
      <p className="text-[12.5px] font-semibold uppercase tracking-wide text-[#727a88]">{t('Poll')}</p>
      <p className="text-[17px] font-semibold mt-0.5 mb-2.5" style={{ color: INK }}>{question}</p>
      <div role="radiogroup" aria-label={question}>
        {options.map((o, k) => {
          const c = counts[k] + (pending === k && mine !== k ? 1 : 0) - (pending !== null && mine === k && pending !== k ? 1 : 0);
          const pct = total ? Math.round((Math.max(0, c) / total) * 100) : 0;
          const chosen = shown === k;
          return (
            <button key={k} type="button" role="radio" aria-checked={chosen} disabled={!onVote} onClick={() => void vote(k)}
              className={`relative w-full min-h-[46px] rounded-xl mb-1.5 overflow-hidden text-left border ${chosen ? 'border-[#15171c]' : 'border-transparent'} bg-[#f2f3f5] disabled:cursor-default`}>
              {shown !== undefined && <span className="absolute inset-y-0 left-0 bg-[#dfe7ff] transition-[width] duration-300" style={{ width: `${pct}%` }} aria-hidden="true" />}
              <span className="relative flex items-center gap-2 px-3 py-2 text-[15.5px]" style={{ color: INK }}>
                {chosen && <Check size={16} strokeWidth={2.6} aria-hidden="true" />}
                <span className="flex-1 min-w-0 break-words">{o}</span>
                {shown !== undefined && <span className="tabular-nums font-semibold text-[14px]">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[13px] text-[#5b6270] mt-1">{total === 1 ? t('1 vote') : t('{count} votes', { count: total })}{shown === undefined && onVote ? ` · ${t('Tap an option to vote')}` : ''}</p>
    </div>
  );
}

export function PostBody({ content, messages, me, onVote }: { content: string; messages: IndexInput[]; me: string; onVote?: (encodedVote: string) => Promise<unknown> }) {
  const [light, setLight] = useState<string | null>(null);
  const c = content.trim();
  const att = parseAttachmentMessage(c);
  if (att) {
    return (
      <div className="mt-2 max-w-[340px]">
        <RemoteAttachmentBubble att={att} isMe={false} onOpenLightbox={setLight} />
        {light && <Lightbox url={light} onClose={() => setLight(null)} />}
      </div>
    );
  }
  const large = parseLargeFileMessage(c);
  if (large) return <div className="mt-2 max-w-[340px]"><LargeFileBubble file={large} isMe={false} /></div>;
  if (c.startsWith('[GIF]') && /^https:\/\/\S+$/.test(c.slice(5).trim())) {
    return <img src={c.slice(5).trim()} alt="GIF" loading="lazy" referrerPolicy="no-referrer" className="mt-2 rounded-2xl max-w-[280px] w-full" />;
  }
  if (c.startsWith('__AUDIO__data:audio/')) return <audio src={c.slice(9)} controls preload="none" className="mt-2 w-full max-w-[340px]" />;
  const poll = parsePoll(c);
  if (poll) return <PollCard {...poll} messages={messages} me={me} onVote={onVote} />;
  return <Linkified text={c} />;
}

/** Question + 2–10 options; sends one __POLL__ post (the same format as private chats). */
export function PollComposer({ onSend, onClose }: { onSend: (encoded: string) => void; onClose: () => void }) {
  const t = useT();
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState(['', '']);
  const valid = q.trim() && opts.filter((o) => o.trim()).length >= 2;
  const field = 'w-full px-4 py-3 rounded-2xl bg-[#f4f5f7] border border-transparent text-[16px] text-[#15171c] placeholder:text-[#8a919c] outline-none focus:bg-white focus:border-[#15171c]';
  return (
    <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center bg-black/35" role="dialog" aria-modal="true" aria-label={t('Create a poll')} onClick={onClose}>
      <div className="w-full sm:max-w-[440px] max-h-[92dvh] overflow-y-auto bg-white rounded-t-[28px] sm:rounded-[28px] p-5 pb-[max(18px,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[20px] font-semibold text-[#15171c]">{t('Create a poll')}</h2>
          <button type="button" onClick={onClose} className="w-11 h-11 grid place-items-center rounded-full hover:bg-[#f2f3f5]" aria-label={t('Close')}><X size={20} /></button>
        </div>
        <input autoFocus value={q} maxLength={300} onChange={(e) => setQ(e.target.value)} placeholder={t('Ask a question')} className={field} />
        <p className="text-[13px] font-semibold text-[#3d424b] mt-4 mb-1.5">{t('Options')}</p>
        {opts.map((o, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input value={o} maxLength={100} onChange={(e) => setOpts(opts.map((x, k) => (k === i ? e.target.value : x)))} placeholder={t('Option {n}', { n: i + 1 })} className={field} />
            {opts.length > 2 && <button type="button" onClick={() => setOpts(opts.filter((_, k) => k !== i))} className="w-12 shrink-0 grid place-items-center rounded-2xl hover:bg-[#f2f3f5] text-[#727a88]" aria-label={t('Remove option')}><Trash2 size={18} /></button>}
          </div>
        ))}
        {opts.length < 10 && <button type="button" onClick={() => setOpts([...opts, ''])} className="min-h-[44px] px-3 rounded-xl text-[14.5px] font-semibold text-[#15171c] hover:bg-[#f2f3f5] inline-flex items-center gap-1.5"><Plus size={17} />{t('Add an option')}</button>}
        <p className="text-[12.5px] text-[#727a88] mt-2">{t('Members see who voted for what: votes are posts in this encrypted community.')}</p>
        <button type="button" disabled={!valid} onClick={() => onSend(encodePoll(q, opts.filter((o) => o.trim())))} className="mt-4 w-full min-h-[52px] rounded-2xl bg-[#15171c] text-white text-[16px] font-semibold disabled:opacity-40">{t('Send poll')}</button>
      </div>
    </div>
  );
}
