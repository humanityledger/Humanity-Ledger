'use client';

import React from 'react';
import s from './site.module.css';

/** A full value, shortened on screen, with a button that copies the whole of it. */
export function CopyText({ value, label }: { value: string; label: string }) {
  const [done, setDone] = React.useState(false);
  const short = value.length > 22 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
  return (
    <span className={s.hash}>
      <code title={value}>{short}</code>
      <button
        type="button"
        className={s.copy}
        aria-label={`Copy ${label}`}
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => {
            setDone(true);
            window.setTimeout(() => setDone(false), 1400);
          });
        }}
      >
        {done ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}
