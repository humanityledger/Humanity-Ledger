'use client';
/**
 * lib/i18n/client.tsx — the language in React.
 *
 * I18nProvider (root layout) receives the language and dictionary the server chose for this
 * request. useT() returns t for that language; outside the provider it falls back to the
 * module-level t (lib/i18n/runtime.ts), which the provider also sets in the browser.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from './locales';
import { setActiveLanguage, t as globalT, translateWith, type Messages, type Translate } from './runtime';

export { t } from './runtime';
export { LOCALES, LOCALE_NAMES, type Locale } from './locales';

type Ctx = { locale: Locale; t: Translate };
const I18nContext = createContext<Ctx>({ locale: DEFAULT_LOCALE, t: globalT });

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: React.ReactNode }) {
  // Set during render, before any child renders, so helpers and toasts that use the module-level t
  // speak the same language as the components. In the browser the page has one language for its life.
  if (typeof window !== 'undefined') setActiveLanguage(locale, messages);
  const value = useMemo<Ctx>(
    () => ({ locale, t: ((v: unknown, vars?: Record<string, unknown>) => translateWith(messages, v, vars)) as Translate }),
    [locale, messages],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** t for the current language: `const t = useT();` at the top of a component. */
export function useT(): Translate {
  return useContext(I18nContext).t;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}

/**
 * Stores the choice (cookie for the server, one year) and reloads, so every text on the page,
 * including those computed before the change, comes back in the new language.
 */
export function setLocale(next: Locale): void {
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax${secure}`;
    localStorage.setItem(LOCALE_COOKIE, next);
  } catch {
    /* storage unavailable: the cookie alone is enough */
  }
  window.location.reload();
}
