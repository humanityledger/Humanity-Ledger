'use client';
/**
 * Language picker: the phone's own picker (a native <select>), so it works the same in Safari,
 * Chrome, iOS and Android, with the keyboard and with screen readers. Each language is named in
 * itself. Choosing one stores it and reloads the page in that language (lib/i18n/client.tsx).
 */
import React from 'react';
import { Languages } from 'lucide-react';
import { LOCALES, LOCALE_NAMES, setLocale, useLocale, useT, type Locale } from '@/lib/i18n/client';

export function LanguagePicker({ variant = 'row' }: { variant?: 'row' | 'compact' }) {
  const t = useT();
  const locale = useLocale();
  const select = (
    <select
      aria-label={t('Language')}
      data-testid="language-picker"
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className={
        variant === 'compact'
          ? 'h-9 rounded-full border border-[#e4e7ec] bg-white px-3 text-[13.5px] text-[#15171c]'
          : 'h-10 max-w-[180px] rounded-xl border border-[#e4e7ec] bg-white px-3 text-[15px] text-[#15171c]'
      }
    >
      {LOCALES.map((l) => (
        <option key={l} value={l} lang={l === 'zh' ? 'zh-Hans' : l}>
          {LOCALE_NAMES[l]}
        </option>
      ))}
    </select>
  );
  if (variant === 'compact') return select;
  return (
    <div className="w-full flex items-center justify-between gap-3 py-3 border-b border-[#f0f1f4]">
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[#eff1f4] text-[#15171c] [&>svg]:w-[17px] [&>svg]:h-[17px]" aria-hidden="true">
        <Languages />
      </span>
      <div className="flex-1 min-w-0 pr-2">
        <p className="text-[15px] font-medium leading-tight text-[#15171c]">{t('Language')}</p>
        <p className="text-[13px] text-[#727a88] mt-0.5 leading-snug">{t('The page reloads in the language you choose.')}</p>
      </div>
      {select}
    </div>
  );
}
