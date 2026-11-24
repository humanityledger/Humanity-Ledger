/**
 * lib/i18n/runtime.ts — t(): the English text in, the active language out.
 *
 *   t("Send")                                   → "Enviar"
 *   t("{count} members", { count: 3 })          → "3 miembros"
 *   t("Read the {0} first", { 0: <a>…</a> })    → a fragment with the link in place (word order kept)
 *   t(item.label)                               → translated if it is a known text, unchanged otherwise
 *
 * Works in any module (components, helpers, toasts). In the browser the language is fixed for the
 * life of the page: changing it reloads the page (lib/i18n/client.tsx setLocale), so nothing
 * rendered earlier can stay in the old language. Components get t from useT(), which also gives the
 * server the request's language while it renders.
 */
import { createElement, Fragment, type ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale } from './locales';

export type Messages = Record<string, string>;

let activeLocale: Locale = DEFAULT_LOCALE;
let activeMessages: Messages = {};

/** Called by I18nProvider with the language the server rendered in. */
export function setActiveLanguage(locale: Locale, messages: Messages): void {
  activeLocale = locale;
  activeMessages = messages;
}

export function getActiveLocale(): Locale {
  return activeLocale;
}

const PLACEHOLDER = /\{(\w+)\}/g;

export type Translate = {
  (text: string, vars?: Record<string, string | number | null | undefined>): string;
  (text: string, vars: Record<string, ReactNode>): ReactNode;
  <T>(value: T): T;
};

function isPrimitive(v: unknown): v is string | number | null | undefined | boolean {
  return v === null || v === undefined || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

/** Translates with a given dictionary. Non-strings pass through untouched. */
export function translateWith(messages: Messages, value: unknown, vars?: Record<string, unknown>): any {
  if (typeof value !== 'string') return value;
  const hit = Object.prototype.hasOwnProperty.call(messages, value) ? messages[value] : undefined;
  const msg = typeof hit === 'string' && hit.length > 0 ? hit : value;
  if (!vars) return msg;
  const keys = Object.keys(vars);
  if (keys.length === 0) return msg;
  if (keys.every((k) => isPrimitive(vars[k]))) {
    return msg.replace(PLACEHOLDER, (m, k: string) => {
      if (!Object.prototype.hasOwnProperty.call(vars, k)) return m;
      const v = vars[k];
      return v === null || v === undefined || v === false ? '' : String(v);
    });
  }
  // A placeholder holds an element (a link, bold text…): return the pieces as one fragment.
  const parts: ReactNode[] = [];
  let last = 0;
  msg.replace(PLACEHOLDER, (m, k: string, offset: number) => {
    if (!Object.prototype.hasOwnProperty.call(vars, k)) return m;
    if (offset > last) parts.push(msg.slice(last, offset));
    parts.push(vars[k] as ReactNode);
    last = offset + m.length;
    return m;
  });
  if (last < msg.length) parts.push(msg.slice(last));
  return createElement(Fragment, null, ...parts);
}

export const t: Translate = ((value: unknown, vars?: Record<string, unknown>) =>
  translateWith(activeMessages, value, vars)) as Translate;
