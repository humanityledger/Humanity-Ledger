'use client';
/**
 * components/beta/BetaRequestForm.tsx: asking for an invitation code on /beta.
 *
 * A short questionnaire in three steps, one group of questions at a time:
 *   1. You            Full name and Email (required).
 *   2. How you'd use it  what they want to try (chips), Ethereum wallet address, X or Telegram, and
 *                        What would you like to test (all optional).
 *   3. Confirm        a summary to check, I am 18 or older., and permission to reply by email.
 * The request goes by email to the beta team (POST /api/beta/cusdc/apply) exactly as before; the
 * chips are folded into the message, so the server contract does not change. Nothing from the form
 * is saved in the database. A field the server refuses brings the person back to its step.
 */
import React, { useId, useRef, useState } from 'react';
import s from './BetaGateView.module.css';
import { useT } from '@/lib/i18n/client';

type Field = 'name' | 'email' | 'wallet' | 'social' | 'message' | 'adult' | 'contact';
type QStep = 0 | 1 | 2;

const STEPS = ['You', "How you'd use it", 'Confirm'] as const;
const STEP_OF: Record<Field, QStep> = { name: 0, email: 0, wallet: 1, social: 1, message: 1, adult: 2, contact: 2 };
const INTERESTS = ['Paying friends', 'Invoices for my work', 'Testing the privacy', 'Building on Aztec', 'Just curious'] as const;
const MESSAGE_MAX = 600;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const input =
  'mt-1.5 block w-full rounded-[12px] border border-slate-200/90 bg-white/85 px-4 text-[15.5px] text-[#15171C] ' +
  'shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#98A2B3] ' +
  'focus:border-[#2754D6] focus:shadow-[0_0_0_4px_rgba(39,84,214,0.14)] aria-[invalid=true]:border-[#F04438]';
const label = 'block text-[14px] font-medium text-[#344054]';
const hint = 'text-[13px] font-normal text-[#667085]';
const secondary =
  'h-[52px] rounded-[12px] border border-slate-200/90 bg-white/70 px-5 text-[15px] font-semibold text-[#15171C] ' +
  'transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2754D6]/25 disabled:opacity-50';

/** The message sent to the team: the chosen interests first, then the person's own words. */
export function composeMessage(interests: readonly string[], text: string): string {
  const head = interests.length ? `Interested in: ${interests.join(', ')}.` : '';
  const body = text.trim();
  return [head, body].filter(Boolean).join('\n').slice(0, MESSAGE_MAX);
}

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
  const t = useT();
  const id = useId();
  const [values, setValues] = useState({ name: '', email: '', wallet: wallet ?? '', social: '', message: '', website: '' });
  const [interests, setInterests] = useState<string[]>([]);
  const [adult, setAdult] = useState(false);
  const [contact, setContact] = useState(false);
  const [step, setStep] = useState<QStep>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field?: Field; text: string } | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const refs = useRef<Partial<Record<Field, HTMLInputElement | HTMLTextAreaElement | null>>>({});

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (error?.field === k) setError(null);
  };
  const toggle = (x: string) => setInterests((xs) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]));

  const stepOneProblem = (): { field: Field; text: string } | null => {
    if (!values.name.trim()) return { field: 'name', text: t("Tell us your name.") };
    if (!EMAIL.test(values.email.trim())) return { field: 'email', text: t("Enter an email address we can reply to.") };
    return null;
  };

  const next = () => {
    if (step === 0) {
      const p = stepOneProblem();
      if (p) { setError(p); refs.current[p.field]?.focus(); return; }
    }
    setError(null);
    setStep((v) => (Math.min(2, v + 1) as QStep));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 2) { next(); return; }
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/beta/cusdc/apply', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, message: composeMessage(interests, values.message), adult, contact }),
      });
      const data = (await r.json().catch(() => null)) as { sent?: boolean; error?: string; field?: Field } | null;
      if (r.ok && data?.sent) {
        setSentTo(values.email.trim());
        return;
      }
      const field = data?.field;
      setError({ field, text: data?.error || 'Your request could not be sent right now. Try again in a few minutes.' });
      if (field) {
        setStep(STEP_OF[field]);
        window.setTimeout(() => refs.current[field]?.focus(), 60);
      }
    } catch {
      setError({ text: t("Your request could not be sent. Check your connection and try again.") });
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <section data-testid="beta-request-sent" className={s.qStep}>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#10B981]/12" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 28 28"><path d="M8 14.5l4 4L20.5 10" fill="none" stroke="#047857" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h2 className={`mt-4 text-center text-[30px] leading-[1.08] ${s.display}`}>{t("Request sent")}</h2>
        <p className="mt-3 text-center text-[14.5px] leading-relaxed text-[#475467]">{t("Thank you. We read every request ourselves. If there is a place for you, we will reply to {0} with your invitation code.", { 0: <span className="font-medium text-[#15171C]">{sentTo}</span> })}</p>
        <p className="mt-3 text-center text-[14.5px] leading-relaxed text-[#475467]">{t("When it arrives, come back to this page, sign in with your wallet and enter the code.")}</p>
        <button type="button" className={`${primaryClass} mt-7`} onClick={onBack}>{t("Back to the beta")}</button>
      </section>
    );
  }

  const invalid = (f: Field) => (error?.field === f ? true : undefined);
  const errId = `${id}-error`;
  const summary: [string, string][] = [
    ['Full name', values.name.trim()],
    ['Email', values.email.trim()],
    ['Wallet', values.wallet.trim() || 'Not given'],
    ['X or Telegram', values.social.trim() || 'Not given'],
    ['Interested in', interests.length ? interests.join(', ') : 'Not given'],
  ];

  return (
    <form onSubmit={submit} noValidate data-testid="beta-request-form" aria-describedby={error ? errId : undefined}>
      <p className={s.eyebrow}>{t("Request an invitation")}</p>
      <h2 className={`mt-2 text-[30px] leading-[1.08] ${s.display}`}>{['A little about you', 'How you would use it', 'Check and send'][step]}</h2>
      <p className="mt-2 text-[14.5px] leading-relaxed text-[#475467]">
        {step === 0 && t("Tell us who you are and we will reply by email. Places are limited to 100 people.")}
        {step === 1 && t("All optional. It helps us choose testers who will try what needs testing.")}
        {step === 2 && t("This goes to the beta team by email. Nothing is stored in our database.")}
      </p>

      <ol className="mt-6 grid grid-cols-3 gap-2" aria-label={t("Questionnaire steps")}>
        {STEPS.map((x, i) => (
          <li key={x} aria-current={i === step ? 'step' : undefined}>
            <span className={`block h-[3px] rounded-full transition-colors duration-300 ${i < step ? 'bg-[#10B981]' : i === step ? 'bg-[#15171C]' : 'bg-slate-200'}`} />
            <span className={`mt-2 block text-[12px] font-medium ${i === step ? 'text-[#15171C]' : i < step ? 'text-[#047857]' : 'text-[#98A2B3]'}`}>{i + 1}. {t(x)}</span>
          </li>
        ))}
      </ol>

      <div key={step} className={`mt-6 space-y-5 ${s.qStep}`}>
        {step === 0 && (
          <>
            <div>
              <label htmlFor={`${id}-name`} className={label}>{t("Full name")}</label>
              <input
                id={`${id}-name`} ref={(el) => { refs.current.name = el; }} className={`${input} h-[50px]`}
                value={values.name} onChange={set('name')} autoComplete="name" maxLength={80} required aria-invalid={invalid('name')} autoFocus
              />
            </div>
            <div>
              <label htmlFor={`${id}-email`} className={label}>{t("Email")}</label>
              <input
                id={`${id}-email`} ref={(el) => { refs.current.email = el; }} className={`${input} h-[50px]`} type="email" inputMode="email"
                value={values.email} onChange={set('email')} autoComplete="email" maxLength={254} required aria-invalid={invalid('email')}
              />
              <p className={`mt-1.5 ${hint}`}>{t("We send your code here.")}</p>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <fieldset>
              <legend className={label}>{t("What would you like to try?")}</legend>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {INTERESTS.map((x) => (
                  <button key={x} type="button" className={s.chip} aria-pressed={interests.includes(x)} onClick={() => toggle(x)}>
                    {interests.includes(x) && (
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M3 7.2l2.6 2.6L11 4.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    )}
                    {t(x)}
                  </button>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor={`${id}-wallet`} className={label}>{t("Ethereum wallet address {0}", { 0: <span className={hint}>{t("Optional")}</span> })}
              </label>
              <input
                id={`${id}-wallet`} ref={(el) => { refs.current.wallet = el; }} className={`${input} h-[50px] font-mono text-[14px]`}
                value={values.wallet} onChange={set('wallet')} autoComplete="off" spellCheck={false} maxLength={42} aria-invalid={invalid('wallet')}
                placeholder="0x…"
              />
              <p className={`mt-1.5 ${hint}`}>{t("The wallet you will sign in with.")}</p>
            </div>
            <div>
              <label htmlFor={`${id}-social`} className={label}>{t("X or Telegram {0}", { 0: <span className={hint}>{t("Optional")}</span> })}
              </label>
              <input
                id={`${id}-social`} ref={(el) => { refs.current.social = el; }} className={`${input} h-[50px]`}
                value={values.social} onChange={set('social')} autoComplete="off" maxLength={60} aria-invalid={invalid('social')} placeholder="@"
              />
            </div>
            <div>
              <label htmlFor={`${id}-message`} className={label}>{t("What would you like to test {0}", { 0: <span className={hint}>{t("Optional")}</span> })}
              </label>
              <textarea
                id={`${id}-message`} ref={(el) => { refs.current.message = el; }} className={`${input} min-h-[112px] resize-y py-3 leading-relaxed`}
                value={values.message} onChange={set('message')} maxLength={MESSAGE_MAX - 120} aria-invalid={invalid('message')}
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <dl className={`rounded-2xl px-4 py-2 ${s.glassSoft}`}>
              {summary.map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4 border-t border-slate-200/60 py-2.5 first:border-t-0">
                  <dt className="text-[13px] text-[#667085]">{k}</dt>
                  <dd className={`m-0 max-w-[62%] break-words text-right text-[13.5px] font-medium ${v === 'Not given' ? 'text-[#98A2B3]' : 'text-[#15171C]'}`}>{v}</dd>
                </div>
              ))}
            </dl>
            <div className={`space-y-3 rounded-2xl px-4 py-4 ${s.glassSoft}`}>
              <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-snug text-[#344054]">
                <input
                  type="checkbox" className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#15171C]" checked={adult}
                  onChange={(e) => { setAdult(e.target.checked); if (error?.field === 'adult') setError(null); }} aria-invalid={invalid('adult')}
                />
                {t("I am 18 or older.")}
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-snug text-[#344054]">
                <input
                  type="checkbox" className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#15171C]" checked={contact}
                  onChange={(e) => { setContact(e.target.checked); if (error?.field === 'contact') setError(null); }} aria-invalid={invalid('contact')}
                />
                {t("You may reply to this email about the beta. My details are only used for that.")}
              </label>
            </div>
          </>
        )}

        {/* Hidden from people; bots fill it in. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
          <label htmlFor={`${id}-website`}>{t("Website")}</label>
          <input id={`${id}-website`} tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} />
        </div>
      </div>

      {error && (
        <p id={errId} role="alert" className="mt-5 rounded-[12px] border border-[#FECDCA] bg-[#FFFBFA]/90 px-4 py-3 text-[14px] leading-snug text-[#B42318]">{error.text}</p>
      )}

      <div className={`mt-6 grid gap-2 ${step > 0 ? 'grid-cols-[auto_1fr]' : ''}`}>
        {step > 0 && (
          <button type="button" className={secondary} disabled={busy} onClick={() => { setError(null); setStep((v) => (Math.max(0, v - 1) as QStep)); }}>
            {t("Back")}
          </button>
        )}
        {step < 2 ? (
          <button type="submit" className={primaryClass}>{t("Continue")}</button>
        ) : (
          <button type="submit" className={primaryClass} disabled={busy || !values.name.trim() || !values.email.trim() || !adult || !contact}>
            {busy ? t("Sending") : t("Send request")}
          </button>
        )}
      </div>
      <button type="button" className={`${quietClass} mt-4 block mx-auto`} disabled={busy} onClick={onBack}>{t("I already have a code")}</button>
    </form>
  );
}
