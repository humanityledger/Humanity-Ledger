'use client';
/**
 * components/beta/BetaRequestForm.tsx: asking for an invitation code on /beta.
 *
 * Words and fields only. The request goes by email to the beta team (POST /api/beta/cusdc/apply),
 * who answer that same email with a code. Nothing from the form is saved in the database.
 */
import React, { useId, useRef, useState } from 'react';

type Field = 'name' | 'email' | 'wallet' | 'social' | 'message' | 'adult' | 'contact';

const input =
  'mt-1.5 block w-full rounded-[14px] border border-slate-200 bg-white px-4 text-[15.5px] text-[#15171C] ' +
  'shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#98A2B3] ' +
  'focus:border-[#5200FF] focus:shadow-[0_0_0_4px_rgba(82,0,255,0.12)] aria-[invalid=true]:border-[#F04438]';
const label = 'block text-[14px] font-medium text-[#344054]';
const hint = 'text-[13px] font-normal text-[#98A2B3]';

export function BetaRequestForm({
  wallet,
  primaryClass,
  quietClass,
  onBack,
}: {
  wallet?: string;
  primaryClass: string;
  quietClass: string;
  onBack: () => void;
}) {
  const id = useId();
  const [values, setValues] = useState({ name: '', email: '', wallet: wallet ?? '', social: '', message: '', website: '' });
  const [adult, setAdult] = useState(false);
  const [contact, setContact] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field?: Field; text: string } | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const refs = useRef<Partial<Record<Field, HTMLInputElement | HTMLTextAreaElement | null>>>({});

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (error?.field === k) setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/beta/cusdc/apply', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, adult, contact }),
      });
      const data = (await r.json().catch(() => null)) as { sent?: boolean; error?: string; field?: Field } | null;
      if (r.ok && data?.sent) {
        setSentTo(values.email.trim());
        return;
      }
      const field = data?.field;
      setError({ field, text: data?.error || 'Your request could not be sent right now. Try again in a few minutes.' });
      if (field) refs.current[field]?.focus();
    } catch {
      setError({ text: 'Your request could not be sent. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <section data-testid="beta-request-sent">
        <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-[#15171C]">Request sent</h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-[#475467]">
          Thank you. We read every request ourselves. If there is a place for you, we will reply to <span className="font-medium text-[#15171C]">{sentTo}</span> with
          your invitation code.
        </p>
        <p className="mt-3 text-[14.5px] leading-relaxed text-[#475467]">When it arrives, come back to this page, sign in with your wallet and enter the code.</p>
        <button type="button" className={`${primaryClass} mt-7`} onClick={onBack}>Back to the beta</button>
      </section>
    );
  }

  const invalid = (f: Field) => (error?.field === f ? true : undefined);
  const errId = `${id}-error`;

  return (
    <form onSubmit={submit} noValidate data-testid="beta-request-form" aria-describedby={error ? errId : undefined}>
      <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-[#15171C]">Request an invitation</h2>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#475467]">
        Tell us who you are and we will reply by email. Places are limited to 100 people.
      </p>

      <div className="mt-6 space-y-5">
        <div>
          <label htmlFor={`${id}-name`} className={label}>Full name</label>
          <input
            id={`${id}-name`} ref={(el) => { refs.current.name = el; }} className={`${input} h-[50px]`}
            value={values.name} onChange={set('name')} autoComplete="name" maxLength={80} required aria-invalid={invalid('name')}
          />
        </div>
        <div>
          <label htmlFor={`${id}-email`} className={label}>Email</label>
          <input
            id={`${id}-email`} ref={(el) => { refs.current.email = el; }} className={`${input} h-[50px]`} type="email" inputMode="email"
            value={values.email} onChange={set('email')} autoComplete="email" maxLength={254} required aria-invalid={invalid('email')}
          />
          <p className={`mt-1.5 ${hint}`}>We send your code here.</p>
        </div>
        <div>
          <label htmlFor={`${id}-wallet`} className={label}>
            Ethereum wallet address <span className={hint}>Optional</span>
          </label>
          <input
            id={`${id}-wallet`} ref={(el) => { refs.current.wallet = el; }} className={`${input} h-[50px] font-mono text-[14px]`}
            value={values.wallet} onChange={set('wallet')} autoComplete="off" spellCheck={false} maxLength={42} aria-invalid={invalid('wallet')}
          />
          <p className={`mt-1.5 ${hint}`}>The wallet you will sign in with.</p>
        </div>
        <div>
          <label htmlFor={`${id}-social`} className={label}>
            X or Telegram <span className={hint}>Optional</span>
          </label>
          <input
            id={`${id}-social`} ref={(el) => { refs.current.social = el; }} className={`${input} h-[50px]`}
            value={values.social} onChange={set('social')} autoComplete="off" maxLength={60} aria-invalid={invalid('social')}
          />
        </div>
        <div>
          <label htmlFor={`${id}-message`} className={label}>
            What would you like to test <span className={hint}>Optional</span>
          </label>
          <textarea
            id={`${id}-message`} ref={(el) => { refs.current.message = el; }} className={`${input} min-h-[112px] resize-y py-3 leading-relaxed`}
            value={values.message} onChange={set('message')} maxLength={600} aria-invalid={invalid('message')}
          />
        </div>

        {/* Hidden from people; bots fill it in. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
          <label htmlFor={`${id}-website`}>Website</label>
          <input id={`${id}-website`} tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} />
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-[#F8FAFC] px-4 py-4">
          <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-snug text-[#344054]">
            <input
              type="checkbox" className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#5200FF]" checked={adult}
              onChange={(e) => { setAdult(e.target.checked); if (error?.field === 'adult') setError(null); }} aria-invalid={invalid('adult')}
            />
            I am 18 or older.
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-snug text-[#344054]">
            <input
              type="checkbox" className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#5200FF]" checked={contact}
              onChange={(e) => { setContact(e.target.checked); if (error?.field === 'contact') setError(null); }} aria-invalid={invalid('contact')}
            />
            You may reply to this email about the beta. My details are only used for that.
          </label>
        </div>
      </div>

      {error && (
        <p id={errId} role="alert" className="mt-5 text-[14px] leading-snug text-[#B42318]">{error.text}</p>
      )}

      <button type="submit" className={`${primaryClass} mt-6`} disabled={busy || !values.name.trim() || !values.email.trim() || !adult || !contact}>
        {busy ? 'Sending' : 'Send request'}
      </button>
      <button type="button" className={`${quietClass} mt-4 block mx-auto`} disabled={busy} onClick={onBack}>I already have a code</button>
    </form>
  );
}
