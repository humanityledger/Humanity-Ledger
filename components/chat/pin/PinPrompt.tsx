'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Delete, LoaderCircle, Lock } from 'lucide-react';
import s from './PinPrompt.module.css';

/**
 * PinPrompt — asks for the six digit PIN and checks it with the server.
 *
 * Every lock in Ledger Chat goes through this one component and the same
 * endpoint, /api/auth/enclave-pin, which hashes with Argon2id and enforces
 * the attempt limit. Nothing here compares a PIN in the browser: an earlier
 * version accepted any key press on the lock screen, and locked chats
 * accepted the fixed PINs 0000 and 1234.
 */

type Phase = 'idle' | 'checking' | 'wrong' | 'blocked' | 'nopin' | 'nosession' | 'error';

export interface PinPromptProps {
  /** "screen" fills its container; "overlay" floats over the page. */
  variant?: 'screen' | 'overlay';
  title?: string;
  subtitle?: string;
  onUnlock: () => void;
  onCancel?: () => void;
}

const LENGTH = 6;

export function PinPrompt({
  variant = 'overlay',
  title = 'Enter your PIN',
  subtitle = 'Your six digit Ledger Chat PIN.',
  onUnlock,
  onCancel,
}: PinPromptProps) {
  const [digits, setDigits] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = phase === 'checking';

  // The current digits, readable synchronously. Verification must not run
  // inside a state updater: React may call updaters twice in development.
  const digitsRef = useRef('');
  const setBoth = useCallback((value: string) => {
    digitsRef.current = value;
    setDigits(value);
  }, []);


  const verify = useCallback(
    async (pin: string) => {
      setPhase('checking');
      setMessage('Checking');
      try {
        const res = await fetch('/api/auth/enclave-pin', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.success) {
          setPhase('idle');
          setMessage('');
          onUnlock();
          return;
        }
        digitsRef.current = '';
        setDigits('');
        setShakeKey((k) => k + 1);
        if (res.status === 401) {
          setPhase('nosession');
          setMessage('Your session has ended. Sign in again to continue.');
        } else if (res.status === 404 || data?.needsPinSetup) {
          setPhase('nopin');
          setMessage('You have not set a PIN yet. Set one in Settings to use this lock.');
        } else if (res.status === 429 || data?.blocked) {
          setPhase('blocked');
          setMessage(data?.error || 'Too many attempts. Try again in a few minutes.');
        } else if (typeof data?.attemptsRemaining === 'number') {
          setPhase('wrong');
          setMessage(
            data.attemptsRemaining === 1
              ? 'Incorrect PIN. 1 attempt left before a short lockout.'
              : `Incorrect PIN. ${data.attemptsRemaining} attempts left.`,
          );
        } else {
          setPhase('wrong');
          setMessage(data?.error || 'Incorrect PIN.');
        }
      } catch {
        digitsRef.current = '';
        setDigits('');
        setPhase('error');
        setMessage('Could not reach the server. Check your connection and try again.');
      }
    },
    [onUnlock],
  );

  const push = useCallback(
    (d: string) => {
      if (busy || phase === 'blocked') return;
      const prev = digitsRef.current;
      if (prev.length >= LENGTH) return;
      const next = (prev + d).slice(0, LENGTH);
      setBoth(next);
      if (phase === 'wrong' || phase === 'error') {
        setPhase('idle');
        setMessage('');
      }
      if (next.length === LENGTH) void verify(next);
    },
    [busy, phase, verify, setBoth],
  );

  const back = useCallback(() => {
    if (busy) return;
    setBoth(digitsRef.current.slice(0, -1));
  }, [busy, setBoth]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        push(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        back();
      } else if (e.key === 'Escape' && onCancel) {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [push, back, onCancel]);

  const isError = phase === 'wrong' || phase === 'blocked' || phase === 'error' || phase === 'nosession';

  const body = (
    <div className={s.card}>
      <span className={s.icon} aria-hidden="true">
        <Lock size={22} strokeWidth={1.9} />
      </span>
      <h2 className={s.title}>{title}</h2>
      <p className={s.subtitle}>{subtitle}</p>

      <div key={shakeKey} className={`${s.dots} ${shakeKey ? s.shake : ''}`} aria-hidden="true">
        {Array.from({ length: LENGTH }).map((_, i) => (
          <span key={i} className={`${s.dot} ${i < digits.length ? s.dotFilled : ''}`} />
        ))}
      </div>

      <p className={`${s.message} ${isError ? s.error : ''}`} role="status" aria-live="polite">
        {busy ? (
          <LoaderCircle size={16} strokeWidth={2} className={s.spin} aria-label="Checking" />
        ) : (
          message
        )}
      </p>

      {/* A real input so phones show the number pad and screen readers can enter the PIN. */}
      <input
        ref={inputRef}
        className={s.hiddenInput}
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="PIN"
        value={digits}
        onChange={(e) => {
          const only = e.target.value.replace(/\D/g, '').slice(0, LENGTH);
          if (only.length > digits.length) {
            for (const ch of only.slice(digits.length)) push(ch);
          } else {
            setBoth(only);
          }
        }}
      />

      <div className={s.pad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className={s.key} onClick={() => push(d)} disabled={busy || phase === 'blocked'}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" className={s.key} onClick={() => push('0')} disabled={busy || phase === 'blocked'}>
          0
        </button>
        <button
          type="button"
          className={`${s.key} ${s.keyGhost}`}
          onClick={back}
          disabled={busy || digits.length === 0}
          aria-label="Delete last digit"
        >
          <Delete size={22} strokeWidth={1.8} />
        </button>
      </div>

      <div className={s.footer}>
        {phase === 'nosession' && (
          <a className={s.textButton} href="/connect?redirect=%2Fchat">
            Sign in again
          </a>
        )}
        {phase === 'nopin' && (
          <button type="button" className={s.textButton} onClick={onUnlock}>
            Continue without a PIN
          </button>
        )}
        {onCancel && (
          <button type="button" className={s.textButton} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );

  if (variant === 'screen') {
    return <div className={`${s.wrap} ${s.screen}`}>{body}</div>;
  }
  return (
    <div
      className={`${s.wrap} ${s.overlay}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && onCancel) onCancel();
      }}
    >
      {body}
    </div>
  );
}

export default PinPrompt;
