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
import { AlertTriangle, ArrowDownLeft, Check, Loader2, MessageCircle, Mic, MicOff, Phone, PhoneIncoming, PhoneOff, PictureInPicture2, Maximize2, Video, WifiOff, X } from 'lucide-react';
import type { AnyActivity, ProofStep } from '@/lib/activities/types';
import type { CallControls } from '@/lib/activities/call-media';
import { formatAmount, formatElapsed, spokenDuration } from '@/lib/activities/values';
import s from './activities.module.css';

export interface PresentContext {
  now: number;
  controls: CallControls | null;
  /** Leaves the island for the floating window (calls only). */
  toWindow: () => void;
  dismiss: () => void;
}

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
            {x.label}
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
          leading: <span className={`${s.dot} ${s.dotLive}`}><PhoneIncoming {...I} /></span>,
          label: peer,
          trailing: <span className={s.trailing}>Incoming</span>,
          minimal: <PhoneIncoming {...IL} />,
          spoken: `Incoming ${kind} from ${peer}`,
          announce: `Incoming ${kind} from ${peer}`,
          assertive: true,
          expanded: (
            <>
              <div className={s.head}>
                <span className={s.avatar} aria-hidden="true">{initials(peer)}</span>
                <div className={s.titles}>
                  <p className={s.title}>{peer}</p>
                  <p className={s.subtitle}>Incoming {kind} · Encrypted</p>
                </div>
              </div>
              <div className={`${s.actions} ${s.actionsSpread}`}>
                <button type="button" className={`${s.btn} ${s.btnDanger}`} onClick={() => c.controls?.decline?.()} disabled={!c.controls?.decline}>
                  <PhoneOff {...I} /> Decline
                </button>
                <button type="button" className={`${s.btn} ${s.btnLive}`} onClick={() => c.controls?.answer?.()} disabled={!c.controls?.answer} data-autofocus>
                  {a.attributes.media === 'video' ? <Video {...I} /> : <Phone {...I} />} Answer
                </button>
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
        };
      }
      const warn = phase === 'reconnecting';
      const status = phase === 'outgoing' ? 'Calling' : phase === 'connecting' ? 'Connecting' : warn ? 'Reconnecting' : timer ?? '';
      return {
        leading: <span className={`${s.dot} ${warn ? s.dotWarn : s.dotLive}`}>{micMuted ? <MicOff {...I} /> : <Phone {...I} />}</span>,
        label: peer,
        trailing: <span className={`${s.trailing} ${timer && !warn ? s.trailingStrong : ''}`}>{status}</span>,
        minimal: <span className={`${s.dot} ${warn ? s.dotWarn : s.dotLive}`}><Phone {...I} /></span>,
        spoken: `Call with ${peer}, ${warn ? 'reconnecting' : timer ? `${spokenDuration(c.now - (connectedAt ?? c.now))}` : status.toLowerCase()}${micMuted ? ', muted' : ''}. Open call controls`,
        announce: warn ? `Reconnecting the call with ${peer}` : phase === 'active' ? `Connected with ${peer}` : `${status} ${peer}`,
        expanded: (
          <>
            <div className={s.head}>
              <span className={s.avatar} aria-hidden="true">{initials(peer)}</span>
              <div className={s.titles}>
                <p className={s.title}>{peer}</p>
                <p className={s.subtitle}>{warn ? 'Reconnecting…' : timer ? `${timer} · Encrypted` : `${status}…`}</p>
              </div>
            </div>
            <div className={s.actions}>
              <button type="button" className={`${s.btn} ${s.btnIcon} ${micMuted ? s.btnOn : ''}`} onClick={() => c.controls?.toggleMic()} aria-pressed={micMuted} aria-label={micMuted ? 'Unmute' : 'Mute'}>
                {micMuted ? <MicOff {...I} /> : <Mic {...I} />}
              </button>
              <button type="button" className={`${s.btn} ${s.btnIcon}`} onClick={c.toWindow} aria-label="Show in a floating window">
                <PictureInPicture2 {...I} />
              </button>
              <button type="button" className={`${s.btn} ${s.btnIcon}`} onClick={() => c.controls?.openStage()} aria-label="Open the full call">
                <Maximize2 {...I} />
              </button>
              <button type="button" className={`${s.btn} ${s.btnDanger}`} onClick={() => c.controls?.end()} aria-label="End call">
                <PhoneOff {...I} /> End
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
      const leading = failed
        ? <span className={`${s.dot} ${s.dotDanger}`}><AlertTriangle {...I} /></span>
        : done
          ? <span className={`${s.dot} ${s.dotLive}`}><Check {...I} /></span>
          : <span className={`${s.dot} ${s.dotViolet}`}><Loader2 {...I} className={s.spin} /></span>;
      return {
        leading,
        label: `${amount} to ${to}`,
        trailing: <span className={`${s.trailing} ${done || failed ? s.trailingStrong : ''}`}>{STEP_SHORT[step]}</span>,
        minimal: leading,
        spoken: `Private payment of ${amount} to ${to}: ${STEP_SHORT[step].toLowerCase()}`,
        announce: failed ? `Payment of ${amount} to ${to} failed` : done ? `Payment of ${amount} to ${to} sent` : `Payment of ${amount} to ${to}: ${STEP_SHORT[step].toLowerCase()}`,
        expanded: (
          <>
            <div className={s.head}>
              {leading}
              <div className={s.titles}>
                <p className={s.title}>Private payment to {to}</p>
                <p className={s.subtitle}>{failed ? 'It did not go through. Nothing was sent.' : 'Amount and parties stay private on Aztec'}</p>
              </div>
              <span className={s.amount}>{amount}</span>
            </div>
            <Steps step={step} />
            {failed && (
              <div className={s.actions}>
                <button type="button" className={s.btn} onClick={c.dismiss}><X {...I} /> Close</button>
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
              <p className={s.subtitle}>Sent you a private payment</p>
            </div>
            <span className={s.amount}>+{amount}</span>
          </div>
        ),
      };
    }
    case 'recording': {
      const t = formatElapsed(c.now - a.state.startedAt);
      return {
        leading: <span className={`${s.dot} ${s.dotDanger}`}><Mic {...I} /></span>,
        label: 'Recording',
        trailing: <span className={`${s.trailing} ${s.trailingStrong}`}>{t}</span>,
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
        leading: <span className={`${s.dot} ${s.dotNeutral}`}><MessageCircle {...I} /></span>,
        label: from,
        trailing: <span className={s.trailing}>{n > 1 ? `${n} new` : 'New message'}</span>,
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
      return { leading, label: text, minimal: leading, spoken: text, announce: text, expanded: null };
    }
  }
}

export { present };
