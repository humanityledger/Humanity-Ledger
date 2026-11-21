'use client';

/**
 * Moment 3: the two-balls exchange, in three steps. Left, what you see; right, what your friend,
 * who cannot tell red from green, sees. It steps through once when it comes into view, then the
 * visitor drives it. Under reduced motion it opens on the last step.
 */
import React from 'react';
import s from './site.module.css';

interface Step { title: string; text: string }

function Balls({ colours }: { colours: [string, string] }) {
  return (
    <svg viewBox="0 0 240 112" className={s.anaSvg} aria-hidden="true">
      <circle className={s.ballA} cx="72" cy="44" r="22" fill={colours[0]} />
      <circle className={s.ballB} cx="168" cy="44" r="22" fill={colours[1]} />
      <g className={s.rounds}>
        {Array.from({ length: 20 }, (_, i) => (
          <rect key={i} x={20 + i * 10.2} y="86" width="6" height="12" rx="1" fill="#15171c" />
        ))}
      </g>
    </svg>
  );
}

export function ZkAnalogy({ steps }: { steps: readonly Step[] }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [step, setStep] = React.useState(0);
  const driven = React.useRef(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep(steps.length - 1);
      return;
    }
    let timers: number[] = [];
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        timers = [1, 2].map((n) => window.setTimeout(() => { if (!driven.current) setStep(n); }, n * 2400));
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [steps.length]);

  return (
    <div ref={ref} className={s.analogy} data-step={step}>
      <div className={s.anaStage}>
        <div className={s.anaView}>
          <span className={s.anaCaption}>You see</span>
          <Balls colours={['#ff3b30', '#10b981']} />
        </div>
        <div className={s.anaView}>
          <span className={s.anaCaption}>Your friend sees</span>
          <Balls colours={['#9aa1ad', '#9aa1ad']} />
        </div>
      </div>
      <div className={s.anaSteps} role="group" aria-label="The two-balls example, step by step">
        {steps.map((st, i) => (
          <button
            key={st.title}
            type="button"
            className={s.anaStep}
            aria-pressed={step === i}
            onClick={() => { driven.current = true; setStep(i); }}
          >
            <b>{st.title}</b>
            <span>{st.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
