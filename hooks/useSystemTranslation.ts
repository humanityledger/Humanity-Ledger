import { useT, useLocale } from '@/lib/i18n/client';

/**
 * Labels for the terminal settings panel. The English text below is the source; it goes through
 * the global translator (lib/i18n), so these labels follow the language picker like the rest of
 * Ledger Chat. The old per-settings Spanish table is gone: one language setting, one source.
 */

const dictionaries = {
    en: {
        // General
        'GENERAL_SETTINGS': 'GENERAL SETTINGS',
        'APPEARANCE': 'APPEARANCE',
        'PRIVACY_SECURITY': 'PRIVACY & SECURITY',
        'SETTINGS': 'SETTINGS',
        'PREFERENCES': 'PREFERENCES',
        'MANAGE_CONFIG': 'MANAGE YOUR TERMINAL CONFIGURATION AND PERSONAL PREFERENCES.',
        'TOTAL_DISCONNECT': 'TOTAL DISCONNECT',
        'ALL_SESSIONS_TERMINATED': 'ALL SESSIONS TERMINATED.',

        // Settings Toggles
        'LANGUAGE': 'Language',
        'INTERFACE_LANGUAGE': 'Interface display language.',
        'BASE_CURRENCY': 'Base Currency',
        'DEFAULT_CURRENCY': 'Default currency for balances.',
        'TIME_FORMAT': 'Time Format',
        'TIME_LAYOUT': 'Time display layout.',
        'DATE_FORMAT': 'Date Format',
        'DATE_ORDERING': 'Day, month, and year ordering.',
        'ADDRESS_FORMAT': 'Address Format',
        'CRYPTO_RENDER': 'How cryptographic addresses are rendered.',
        'DENSITY': 'Density',
        'SPACING_DENSITY': 'Spacing density of the interface.',
        'SHOW_BALANCES': 'Show Balances',
        'DISPLAY_PORTFOLIO': 'Display portfolio balances on-screen.',
        'HW_ACCELERATION': 'Hardware Acceleration',
        'ENABLE_GPU': 'Enables high-performance GPU-accelerated rendering.',
        'INACTIVITY_TIMEOUT': 'Inactivity Timeout',
        'MINUTES_LOCK': 'Minutes of inactivity before auto-locking.',
        'STEALTH_MODE': 'Stealth Mode',
        'OBFUSCATE_VIS': 'Obfuscates all visible wallet and contract addresses.',
        'EXPORT_AUTH': 'Export Authorization',
        'REQ_CRYPTO_SIGN': 'Requires cryptographic signature validation before exporting ledger data.',
        
        // Navigation
        'NAV_DASHBOARD': 'Dashboard',
        'NAV_LEDGER_CHAT': 'LedgerChat',
        'NAV_PORTFOLIO': 'Portfolio',
        'NAV_COMMUNITY': 'Community',
        'NAV_NEWS': 'News',
        'NAV_ACADEMY': 'Academy',
        'NAV_FORUM': 'Forum',
        'NAV_CAREERS': 'Careers',
        'NAV_PRICING': 'Pricing',
        'NAV_STATUS': 'Status',
        'NAV_PRIVACY': 'Privacy',

        // Enum Labels
        'ENGLISH': 'English',
        'SPANISH': 'Spanish (ES)',
        'USD_DOLLAR': 'USD - Dollar',
        'EUR_EURO': 'EUR - Euro',
        'GBP_POUND': 'GBP - Pound',
        'JPY_YEN': 'JPY - Yen',
        '12_HOURS': '12 Hours (AM/PM)',
        '24_HOURS': '24 Hours',
        'ABBREVIATED': 'Abbreviated (0x1...ABCD)',
        'FULL_ADDRESS': 'Full Address',
        'RELAXED': 'Relaxed',
        'COMPACT': 'Compact',
        'DENSE': 'Dense',
        'MIN': 'MIN'
    }
};

export type TranslationKey = keyof typeof dictionaries['en'];

export function useSystemTranslation() {
    const tr = useT();
    const lang = useLocale();

    const t = (key: TranslationKey): string => tr(dictionaries.en[key] ?? key);

    return { t, lang };
}
