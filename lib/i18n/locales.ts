/**
 * lib/i18n/locales.ts — the languages Ledger Chat speaks.
 *
 * English is the source language: every interface text is written in English in the code and is
 * its own key (t("Send")). The other languages are dictionaries in lib/i18n/messages/<code>.json
 * that map the English text to its translation. A text missing from a dictionary shows in English,
 * never as a key or as a blank.
 *
 * The choice is stored in the `hl_locale` cookie, so the server renders the page in that language
 * from the first byte (no flash of English). Without the cookie, the browser's Accept-Language
 * decides among the supported languages, and English is the fallback.
 */
export const LOCALES = ['en', 'es', 'ru', 'de', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'hl_locale';

/** Names shown in the language picker, each in its own language. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  ru: 'Русский',
  de: 'Deutsch',
  zh: '简体中文',
};

/** Value for <html lang>: screen readers, hyphenation and the CJK font fallback read it. */
export const HTML_LANG: Record<Locale, string> = { en: 'en', es: 'es', ru: 'ru', de: 'de', zh: 'zh-Hans' };

/** Locale tag for Intl (dates, numbers). */
export const INTL_LOCALE: Record<Locale, string> = { en: 'en-US', es: 'es-ES', ru: 'ru-RU', de: 'de-DE', zh: 'zh-CN' };

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}

/** 'es-MX', 'zh-Hans-CN', 'DE' … → a supported locale, or null. */
export function normalizeLocale(v: string | null | undefined): Locale | null {
  if (!v) return null;
  const base = v.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : null;
}

/** Picks the first supported language of an Accept-Language header, by its q weights. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(',')
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const weight = q ? Number(q.slice(2)) : 1;
      return { tag, weight: Number.isFinite(weight) ? weight : 0, i };
    })
    .filter((x) => x.tag && x.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.i - b.i);
  for (const { tag } of ranked) {
    const l = normalizeLocale(tag);
    if (l) return l;
  }
  return null;
}
