'use client';
/**
 * The presentation registry: how each kind of activity is drawn in the island, in the same regions
 * ActivityKit uses (compact leading and trailing, minimal, expanded). Adding a kind means adding
 * one entry here and one in lib/activities/types.ts; nothing else changes.
 *
 * Every word on screen is written here, from the activity's typed fields. No entry can show the
 * text of a message, because no activity carries one.
 */
import React from 'react';
import { AlertTriangle, ArrowDownLeft, Check, Info, Loader2, Lock, MessageCircle, Mic, MicOff, Phone, PhoneIncoming, PhoneMissed, PhoneOff, PictureInPicture2, Maximize2, Video, WifiOff, X } from 'lucide-react';
import type { AnyActivity, NoticeTone, ProofStep } from '@/lib/activities/types';
import type { CallControls } from '@/lib/activities/call-media';
import type { ActionName } from '@/lib/activities/actions';
import { formatAmount, formatElapsed, spokenDuration } from '@/lib/activities/values';
import { Wave } from './Wave';
import { Ring } from './Ring';
import s from './activities.module.css';
import { t as tr, useT } from '@/lib/i18n/client';

export interface PresentContext {
  now: number;
  controls: CallControls | null;
  /** Leaves the island for the floating window (calls only). */
  toWindow: () => void;
  dismiss: () => void;
  /** The other side of the call, for the waveform. Absent: no live level to read. */
  remote?: MediaStream | null;
  /** Runs one of this activity's buttons (lib/activities/actions.ts). */
  act?: (name: ActionName, event?: unknown) => void;
}

/** The colour an activity glows with, and the colour of its mark. */
export type Tone = 'live' | 'warn' | 'danger' | 'violet' | 'neutral';

export interface Presentation {
  leading: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
  minimal: React.ReactNode;
  expanded: React.ReactNode;
  /** What the compact capsule says to a screen reader. */
  spoken: string;
  /** Announced when the activity starts or changes phase; assertive only for an incoming call. */
  announce: string;
  assertive?: boolean;
  /** The aura under the island. */
  tone: Tone;
  /** Two lines of text in the compact capsule (a long notice): drawn as a rounded banner. */
  tall?: boolean;
  /** A button inside the compact capsule itself (a notice's Undo). */
  quick?: React.ReactNode;
  /** The capsule breathes (a call that is live, a recording). */
  live?: boolean;
}

const I = { size: 14, strokeWidth: 2.2, 'aria-hidden': true } as const;
const IL = { size: 18, strokeWidth: 2, 'aria-hidden': true } as const;

export function initials(name: string): string {
  if (/^0x[0-9a-f]/i.test(name)) return name.slice(2, 4).toUpperCase();
  const parts = name.replace(/^@/, '').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export const PROOF_STEPS: { key: Exclude<ProofStep, 'failed'>; label: string }[] = [
  { key: 'preparing', label: 'Preparing the payment' },
  { key: 'proving', label: 'Making the proof on this device' },
  { key: 'sending', label: 'Sending to Aztec' },
  { key: 'settled', label: 'Included in a block' },
];
const STEP_SHORT: Record<ProofStep, string> = { preparing: 'Preparing', proving: 'Proving', sending: 'Sending', settled: 'Sent', failed: 'Failed' };

function Steps({ step }: { step: ProofStep }) {
  const tr = useT();
  const at = step === 'failed' ? -1 : PROOF_STEPS.findIndex((x) => x.key === step);
  return (
    <ol className={s.steps}>
      {PROOF_STEPS.map((x, i) => {
        const done = at > i || step === 'settled';
        const now = at === i && step !== 'settled';
        return (
          <li key={x.key} className={`${s.step} ${done ? s.stepDone : ''} ${now ? s.stepNow : ''}`} aria-current={now ? 'step' : undefined}>
            <span className={`${s.stepMark} ${done ? s.stepMarkDone : ''} ${now ? s.stepMarkNow : ''}`}>
              {done ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : now ? <Loader2 size={11} strokeWidth={2.6} className={s.spin} aria-hidden="true" /> : null}
            </span>
            {tr(x.label)}
          </li>
        );
      })}
    </ol>
  );
}

function present(a: AnyActivity, c: PresentContext): Presentation {
  switch (a.kind) {
    case 'call': {
      const { phase, connectedAt, micMuted, endedAfter } = a.state;
      const peer = a.attributes.peer;
      const timer = connectedAt ? formatElapsed(c.now - connectedAt) : null;
      if (phase === 'incoming') {
        const kind = a.attributes.media === 'video' ? 'video call' : 'call';
        return {
          leading: <span className={`${s.dot} ${s.dotLive} ${s.dotRinging}`}><PhoneIncoming {...I} /></span>,
          label: peer,
          trailing: <span className={s.trailing}>{tr("Incoming")}</span>,
          minimal: <PhoneIncoming {...IL} />,
          spoken: `Incoming ${kind} from ${peer}`,
          announce: `Incoming ${kind} from ${peer}`,
          assertive: true,
          tone: 'live',
          live: true,
          expanded: (
            <>
              <div className={s.head}>
                <span className={`${s.avatar} ${s.avatarRinging}`} aria-hidden="true">{initials(peer)}</span>
                <div className={s.titles}>
                  <p className={s.title}>{peer}</p>
                  <p className={s.subtitle}><Lock size={11} strokeWidth={2.4} aria-hidden="true" className={s.inlineIcon} />{tr("Incoming {kind} · Encrypted", { kind })}</p>
                </div>
              </div>
              <div className={`${s.actions} ${s.actionsSpread}`}>
                <button type="button" className={`${s.btn} ${s.btnDanger}`} onClick={() => c.controls?.decline?.()} disabled={!c.controls?.decline}>
                  <PhoneOff {...I} />{" "}{tr("Decline")}
                </button>
                <button type="button" className={`${s.btn} ${s.btnLive}`} onClick={() => c.controls?.answer?.()} disabled={!c.controls?.answer} data-autofocus>
                  {tr("{value} Answer", { value: a.attributes.media === 'video' ? <Video {...I} /> : <Phone {...I} /> })}</button>
              </div>
            </>
          ),
        };
      }
      if (phase === 'ended') {
        const len = endedAfter ? formatElapsed(endedAfter * 1000) : '';
        return {
          leading: <span className={`${s.dot} ${s.dotNeutral}`}><PhoneOff {...I} /></span>,
          label: 'Call ended',
          trailing: <span className={s.trailing}>{len}</span>,
          minimal: <PhoneOff {...IL} />,
          spoken: `Call with ${peer} ended${endedAfter ? ` after ${spokenDuration(endedAfter * 1000)}` : ''}`,
          announce: `Call with ${peer} ended`,
          expanded: null,
          tone: 'neutral',
        };
      }
      const warn = phase === 'reconnecting';
      const status = phase === 'outgoing' ? 'Calling' : phase === 'connecting' ? 'Connecting' : warn ? 'Reconnecting' : timer ?? '';
      const talking = phase === 'active' && !warn;
      return {
        tone: warn ? 'warn' : 'live',
        live: talking,
        leading: <span className={`${s.dot} ${warn ? s.dotWarn : s.dotLive}`}>{micMuted ? <MicOff {...I} /> : <Phone {...I} />}</span>,
        label: peer,
        trailing: (
          <span className={s.trailGroup}>
            <span className={`${s.trailing} ${timer && !warn ? s.trailingStrong : ''}`}>{status}</span>
            {talking && <Wave stream={c.remote ?? null} />}
          </span>
        ),
        minimal: <span className={`${s.dot} ${warn ? s.dotWarn : s.dotLive}`}><Phone {...I} /></span>,
        spoken: `Call with ${peer}, ${warn ? 'reconnecting' : timer ? `${spokenDuration(c.now - (connectedAt ?? c.now))}` : status.toLowerCase()}${micMuted ? ', muted' : ''}. Open call controls`,
        announce: warn ? `Reconnecting the call with ${peer}` : phase === 'active' ? `Connected with ${peer}` : `${status} ${peer}`,
        expanded: (
          <>
            <div className={s.head}>
              <span className={s.avatar} aria-hidden="true">{initials(peer)}</span>
              <div className={s.titles}>
                <p className={s.title}>{peer}</p>
                <p className={s.subtitle}>{warn ? tr("Reconnecting…") : timer ? tr("{timer} · Encrypted", { timer }) : `${status}…`}</p>
              </div>
              {talking && <Wave stream={c.remote ?? null} />}
            </div>
            <div className={s.actions}>
              <button type="button" className={`${s.btn} ${s.btnIcon} ${micMuted ? s.btnOn : ''}`} onClick={() => c.controls?.toggleMic()} aria-pressed={micMuted} aria-label={micMuted ? tr("Unmute") : tr("Mute")}>
                {micMuted ? <MicOff {...I} /> : <Mic {...I} />}
              </button>
              <button type="button" className={`${s.btn} ${s.btnIcon}`} onClick={c.toWindow} aria-label={tr("Show in a floating window")}>
                <PictureInPicture2 {...I} />
              </button>
              <button type="button" className={`${s.btn} ${s.btnIcon}`} onClick={() => c.controls?.openStage()} aria-label={tr("Open the full call")}>
                <Maximize2 {...I} />
              </button>
              <button type="button" className={`${s.btn} ${s.btnDanger}`} onClick={() => c.controls?.end()} aria-label={tr("End call")}>
                <PhoneOff {...I} />{" "}{tr("End")}
              </button>
            </div>
          </>
        ),
      };
    }
    case 'paymentProof': {
      const { step } = a.state;
      const amount = formatAmount(a.attributes.amount);
      const to = a.attributes.to;
      const failed = step === 'failed';
      const done = step === 'settled';
      const stepAt = PROOF_STEPS.findIndex((x) => x.key === step);
      const leading = failed
        ? <span className={`${s.dot} ${s.dotDanger}`}><AlertTriangle {...I} /></span>
        : done
          ? <span className={`${s.dot} ${s.dotLive}`}><Check {...I} /></span>
          // One arc per step; an arc fills when its step is done (the wallet says so, nothing guesses).
          : <Ring value={Math.max(0, stepAt) / PROOF_STEPS.length} segments={PROOF_STEPS.length}><Lock size={10} strokeWidth={2.6} aria-hidden="true" /></Ring>;
      return {
        tone: failed ? 'danger' : done ? 'live' : 'violet',
        leading,
        label: `${amount} to ${to}`,
        trailing: <span className={`${s.trailing} ${done || failed ? s.trailingStrong : ''}`}>{tr(STEP_SHORT[step])}</span>,
        minimal: leading,
        spoken: `Private payment of ${amount} to ${to}: ${STEP_SHORT[step].toLowerCase()}`,
        announce: failed ? `Payment of ${amount} to ${to} failed` : done ? `Payment of ${amount} to ${to} sent` : `Payment of ${amount} to ${to}: ${STEP_SHORT[step].toLowerCase()}`,
        expanded: (
          <>
            <div className={s.head}>
              {leading}
              <div className={s.titles}>
                <p className={s.title}>{tr("Private payment to {to}", { to })}</p>
                <p className={s.subtitle}>{failed ? tr("It did not go through. Nothing was sent.") : tr("Amount and recipient stay private on Aztec")}</p>
              </div>
              <span className={s.amount}>{amount}</span>
            </div>
            <Steps step={step} />
            {failed && (
              <div className={s.actions}>
                <button type="button" className={s.btn} onClick={c.dismiss}><X {...I} />{" "}{tr("Close")}</button>
              </div>
            )}
          </>
        ),
      };
    }
    case 'paymentReceived': {
      const amount = formatAmount(a.attributes.amount);
      const from = a.attributes.from;
      return {
        tone: 'violet',
        leading: <span className={`${s.dot} ${s.dotViolet}`}><ArrowDownLeft {...I} /></span>,
        label: from,
        trailing: <span className={`${s.trailing} ${s.trailingStrong}`}>+{amount}</span>,
        minimal: <span className={`${s.dot} ${s.dotViolet}`}><ArrowDownLeft {...I} /></span>,
        spoken: `${from} sent you ${amount}`,
        announce: `${from} sent you ${amount}`,
        expanded: (
          <div className={s.head}>
            <span className={s.avatar} aria-hidden="true">{initials(from)}</span>
            <div className={s.titles}>
              <p className={s.title}>{from}</p>
              <p className={s.subtitle}>{tr("Sent you a private payment")}</p>
            </div>
            <span className={s.amount}>+{amount}</span>
          </div>
        ),
      };
    }
    case 'recording': {
      const t = formatElapsed(c.now - a.state.startedAt);
      return {
        tone: 'danger',
        live: true,
        leading: <span className={`${s.dot} ${s.dotDanger}`}><Mic {...I} /></span>,
        label: 'Recording',
        trailing: (
          <span className={s.trailGroup}>
            <span className={`${s.trailing} ${s.trailingStrong}`}>{t}</span>
            <Wave tone="danger" />
          </span>
        ),
        minimal: <span className={`${s.dot} ${s.dotDanger}`}><Mic {...I} /></span>,
        spoken: `Recording a voice message for ${a.attributes.peer}, ${spokenDuration(c.now - a.state.startedAt)}`,
        announce: 'Recording a voice message',
        expanded: null,
      };
    }
    case 'message': {
      const n = a.state.count;
      const from = a.attributes.from;
      return {
        tone: 'neutral',
        leading: <span className={`${s.dot} ${s.dotNeutral}`}><MessageCircle {...I} /></span>,
        label: from,
        trailing: <span className={s.trailing}>{n > 1 ? tr("{n} new", { n }) : tr("New message")}</span>,
        minimal: <MessageCircle {...IL} />,
        spoken: `${n > 1 ? `${n} new messages` : 'New message'} from ${from}`,
        announce: `New message from ${from}`,
        expanded: null,
      };
    }
    case 'session': {
      const st = a.state.status;
      const text = st === 'signing-in' ? 'Signing you in' : st === 'offline' ? 'You are offline' : st === 'online' ? 'Back online' : 'Syncing';
      const leading = st === 'offline'
        ? <span className={`${s.dot} ${s.dotWarn}`}><WifiOff {...I} /></span>
        : st === 'online'
          ? <span className={`${s.dot} ${s.dotLive}`}><Check {...I} /></span>
          : <span className={`${s.dot} ${s.dotNeutral}`}><Loader2 {...I} className={s.spin} /></span>;
      return { leading, label: text, minimal: leading, spoken: text, announce: text, expanded: null, tone: st === 'offline' ? 'warn' : st === 'online' ? 'live' : 'neutral' };
    }
    case 'missedCall': {
      const { count, at } = a.state;
      const peer = a.attributes.peer;
      const video = a.attributes.media === 'video';
      const what = video ? 'video call' : 'call';
      const when = new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const leading = <span className={`${s.dot} ${s.dotDanger}`}><PhoneMissed {...I} /></span>;
      return {
        tone: 'danger',
        leading,
        label: peer,
        trailing: <span className={s.trailing}>{count > 1 ? `${count} missed` : 'Missed'}</span>,
        minimal: leading,
        spoken: `${count > 1 ? `${count} missed ${what}s` : `Missed ${what}`} from ${peer}. Show options`,
        announce: `Missed ${what} from ${peer}`,
        expanded: (
          <>
            <div className={s.head}>
              <span className={s.avatar} aria-hidden="true">{initials(peer)}</span>
              <div className={s.titles}>
                <p className={s.title}>{peer}</p>
                <p className={s.subtitle}>{count > 1 ? `${count} missed ${what}s` : `Missed ${what}`} · {when}</p>
              </div>
            </div>
            <div className={`${s.actions} ${s.actionsSpread}`}>
              <button type="button" className={s.btn} onClick={() => { c.act?.('open'); c.dismiss(); }}>
                <MessageCircle {...I} /> Message
              </button>
              <button type="button" className={`${s.btn} ${s.btnLive}`} onClick={() => { c.act?.('callBack'); c.dismiss(); }} data-autofocus>
                {video ? <Video {...I} /> : <Phone {...I} />} Call back
              </button>
            </div>
          </>
        ),
      };
    }
    case 'notice':
      return presentNotice(a, c);
  }
}

const NOTICE_TONE: Record<NoticeTone, Tone> = { success: 'live', error: 'danger', warning: 'warn', info: 'violet', loading: 'neutral', neutral: 'neutral' };
/** Past this many characters the title takes two lines and the capsule becomes a banner. */
const NOTICE_ONE_LINE = 38;

function noticeMark(tone: NoticeTone, progress: number | undefined) {
  switch (tone) {
    case 'success': return <span className={`${s.dot} ${s.dotLive}`}><Check {...I} /></span>;
    case 'error': return <span className={`${s.dot} ${s.dotDanger}`}><AlertTriangle {...I} /></span>;
    case 'warning': return <span className={`${s.dot} ${s.dotWarn}`}><AlertTriangle {...I} /></span>;
    case 'info': return <span className={`${s.dot} ${s.dotViolet}`}><Info {...I} /></span>;
    case 'loading':
      return progress !== undefined
        ? <Ring value={progress} tone="live"><span className={s.ringPct}>{Math.round(progress * 100)}</span></Ring>
        : <span className={`${s.dot} ${s.dotNeutral}`}><Loader2 {...I} className={s.spin} /></span>;
    default: return <span className={`${s.dot} ${s.dotNeutral}`}><Check {...I} /></span>;
  }
}

function presentNotice(a: Extract<AnyActivity, { kind: 'notice' }>, c: PresentContext): Presentation {
  const { tone, title, detail, action, cancel, progress } = a.state;
  const mark = noticeMark(tone, progress);
  const spoken = [title, detail].filter(Boolean).join('. ');
  const hasMore = !!detail || !!cancel;
  const quick = action
    ? (
      <button
        type="button"
        className={`${s.quick} ${tone === 'error' ? s.quickDanger : ''}`}
        onClick={(e) => { e.stopPropagation(); c.act?.('action', e); }}
      >
        {action}
      </button>
    )
    : undefined;
  return {
    tone: NOTICE_TONE[tone],
    tall: Array.from(title).length > NOTICE_ONE_LINE,
    leading: mark,
    label: title,
    quick,
    minimal: mark,
    spoken: hasMore ? `${spoken}. Show more` : spoken,
    // A file being sent says "42%" forty times; it is announced once when it starts, and again
    // when it ends, never at every step.
    announce: tone === 'loading' ? title.replace(/,?\s*\d{1,3}(?:\.\d+)?\s?%|\s*\b\d{1,6}\s?\/\s?\d{1,6}\b/g, '').trim() : spoken,
    expanded: hasMore
      ? (
        <>
          <div className={s.head}>
            {mark}
            <div className={s.titles}>
              <p className={`${s.title} ${s.titleWrap}`}>{title}</p>
              {detail && <p className={`${s.subtitle} ${s.subtitleWrap}`}>{detail}</p>}
            </div>
          </div>
          <div className={s.actions}>
            {cancel && <button type="button" className={s.btn} onClick={(e) => c.act?.('cancel', e)}>{cancel}</button>}
            {action && <button type="button" className={`${s.btn} ${s.btnOn}`} onClick={(e) => c.act?.('action', e)} data-autofocus>{action}</button>}
            {!action && !cancel && <button type="button" className={s.btn} onClick={c.dismiss}><X {...I} /> Close</button>}
          </div>
        </>
      )
      : null,
  };
}

export { present };
