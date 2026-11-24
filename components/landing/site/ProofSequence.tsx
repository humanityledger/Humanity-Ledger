'use client';

/**
 * Moment 2: a private payment in four steps. When the row comes into view, the amount folds into
 * a proof, the proof travels to the network, and only a check comes back; the recipient's device
 * then shows the amount. It plays once, can be replayed, and shows its final state at once under
 * reduced motion. Transitions are opacity and transform only (site.module.css, ".played").
 */
import React from 'react';
import s from './site.module.css';

interface Step { title: string; text: string }

const AMOUNT = '25.00';

function Vis({ i }: { i: number }) {
  if (i === 0) {
    return (
      <svg viewBox="0 0 220 120" aria-hidden="true" className={`${s.pv} ${s.pv1}`}>
        <rect x="30" y="38" width="160" height="44" rx="8" fill="#fff" stroke="#15171c" />
        <text x="46" y="67" style={{ fontFamily: 'var(--mono)' }} fontSize="20" fill="#15171c">{AMOUNT}</text>
        <rect x="112" y="50" width="1.5" height="20" fill="#2754d6" />
        <text x="170" y="66" textAnchor="end" fontSize="11" fill="#5f6673">USDC</text>
      </svg>
    );
  }
  if (i === 1) {
    return (
      <svg viewBox="0 0 220 120" aria-hidden="true" className={`${s.pv} ${s.pv2}`}>
        <g className={s.fold}>
          <text x="110" y="67" textAnchor="middle" style={{ fontFamily: 'var(--mono)' }} fontSize="20" fill="#15171c">{AMOUNT}</text>
        </g>
        <g className={s.lattice}>
          {Array.from({ length: 25 }, (_, k) => (
            <rect key={k} x={85 + (k % 5) * 10} y={35 + Math.floor(k / 5) * 10} width="8" height="8" rx="1" fill="#15171c" opacity={k % 3 === 0 ? 0.25 : k % 4 === 1 ? 0.55 : 1} />
          ))}
        </g>
      </svg>
    );
  }
  if (i === 2) {
    return (
      <svg viewBox="0 0 220 120" aria-hidden="true" className={`${s.pv} ${s.pv3}`}>
        <line x1="34" y1="60" x2="176" y2="60" stroke="#c9ced8" strokeDasharray="3 4" />
        <circle cx="182" cy="60" r="18" fill="#fff" stroke="#15171c" />
        <text x="182" y="64" textAnchor="middle" fontSize="10" style={{ fontFamily: 'var(--mono)' }} fill="#15171c">Aztec</text>
        <g className={s.packet}>
          {Array.from({ length: 9 }, (_, k) => (
            <rect key={k} x={30 + (k % 3) * 7} y={50 + Math.floor(k / 3) * 7} width="5" height="5" rx="1" fill="#15171c" />
          ))}
        </g>
        <g className={s.check}>
          <circle cx="182" cy="26" r="9" fill="#10b981" />
          <path d="M177.5 26.2l3 3 5-5.4" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 220 120" aria-hidden="true" className={`${s.pv} ${s.pv4}`}>
      <rect x="30" y="34" width="160" height="52" rx="8" fill="#fff" stroke="#c9ced8" />
      <text x="46" y="56" fontSize="11" fill="#5f6673">Received, private</text>
      <text x="46" y="76" style={{ fontFamily: 'var(--mono)' }} fontSize="18" fill="#15171c">{AMOUNT}</text>
      <path d="M166 52.5V49a5 5 0 0 1 10 0v3.5M164 52.5h14v11h-14z" fill="none" stroke="#15171c" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function ProofSequence({ steps, label }: { steps: readonly Step[]; label: React.ReactNode }) {
  const ref = React.useRef<HTMLOListElement>(null);
  const [armed, setArmed] = React.useState(false);
  const [played, setPlayed] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setArmed(true);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined') {
      setPlayed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPlayed(true);
          io.disconnect();
        }
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const replay = () => {
    setPlayed(false);
    // Two frames: the reset paints before the sequence starts again.
    requestAnimationFrame(() => requestAnimationFrame(() => setPlayed(true)));
  };

  return (
    <div>
      <div className={s.proofBar}>
        {label}
        <button type="button" className={s.replay} onClick={replay}>Replay</button>
      </div>
      <ol ref={ref} className={`${s.proof} ${armed ? s.armed : ''} ${played ? s.played : ''}`} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {steps.map((st, i) => (
          <li key={st.title} className={s.proofStep}>
            <div className={s.proofVis}><Vis i={i} /></div>
            <h3 className={s.proofTitle}>{st.title}</h3>
            <p className={s.proofText}>{st.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
