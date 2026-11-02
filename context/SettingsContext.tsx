'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useAccount } from 'wagmi';
import { dictionary } from '@/lib/dictionary';
import { toast } from 'sonner';
import { 
    AnalyticsConfig, ExecutionConfig, UiConfig, 
    getDefaultUserSettings 
} from '@/lib/settings-validation';


// --- TYPES ---
export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'MXN';
export type Language = 'en' | 'es' | 'fr' | 'pt';
export type SearchEngine = 'Google' | 'DuckDuckGo' | 'Brave';
export type ThemeMode = 'light' | 'dark' | 'auto';
export type BackupFrequency = 'daily' | 'weekly' | 'monthly';
export type UserTier = 'basic' | 'pro';

export interface Contact {
    id: string;
    name: string;
    address: string;
    memo?: string;
}

export interface SettingsContextType {
    tier: UserTier;
    setTier: (t: UserTier) => void;
    // General
    theme: ThemeMode;
    setTheme: (t: ThemeMode) => void;
    currency: Currency;
    setCurrency: (c: Currency) => void;
    language: Language;
    setLanguage: (l: Language) => void;
    searchEngine: SearchEngine;
    setSearchEngine: (s: SearchEngine) => void;

    // Security & Privacy
    hideBalances: boolean;
    toggleHideBalances: () => void;
    privacyMode: boolean; // Hide data from 3rd parties
    togglePrivacyMode: () => void;
    humanMetrics: boolean; // "MetaMetrics"
    toggleHumanMetrics: () => void;
    strictMode: boolean; // Whitelist Only
    toggleStrictMode: () => void;
    walletStealthMode: boolean;
    toggleWalletStealthMode: () => void;
    requirePasswordForSigning: boolean;
    toggleRequirePasswordForSigning: () => void;
    autoLockDuration: number;
    setAutoLockDuration: (m: number) => void;
    revealSecretPhrase: () => string; // Mock

    // Advanced
    testNetsEnabled: boolean;
    toggleTestNets: () => void;
    ipfsGateway: string;
    setIpfsGateway: (url: string) => void;
    customRPC: string;
    setCustomRPC: (url: string) => void;
    stateLogsEnabled: boolean;
    toggleStateLogs: () => void;
    resetAccount: () => void;

    // Contacts
    contacts: Contact[];
    addContact: (name: string, address: string, memo?: string) => void;
    removeContact: (id: string) => void;

    // Notifications
    emailNotifications: boolean;
    toggleEmailNotifications: () => void;
    pushNotifications: boolean;
    togglePushNotifications: () => void;
    transactionAlerts: boolean;
    toggleTransactionAlerts: () => void;
    marketingEmails: boolean;
    toggleMarketingEmails: () => void;

    // Backup
    backupFrequency: BackupFrequency;
    setBackupFrequency: (f: BackupFrequency) => void;
    lastBackupAt: Date | null;
    triggerBackup: () => void;

    // Attesting
    defaultSlippage: number;
    setDefaultSlippage: (s: number) => void;
    defaultGasPrice: string;
    setDefaultGasPrice: (p: string) => void;

    // [ABSOLUTE EXTENSION] Cosmic Configs
    analyticsConfig: AnalyticsConfig;
    setAnalyticsConfig: (c: Partial<AnalyticsConfig>) => void;
    executionConfig: ExecutionConfig;
    setExecutionConfig: (c: Partial<ExecutionConfig>) => void;
    uiConfig: UiConfig;
    setUiConfig: (c: Partial<UiConfig>) => void;


    // Helper Functions
    formatAmount: (amount: number) => string;
    lockApp: () => void;
    t: (key: string) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    // --- INITIAL STATES (With Persistence) ---
    // General
    const [theme, setTheme] = useState<ThemeMode>('light');
    const [currency, setCurrency] = useState<Currency>('USD');
    const [language, setLanguage] = useState<Language>('en');
    const [searchEngine, setSearchEngine] = useState<SearchEngine>('Google');
    const [tier, setTier] = useState<'basic' | 'pro'>('pro'); // Default to pro

    // Security
    const [hideBalances, setHideBalances] = useState(false);
    const [privacyMode, setPrivacyMode] = useState(true);
    const [strictMode, setStrictMode] = useState(false);
    const [humanMetrics, setHumanMetrics] = useState(false);
    const [walletStealthMode, setWalletStealthMode] = useState(false);
    const [requirePasswordForSigning, setRequirePasswordForSigning] = useState(true);
    const [autoLockDuration, setAutoLockDuration] = useState(15);

    // Advanced
    const [testNetsEnabled, setTestNetsEnabled] = useState(false);
    const [ipfsGateway, setIpfsGateway] = useState('https://ipfs.io/ipfs/');
    const [customRPC, setCustomRPC] = useState('');
    const [stateLogsEnabled, setStateLogsEnabled] = useState(false);

    // Contacts
    const [contacts, setContacts] = useState<Contact[]>([
        { id: '1', name: 'Main Vault', address: '0x7883...7b4a' }
    ]);

    // Notifications
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [pushNotifications, setPushNotifications] = useState(true);
    const [transactionAlerts, setTransactionAlerts] = useState(true);
    const [marketingEmails, setMarketingEmails] = useState(false);

    // Backup
    const [backupFrequency, setBackupFrequency] = useState<BackupFrequency>('weekly');

    // Attesting
    const [defaultSlippage, setDefaultSlippage] = useState(0.5);
    const [defaultGasPrice, setDefaultGasPrice] = useState('medium');

    // [ABSOLUTE EXTENSION] Cosmic Configs
    const [analyticsConfig, setAnalyticsState] = useState<AnalyticsConfig>(getDefaultUserSettings().analyticsConfig);
    const [executionConfig, setExecutionState] = useState<ExecutionConfig>(getDefaultUserSettings().executionConfig);
    const [uiConfig, setUiState] = useState<UiConfig>(getDefaultUserSettings().uiConfig);

    const setAnalyticsConfig = (c: Partial<AnalyticsConfig>) => setAnalyticsState(prev => ({ ...prev, ...c }));
    const setExecutionConfig = (c: Partial<ExecutionConfig>) => setExecutionState(prev => ({ ...prev, ...c }));
    const setUiConfig = (c: Partial<UiConfig>) => setUiState(prev => ({ ...prev, ...c }));


    //  Cryptographic DOM LIGHT MODE LOCK (runs on every theme change) 
    // The SettingsContext `theme` state may be set to 'dark' from an old saved
    // preference, but this platform enforces light mode for ALL users at all
    // connection states. We intercept here and hard-pin the DOM to light.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const root = window.document.documentElement;
        // Regardless of what `theme` value is saved, the platform is light-only.
        root.classList.remove('dark');
        root.classList.add('light');
        root.style.colorScheme = 'light';
    }, [theme]);

    // --- Cryptographic SIWE AUTH --- 
    const { address } = useAccount();
    // The system user identity is the wallet address
    const userId = address || null;
    const userEmail = null; // Email is not available in SIWE-only flow
    const [version, setVersion] = useState<number>(1);

    // --- SYNC STATES ---
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
    const [lastBackupAt, setLastBackupAt] = useState<Date | null>(null);

    // [LEGENDARY PERSISTENCE] Refs to manage sync flow & prevent loops
    const initialLoadDone = useRef(false);
    const skipNextSave = useRef(false);
    const lastSavedHash = useRef<string>('');

    // --- LOAD SETTINGS (Using Sync Service) ---
    useEffect(() => {
        // if (!userId) return; // Allow loading for email users

        const loadSettings = async () => {
            if (initialLoadDone.current) return;
            
            setIsSyncing(true);
            setSyncError(null);

            try {
                // Import service dynamically to avoid SSR issues
                const { settingsSyncService } = await import('@/lib/settings-sync');
                
                // Load settings from service (handles local + cloud)
                const result = await settingsSyncService.loadSettings();
                
                if (result) {
                    const { settings, version: cloudVersion } = result;
                    
                    // Mark next save as skip because we just loaded these values
                    skipNextSave.current = true;
                    applySettings(settings);
                    if (cloudVersion) setVersion(Number(cloudVersion));
                    setLastSyncAt(new Date());
                    
                    // Update the saved hash to match what we just loaded
                    const settingsToHash = {
                        theme: settings.theme,
                        currency: settings.currency, 
                        language: settings.language, 
                        searchEngine: settings.searchEngine,
                        hideBalances: settings.hideBalances, 
                        privacyMode: settings.privacyMode, 
                        strictMode: settings.strictMode, 
                        humanMetrics: settings.humanMetrics,
                        walletStealthMode: settings.walletStealthMode,
                        requirePasswordForSigning: settings.requirePasswordForSigning,
                        autoLockDuration: settings.autoLockDuration,
                        testNetsEnabled: settings.testNetsEnabled, 
                        ipfsGateway: settings.ipfsGateway, 
                        customRPC: settings.customRPC, 
                        stateLogsEnabled: settings.stateLogsEnabled,
                        contacts: settings.contacts, 
                        emailNotifications: settings.emailNotifications,
                        pushNotifications: settings.pushNotifications,
                        transactionAlerts: settings.transactionAlerts,
                        marketingEmails: settings.marketingEmails,
                        backupFrequency: settings.backupFrequency,
                        defaultSlippage: settings.defaultSlippage,
                        defaultGasPrice: settings.defaultGasPrice,
                        analyticsConfig: settings.analyticsConfig,
                        executionConfig: settings.executionConfig,
                        uiConfig: settings.uiConfig
                    };

                    lastSavedHash.current = JSON.stringify(settingsToHash);
                }
            } catch (error: any) {
                console.error('[Legendary-Sync] Failed to load cloud settings:', error);
                setSyncError(error.message);
                
                // LocalStorage is our rock-solid fallback
                try {
                    const local = localStorage.getItem('humanid_settings_v3');
                    if (local) {
                        // Validate first: an old or corrupt copy must not reach the UI.
                        const { validateUserSettings } = await import('@/lib/settings-validation');
                        const checked = validateUserSettings(JSON.parse(local));
                        if (checked.success) applySettings(checked.data);
                    }
                } catch (e) {
                    console.error('[Legendary-Sync] Local fallback failed:', e);
                }
            } finally {
                setIsSyncing(false);
                initialLoadDone.current = true;
            }
        };

        loadSettings();
    }, [userId]); // Fixed: Only re-run when user ID changes

    // Helper to apply settings object
    const applySettings = (parsed: any) => {
        if (parsed.theme) setTheme(parsed.theme);
        if (parsed.currency) setCurrency(parsed.currency);
        if (parsed.language) setLanguage(parsed.language);
        if (parsed.searchEngine) setSearchEngine(parsed.searchEngine);
        if (parsed.hideBalances !== undefined) setHideBalances(parsed.hideBalances);
        if (parsed.privacyMode !== undefined) setPrivacyMode(parsed.privacyMode);
        if (parsed.strictMode !== undefined) setStrictMode(parsed.strictMode);
        if (parsed.humanMetrics !== undefined) setHumanMetrics(parsed.humanMetrics);
        if (parsed.walletStealthMode !== undefined) setWalletStealthMode(parsed.walletStealthMode);
        if (parsed.requirePasswordForSigning !== undefined) setRequirePasswordForSigning(parsed.requirePasswordForSigning);
        if (parsed.autoLockDuration !== undefined) setAutoLockDuration(parsed.autoLockDuration);
        if (parsed.testNetsEnabled !== undefined) setTestNetsEnabled(parsed.testNetsEnabled);
        if (parsed.ipfsGateway) setIpfsGateway(parsed.ipfsGateway);
        if (parsed.customRPC) setCustomRPC(parsed.customRPC);
        if (parsed.stateLogsEnabled !== undefined) setStateLogsEnabled(parsed.stateLogsEnabled);
        if (parsed.contacts) setContacts(parsed.contacts);
        if (parsed.emailNotifications !== undefined) setEmailNotifications(parsed.emailNotifications);
        if (parsed.pushNotifications !== undefined) setPushNotifications(parsed.pushNotifications);
        if (parsed.transactionAlerts !== undefined) setTransactionAlerts(parsed.transactionAlerts);
        if (parsed.marketingEmails !== undefined) setMarketingEmails(parsed.marketingEmails);
        if (parsed.backupFrequency) setBackupFrequency(parsed.backupFrequency);
        if (parsed.defaultSlippage !== undefined) setDefaultSlippage(parsed.defaultSlippage);
        if (parsed.defaultGasPrice) setDefaultGasPrice(parsed.defaultGasPrice);
        
        // Absolute Extension
        if (parsed.analyticsConfig) setAnalyticsState(prev => ({ ...prev, ...parsed.analyticsConfig }));
        if (parsed.executionConfig) setExecutionState(prev => ({ ...prev, ...parsed.executionConfig }));
        if (parsed.uiConfig) setUiState(prev => ({ ...prev, ...parsed.uiConfig }));
    };


    // --- AUTO SAVE (Using Sync Service with Optimistic Updates) ---
    useEffect(() => {
        const saveSettings = async () => {
            // [CRITICAL] Prevent saving before first load is complete
            if (!initialLoadDone.current) return;

            const settingsToSave = {
                theme, currency, language, searchEngine,
                hideBalances, privacyMode, strictMode, humanMetrics,
                walletStealthMode, requirePasswordForSigning, autoLockDuration,
                testNetsEnabled, ipfsGateway, customRPC, stateLogsEnabled,
                contacts, emailNotifications, pushNotifications, transactionAlerts, marketingEmails,
                backupFrequency, defaultSlippage, defaultGasPrice,
                analyticsConfig, executionConfig, uiConfig,
                version // [LEGENDARY PERSISTENCE] Send version to prevent data loss
            };


            const currentHash = JSON.stringify(settingsToSave);

            // [OPTIMISTIC PERSISTENCE] Always update localStorage immediately
            try {
                localStorage.setItem('humanid_settings_v3', currentHash);
            } catch (e) {
                console.error('[Legendary-Sync] Local save failed:', e);
            }

            // [LOOP PROTECTION] Skip cloud sync if specifically marked or if data hasn't changed
            if (skipNextSave.current) {
                console.log('[Legendary-Sync] Skipping redundant cloud save (Apply Phase)');
                skipNextSave.current = false;
                lastSavedHash.current = currentHash;
                return;
            }

            if (currentHash === lastSavedHash.current) {
                // console.log('[Legendary-Sync] No changes detected, skipping cloud sync.');
                return;
            }

            // Save to cloud if logged in (de-bounced 2s)
            if (userId) {
                const timeoutId = setTimeout(async () => {
                    setIsSyncing(true);
                    setSyncError(null);

                    try {
                        const { settingsSyncService } = await import('@/lib/settings-sync');
                        const result = await settingsSyncService.saveSettings(settingsToSave as any);
                        
                        if (result.success) {
                            setLastSyncAt(new Date());
                            if (result.version) setVersion(result.version);
                            setSyncError(null);
                            lastSavedHash.current = currentHash;
                            
                            // Visual feedback only for actual user changes
                            toast.success("Settings Synced", { 
                                description: "Configuration secured in Human Cloud.",
                                duration: 2000,
                                icon: ""
                            });
                        } else {
                            // Don't spam toasts for silent background failures unless they persist
                            setSyncError(result.error || 'Sync failed');
                            console.warn('[Legendary-Sync] Cloud sync failed:', result.error);
                        }
                    } catch (error: any) {
                        console.error('[Legendary-Sync] Background cloud save error:', error);
                        setSyncError(error.message);
                    } finally {
                        setIsSyncing(false);
                    }
                }, 2000);

                return () => clearTimeout(timeoutId);
            }
        };

        saveSettings();
    }, [
        theme, currency, language, searchEngine, hideBalances, privacyMode, strictMode, humanMetrics,
        walletStealthMode, requirePasswordForSigning, autoLockDuration,
        testNetsEnabled, ipfsGateway, customRPC, stateLogsEnabled, contacts,
        emailNotifications, pushNotifications, transactionAlerts, marketingEmails,
        backupFrequency, defaultSlippage, defaultGasPrice, userId,
        analyticsConfig, executionConfig, uiConfig
    ]);


    // --- FUNCTIONS ---
    const toggleHideBalances = () => setHideBalances(prev => !prev);
    const togglePrivacyMode = () => setPrivacyMode(prev => !prev);
    const toggleStrictMode = () => setStrictMode(prev => !prev);
    const toggleHumanMetrics = () => setHumanMetrics(prev => !prev);

    const toggleTestNets = () => setTestNetsEnabled(prev => !prev);
    const toggleStateLogs = () => setStateLogsEnabled(prev => !prev);

    const resetAccount = () => {
        localStorage.removeItem('humanid_settings_v2');
        window.location.reload();
    };

    const revealSecretPhrase = () => {
        return "ocean crisp manual verify logic safe worry casual verify logic safe worry";
    };

    const addContact = (name: string, address: string, memo?: string) => {
        setContacts([...contacts, { id: Date.now().toString(), name, address, memo }]);
    };

    const removeContact = (id: string) => {
        setContacts(contacts.filter(c => c.id !== id));
    };

    const toggleEmailNotifications = () => setEmailNotifications(prev => !prev);
    const togglePushNotifications = () => setPushNotifications(prev => !prev);
    const toggleTransactionAlerts = () => setTransactionAlerts(prev => !prev);
    const toggleMarketingEmails = () => setMarketingEmails(prev => !prev);
    const toggleWalletStealthMode = () => setWalletStealthMode(prev => !prev);
    const toggleRequirePasswordForSigning = () => setRequirePasswordForSigning(prev => !prev);

    const triggerBackup = () => {
        setLastSyncAt(new Date());
        toast.success("Manual Backup Triggered", { description: "Your encrypted keys have synced locally." });
    };

    const lockApp = () => {
        // Mock locking
        alert(" SESSION LOCKED. Please re-authenticate.");
        window.location.reload();
    };

    const formatAmount = (amount: number) => {
        if (hideBalances) return '****';
        const rates: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 150, MXN: 17.50 };
        // const symbols: Record<string, string> = { USD: '$', EUR: '', GBP: '£', JPY: '¥', MXN: '$' };
        const value = amount * (rates[currency] || 1);

        return new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US', {
            style: 'currency', currency: currency
        }).format(value);
    };

    const t = (key: string) => {
        // @ts-ignore
        return dictionary[language]?.[key] || dictionary['en'][key] || key;
    };

    return (
        <SettingsContext.Provider value={{
            theme, setTheme, currency, setCurrency, language, setLanguage, searchEngine, setSearchEngine,
            hideBalances, toggleHideBalances, privacyMode, togglePrivacyMode, strictMode, toggleStrictMode, humanMetrics, toggleHumanMetrics, revealSecretPhrase,
            walletStealthMode, toggleWalletStealthMode, requirePasswordForSigning, toggleRequirePasswordForSigning, autoLockDuration, setAutoLockDuration,
            testNetsEnabled, toggleTestNets, ipfsGateway, setIpfsGateway, customRPC, setCustomRPC, stateLogsEnabled, toggleStateLogs, resetAccount,
            contacts, addContact, removeContact,
            emailNotifications, toggleEmailNotifications, pushNotifications, togglePushNotifications, transactionAlerts, toggleTransactionAlerts, marketingEmails, toggleMarketingEmails,
            backupFrequency, setBackupFrequency, lastBackupAt, triggerBackup,
            defaultSlippage, setDefaultSlippage, defaultGasPrice, setDefaultGasPrice,
            analyticsConfig, setAnalyticsConfig, executionConfig, setExecutionConfig, uiConfig, setUiConfig,
            formatAmount, lockApp, t,
            tier, setTier
        }}>
            {children}
        </SettingsContext.Provider>
    );
}

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error('useSettings must be used within a SettingsProvider');
    return context;
};
