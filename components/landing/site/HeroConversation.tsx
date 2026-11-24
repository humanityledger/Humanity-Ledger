'use client';

/**
 * Moment 1: the hero conversation, on the display of a phone in a hand (PhotoMockup). Messages arrive, then a payment. For the two people it reads
 * as words and an amount; for everyone else, as MLS ciphertext and a verified proof. Both layers
 * are always rendered in the same grid cell, so switching never moves the layout.
 *
 * The view alternates on its own until the visitor picks one, and stays put under reduced motion.
 * Data comes from the server (lib/landing/chapters.ts, HERO_THREAD) as props, so the copy does not
 * ship twice in the bundle.
 */
import React from 'react';
import s from './site.module.css';
import { DeviceScreen, PhotoMockup } from './PhotoMockup';
import type { ClaimLabel } from '@/lib/landing/claims';

interface Thread {
  people: { a: string; b: string };
  messages: readonly { from: string; text: string }[];
  payment: { amount: string; note: string; label: ClaimLabel };
  after: { from: string; text: string };
  observer: { message: string; proof: string; fields: readonly { k: string; v: string }[] };
  views: { inside: string; outside: string };
}

type View = 'inside' | 'outside';

function Bubble({ from, text, cipher }: { from: string; text: string; cipher: string }) {
  return (
    <div className={`${s.bubble} ${from === 'a' ? s.bubbleA : s.bubbleB}`}>
      <span className={`${s.layer} ${s.inside}`}>{text}</span>
      <span className={`${s.layer} ${s.outside} ${s.bars}`} aria-hidden="true" title={cipher}><i /><i /></span>
    </div>
  );
}

export function HeroConversation({ thread }: { thread: Thread }) {
  const [view, setView] = React.useState<View>('inside');
  const chosen = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      if (!chosen.current && document.visibilityState === 'visible') setView((v) => (v === 'inside' ? 'outside' : 'inside'));
    }, 5200);
    return () => window.clearInterval(id);
  }, []);

  const pick = (v: View) => {
    chosen.current = true;
    setView(v);
  };

  const { people, messages, payment, after, observer, views } = thread;
  return (
    <div className={s.heroMock}>
    <PhotoMockup id="hand-front" size="hero" priority>
    <DeviceScreen>
    <figure className={s.conv} data-view={view} aria-label="A conversation in Ledger Chat with a private payment">
      <div className={s.convHead}>
        <span className={s.avatars} aria-hidden="true">
          <span className={s.avatar}>{people.a[0]}</span>
          <span className={s.avatar}>{people.b[0]}</span>
        </span>
        <span>
          <span className={s.convTitle}>{people.a} and {people.b}</span>
          <span className={s.convMeta}>
            <span className={`${s.layer} ${s.inside}`}>
              <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 7V5.2a3.5 3.5 0 0 1 7 0V7M3.5 7h9v6.5h-9z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
              MLS, end-to-end encrypted
            </span>
            <span className={`${s.layer} ${s.outside}`}>Seen from outside: {observer.message}</span>
          </span>
        </span>
      </div>

      <div className={s.convBody}>
        {messages.map((m, i) => <Bubble key={i} from={m.from} text={m.text} cipher={observer.message} />)}

        <div className={s.pay}>
          <div className={`${s.layer} ${s.inside}`} aria-hidden={view === 'outside'}>
            <div className={s.payTop}>
              <span>{payment.note}</span>
            </div>
            <div className={s.payAmount}>{payment.amount}</div>
            <div className={s.payNote}>On Aztec Alpha. Amount and recipient stay private.</div>
          </div>
          <div className={`${s.layer} ${s.outside}`} aria-hidden={view === 'inside'}>
            <div className={s.payTop}>
              <span className={s.verifiedLine}>
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="M4.8 8.2l2.1 2.1 4.3-4.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {observer.proof}
              </span>
            </div>
            <div className={s.proofGlyph} aria-hidden="true">
              {Array.from({ length: 24 }, (_, i) => <i key={i} />)}
            </div>
            <dl className={s.payFields}>
              {observer.fields.map((f) => (
                <div key={f.k}>
                  <dt>{f.k}</dt>
                  <dd>{f.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <Bubble from={after.from} text={after.text} cipher={observer.message} />
      </div>
      <div className={s.composer} aria-hidden="true">
        <span className={s.cRound}><svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg></span>
        <span className={s.cField}>Message</span>
        <span className={`${s.cRound} ${s.cInk}`}><svg width="15" height="15" viewBox="0 0 16 16"><path d="M8 2.5a2 2 0 0 0-2 2v4a2 2 0 0 0 4 0v-4a2 2 0 0 0-2-2zM4 8a4 4 0 0 0 8 0M8 12v2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></span>
      </div>
    </figure>
    </DeviceScreen>
    </PhotoMockup>

      <div className={`${s.seg} ${s.segOut}`} role="group" aria-label="Who is looking">
        <button type="button" className={s.segBtn} aria-pressed={view === 'inside'} onClick={() => pick('inside')}>{views.inside}</button>
        <button type="button" className={s.segBtn} aria-pressed={view === 'outside'} onClick={() => pick('outside')}>{views.outside}</button>
        <p className={s.segHint} aria-live="polite">
          {view === 'inside' ? 'What the two people in the conversation see.' : 'What the network and any observer see.'}
        </p>
      </div>
    </div>
  );
}
