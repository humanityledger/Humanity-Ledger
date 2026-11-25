/**
 * lib/i18n/server.ts — the request's language on the server (root layout, server components).
 */
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { DEFAULT_LOCALE, LOCALE_COOKIE, localeFromAcceptLanguage, normalizeLocale, type Locale } from './locales';
import { translateWith, type Messages, type Translate } from './runtime';

/** The cookie set by the language picker, else the browser's languages, else English. */
export const getServerLocale = cache(async (): Promise<Locale> => {
  const fromCookie = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  if (fromCookie) return fromCookie;
  return localeFromAcceptLanguage((await headers()).get('accept-language')) ?? DEFAULT_LOCALE;
});

/** The dictionary of a language. English is the source text itself, so it needs none. */
export async function loadMessages(locale: Locale): Promise<Messages> {
  switch (locale) {
    case 'es':
      return (await import('./messages/es.json')).default as Messages;
    case 'ru':
      return (await import('./messages/ru.json')).default as Messages;
    case 'de':
      return (await import('./messages/de.json')).default as Messages;
    case 'zh':
      return (await import('./messages/zh.json')).default as Messages;
    default:
      return {};
  }
}

/** t for server components: `const t = await getT();` */
export const getT = cache(async (): Promise<Translate> => {
  const messages = await loadMessages(await getServerLocale());
  return ((v: unknown, vars?: Record<string, unknown>) => translateWith(messages, v, vars)) as Translate;
});
