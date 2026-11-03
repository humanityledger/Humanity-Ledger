'use client';

/**
 * A failure the user can act on: what happened in plain words, a retry, and
 * an error id they can copy into a support message (the same id is in the
 * server log). Never shows a raw status line such as "Request failed (500)".
 */

import React, { useState } from 'react';
import { AlertCircle, Check, Copy, RotateCw } from 'lucide-react';

export interface ErrorStateProps {
  title: string;
  message?: string;
  errorId?: string;
  onRetry?: () => void | Promise<unknown>;
  retryLabel?: string;
  /** Compact: one line plus a retry link, for narrow columns. */
  compact?: boolean;
}

export function ErrorState({ title, message, errorId, onRetry, retryLabel = 'Try again', compact }: ErrorStateProps) {
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);

  const retry = async () => {
    if (!onRetry || retrying) return;
    setRetrying(true);
    try { await onRetry(); } finally { setRetrying(false); }
  };

  const copy = async () => {
    if (!errorId) return;
    try {
      await navigator.clipboard.writeText(errorId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked: the id is still visible */ }
  };

  if (compact) {
    return (
      <div role="alert" className="px-4 py-2 text-[13px] leading-snug text-[var(--hl-ink-3)]">
        <span className="text-[var(--hl-ink-2)]">{title}</span>
        {onRetry && (
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="ml-2 font-medium text-[var(--hl-ink)] underline underline-offset-4 decoration-[var(--hl-border-strong)] hover:decoration-[var(--hl-ink)] disabled:opacity-50"
          >
            {retrying ? 'Retrying' : retryLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div role="alert" className="max-w-sm text-center flex flex-col items-center">
      <span className="w-10 h-10 rounded-full bg-[var(--hl-bg-muted)] text-[var(--hl-ink-2)] flex items-center justify-center" aria-hidden="true">
        <AlertCircle size={18} strokeWidth={1.75} />
      </span>
      <p className="mt-3 text-[15px] font-semibold text-[var(--hl-ink)]">{title}</p>
      {message && <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--hl-ink-3)]">{message}</p>}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[13px] font-medium bg-[var(--hl-ink)] text-[var(--hl-ink-inverse)] hover:bg-[var(--hl-primary-hover)] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hl-ink)]"
          >
            <RotateCw size={13} strokeWidth={2} className={retrying ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />
            {retrying ? 'Retrying' : retryLabel}
          </button>
        )}
        {errorId && (
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12.5px] text-[var(--hl-ink-3)] hover:bg-[var(--hl-bg-hover)] hover:text-[var(--hl-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hl-ink)]"
            aria-label={`Copy error ID ${errorId}`}
          >
            {copied ? <Check size={13} strokeWidth={2} aria-hidden="true" /> : <Copy size={13} strokeWidth={1.75} aria-hidden="true" />}
            <span className="font-mono tabular-nums">{copied ? 'Copied' : `Error ID ${errorId}`}</span>
          </button>
        )}
      </div>
    </div>
  );
}
