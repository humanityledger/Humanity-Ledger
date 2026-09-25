import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '@/lib/security/safe-storage';

// ═══════════════════════════════════════════════════════════════════════════
//  SystemSettings — The Complete Quantum UX Configuration Object
//  Every toggle, slider, and selection a Ledger user will ever need.
// ═══════════════════════════════════════════════════════════════════════════

export interface SystemSettings {
    // ── 1. General ────────────────────────────────────────────────────────
    theme: 'light' | 'dark' | 'system';
    density: 'relaxed' | 'compact' | 'dense';
    language: 'en' | 'es-ES';
    currency: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF';
    timeFormat: '12h' | '24h';
    dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY';
    addressFormat: 'truncated' | 'full';

    // ── 2. Display & Hardware ─────────────────────────────────────────────
    defaultTimeframe: '1D' | '1W' | '1M' | 'ALL';
    displayUnit: 'FIAT' | 'BTC' | 'ETH';
    showBalances: boolean;
    soundEffects: boolean;
    hapticFeedback: boolean;
    hardwareAcceleration: boolean;

    // ── 3. Network & RPC ──────────────────────────────────────────────────
    gasPreset: 'ECONOMY' | 'STANDARD' | 'FAST' | 'INSTANT';
    maxSlippage: number;
    customRpcUrl: string;
    mevProtection: boolean;
    testnetMode: boolean;

    // ── 4. Sonar Alerts ───────────────────────────────────────────────────
    emailAlerts: boolean;
    telegramAlerts: boolean;
    audioAlerts: boolean;
    ledgerAlertThreshold: number;
    email: string;

    // ── 5. Privacy & Security ─────────────────────────────────────────────
    inactivityLockMinutes: number;
    autoDisconnectTimer: '15m' | '1h' | '24h' | 'never';
    stealthMode: boolean;
    requireSignForExports: boolean;
    allowAnalytics: boolean;

    // ── 6. Chat Identity ──────────────────────────────────────────────────
    chatName: string;
    chatBio: string;
    qrLabel: string;
    hiddenAssets?: string;

    // ═══════════════════════════════════════════════════════════════════
    //  QUANTUM UX — Hyper-Personalization Layer
    // ═══════════════════════════════════════════════════════════════════

    // ── 7. Chat Aesthetics & Vibes ────────────────────────────────────────
    /** Chat background style */
    chatBackground: 'default' | 'amoled' | 'holographic' | 'matrix' | 'gradient' | 'custom';
    /** User-supplied background image as a Data URL */
    chatBackgroundCustomUrl: string;
    /** Message bubble visual style */
    bubbleStyle: 'default' | 'glass' | 'brutalist' | 'cyberpunk' | 'minimal';
    /** Primary accent color for own bubbles (hex) */
    accentColor: string;
    /** Chat typography */
    chatFont: 'inter' | 'space-mono' | 'fira-code' | 'satoshi';
    /** Text size in the chat (1–7 scale, maps to pixel sizes) */
    textSize: number;
    /** Enable glowing NFT-style border on profile avatars */
    nftBorderEnabled: boolean;
    /** NFT border color preset */
    nftBorderColor: 'ethereum' | 'polygon' | 'gold' | 'rainbow';

    // ── 8. Security & Sovereignty ─────────────────────────────────────────
    /** Burn-on-Read: destroy messages N seconds after the recipient opens them */
    burnOnRead: boolean;
    /** Seconds before a read message auto-destructs (3, 10, 30, 60) */
    burnOnReadSeconds: 3 | 10 | 30 | 60;
    /** Watermark mode: overlay recipient address on-screen to deter leaks */
    watermarkEnabled: boolean;
    /** Number of onion routing hops (1 = direct, 3 = standard, 5 = max) */
    onionHops: 1 | 3 | 5;
    /** Require WebAuthn biometric to unlock the chat view */
    biometricLock: boolean;
    /** Show read receipts to the sender */
    showReadReceipts: boolean;
    /** Auto-destruct preset (off / 1m / 1h / 24h / 7d) */
    autoDestruct: 'off' | '1m' | '1h' | '24h' | '7d';

    // ── 9. Audio & Haptics ────────────────────────────────────────────────
    /** Sound theme pack */
    soundPack: 'minimal' | 'arcade' | 'ledger' | 'asmr';
    /** Mechanical keyboard typing sounds while composing */
    mechanicalKeyboard: boolean;
    /** Haptic intensity: 0 = off, 1 = light, 2 = medium, 3 = strong */
    hapticsIntensity: 0 | 1 | 2 | 3;
    /** Play notification sound when message arrives */
    notificationSound: boolean;

    // ── 10. DeFi & Ledger Tools ────────────────────────────────────────────
    /** Recognize $TICKER cashtags and render as price widgets */
    tickerWidgets: boolean;
    /** Scan 0x... addresses for contract verification / honeypot risk */
    contractScanner: boolean;
    /** Smart macros (e.g. /add sends wallet address + QR) */
    smartMacros: boolean;
    /** Show on-chain attestation score badge on messages */
    showAttestationBadge: boolean;

    // ── 11. AI Ghost Mode ─────────────────────────────────────────────────
    /** Tone translator: convert hostile messages to diplomatic before sending */
    toneTranslator: boolean;
    /** Ghost auto-reply: respond with a custom away message when unavailable */
    ghostAutoReply: boolean;
    /** The text the Ghost will reply with when away */
    ghostAutoReplyText: string;
}

export interface SettingsState extends SystemSettings {
    settings: SystemSettings | null;
    isSettingsOpen: boolean;
    isLoading: boolean;
    isUpdating: boolean;

    fetchSettings: () => Promise<void>;
    syncDOM: () => void;
    updateSetting: <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => Promise<void>;

    // Individual setters (backwards compat)
    setTheme: (theme: SettingsState['theme']) => void;
    setTimeFormat: (format: SettingsState['timeFormat']) => void;
    setDateFormat: (format: SettingsState['dateFormat']) => void;
    setAddressFormat: (format: SettingsState['addressFormat']) => void;
    setEmail: (email: string) => void;
    setChatName: (name: string) => void;
    setChatBio: (bio: string) => void;
    setCurrency: (currency: SettingsState['currency']) => void;
    setLayoutDensity: (density: SettingsState['density']) => void;
    setTestnetMode: (mode: boolean) => void;
    setAudioAlerts: (audio: boolean) => void;
    setStealthMode: (stealth: boolean) => void;
    setShowBalances: (show: boolean) => void;
    setAllowAnalytics: (allow: boolean) => void;
    setAutoDisconnectTimer: (timer: SettingsState['autoDisconnectTimer']) => void;
    setHardwareAcceleration: (val: boolean) => void;
    setHapticFeedback: (val: boolean) => void;
    setHiddenAssets: (val: string) => void;
    setSettingsOpen: (open: boolean) => void;
    clearAppData: () => void;
}

// ── DOM Class Applicator ──────────────────────────────────────────────────────

const applyDOMClasses = (state: Partial<SystemSettings>) => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;

    // Theme
    if (state.theme) {
        const resolvedDark =
            state.theme === 'dark' ||
            (state.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (resolvedDark) {
            html.classList.add('dark');
            html.setAttribute('data-theme', 'dark');
            html.style.backgroundColor = '#0A0A0A';
            html.style.color = '#F5F5F5';
        } else {
            html.classList.remove('dark');
            html.setAttribute('data-theme', 'light');
            html.style.backgroundColor = '#FFFFFF';
            html.style.color = '#1C1917';
        }
    }

    // UI Density
    if (state.density) {
        html.classList.remove('ui-relaxed', 'ui-compact', 'ui-dense');
        if (state.density === 'compact') html.classList.add('ui-compact');
        else if (state.density === 'dense') html.classList.add('ui-dense');
        else html.classList.add('ui-relaxed');
    }

    // Stealth Mode
    if (state.stealthMode !== undefined) {
        if (state.stealthMode) html.classList.add('stealth-active');
        else html.classList.remove('stealth-active');
    }

    // Balance visibility
    if (state.showBalances !== undefined) {
        if (!state.showBalances) html.classList.add('hide-balances');
        else html.classList.remove('hide-balances');
    }

    // Hardware acceleration
    if (state.hardwareAcceleration !== undefined) {
        if (!state.hardwareAcceleration) html.classList.add('no-hw-accel');
        else html.classList.remove('no-hw-accel');
    }

    // Chat font via CSS var
    if (state.chatFont) {
        const fontMap: Record<string, string> = {
            'inter':       '"Inter", sans-serif',
            'space-mono':  '"Space Mono", monospace',
            'fira-code':   '"Fira Code", monospace',
            'satoshi':     '"Satoshi", sans-serif',
        };
        html.style.setProperty('--ledger-chat-font', fontMap[state.chatFont] || '"Inter", sans-serif');
    }

    // Accent color via CSS var
    if (state.accentColor) {
        html.style.setProperty('--ledger-accent', state.accentColor);
    }
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            // ── Defaults: General ─────────────────────────────────────────
            theme: 'dark',
            density: 'compact',
            language: 'en',
            currency: 'USD',
            timeFormat: '24h',
            dateFormat: 'DD/MM/YYYY',
            addressFormat: 'truncated',

            // ── Defaults: Display ─────────────────────────────────────────
            defaultTimeframe: '1D',
            displayUnit: 'FIAT',
            showBalances: true,
            soundEffects: true,
            hapticFeedback: true,
            hardwareAcceleration: true,

            // ── Defaults: Network ─────────────────────────────────────────
            gasPreset: 'STANDARD',
            maxSlippage: 0.5,
            customRpcUrl: '',
            mevProtection: false,
            testnetMode: false,

            // ── Defaults: Alerts ──────────────────────────────────────────
            emailAlerts: false,
            telegramAlerts: false,
            audioAlerts: true,
            ledgerAlertThreshold: 1000000,
            email: '',

            // ── Defaults: Privacy ─────────────────────────────────────────
            inactivityLockMinutes: 15,
            autoDisconnectTimer: '1h',
            stealthMode: false,
            requireSignForExports: false,
            allowAnalytics: false,

            // ── Defaults: Chat Identity ───────────────────────────────────
            chatName: 'Ledger User',
            chatBio: '',
            qrLabel: 'Scan My Wallet',
            hiddenAssets: '[]',

            // ── Defaults: Quantum UX Aesthetics ──────────────────────────
            chatBackground: 'default',
            chatBackgroundCustomUrl: '',
            bubbleStyle: 'default',
            accentColor: '#6366f1',
            chatFont: 'inter',
            textSize: 4,
            nftBorderEnabled: false,
            nftBorderColor: 'ethereum',

            // ── Defaults: Security & Sovereignty ─────────────────────────
            burnOnRead: false,
            burnOnReadSeconds: 10,
            watermarkEnabled: false,
            onionHops: 3,
            biometricLock: false,
            showReadReceipts: true,
            autoDestruct: 'off',

            // ── Defaults: Audio & Haptics ─────────────────────────────────
            soundPack: 'minimal',
            mechanicalKeyboard: false,
            hapticsIntensity: 1,
            notificationSound: true,

            // ── Defaults: DeFi Tools ──────────────────────────────────────
            tickerWidgets: true,
            contractScanner: true,
            smartMacros: true,
            showAttestationBadge: true,

            // ── Defaults: AI Ghost Mode ───────────────────────────────────
            toneTranslator: false,
            ghostAutoReply: false,
            ghostAutoReplyText: 'The Ledger is away right now. Your message has been received.',

            // ── State ─────────────────────────────────────────────────────
            settings: null,
            isSettingsOpen: false,
            isLoading: false,
            isUpdating: false,

            // ── Actions ───────────────────────────────────────────────────

            syncDOM: () => { applyDOMClasses(get()); },

            fetchSettings: async () => {
                get().syncDOM();
                try {
                    set({ isLoading: true });
                    const res = await fetch('/api/user/settings');
                    if (res.ok) {
                        const data = await res.json();
                        set({ ...data, settings: data });
                        applyDOMClasses(data);
                    }
                } catch (e) {
                    console.error('Failed to fetch system settings', e);
                } finally {
                    set({ isLoading: false });
                }
            },

            updateSetting: async (key, value) => {
                set({ [key]: value, isUpdating: true } as any);
                applyDOMClasses({ [key]: value });
                try {
                    await fetch('/api/user/settings', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ [key]: value }),
                    });
                } catch (e) {
                    console.error('Failed to sync setting to DB', e);
                } finally {
                    set({ isUpdating: false });
                }
            },

            // Convenience setters (backwards compat)
            setTheme: (val) => get().updateSetting('theme', val),
            setTimeFormat: (val) => get().updateSetting('timeFormat', val),
            setDateFormat: (val) => get().updateSetting('dateFormat', val),
            setAddressFormat: (val) => get().updateSetting('addressFormat', val),
            setEmail: (val) => get().updateSetting('email', val),
            setChatName: (val) => get().updateSetting('chatName', val),
            setChatBio: (val) => get().updateSetting('chatBio', val),
            setCurrency: (val) => get().updateSetting('currency', val),
            setLayoutDensity: (val) => get().updateSetting('density', val),
            setTestnetMode: (val) => get().updateSetting('testnetMode', val),
            setAudioAlerts: (val) => get().updateSetting('audioAlerts', val),
            setStealthMode: (val) => get().updateSetting('stealthMode', val),
            setShowBalances: (val) => get().updateSetting('showBalances', val),
            setAllowAnalytics: (val) => get().updateSetting('allowAnalytics', val),
            setAutoDisconnectTimer: (val) => get().updateSetting('autoDisconnectTimer', val),
            setHardwareAcceleration: (val) => get().updateSetting('hardwareAcceleration', val),
            setHapticFeedback: (val) => get().updateSetting('hapticFeedback', val),
            setHiddenAssets: (val) => get().updateSetting('hiddenAssets', val),

            setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
            clearAppData: () => {
                if (typeof window !== 'undefined') {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.reload();
                }
            },
        }),
        {
            name: 'system-settings-store-v5',
            storage: createJSONStorage(() => safeStorage),
            partialize: (state) => ({
                // General
                theme: state.theme,
                density: state.density,
                language: state.language,
                currency: state.currency,
                timeFormat: state.timeFormat,
                dateFormat: state.dateFormat,
                addressFormat: state.addressFormat,
                // Display
                defaultTimeframe: state.defaultTimeframe,
                displayUnit: state.displayUnit,
                showBalances: state.showBalances,
                soundEffects: state.soundEffects,
                hapticFeedback: state.hapticFeedback,
                hardwareAcceleration: state.hardwareAcceleration,
                // Network
                gasPreset: state.gasPreset,
                maxSlippage: state.maxSlippage,
                customRpcUrl: state.customRpcUrl,
                mevProtection: state.mevProtection,
                testnetMode: state.testnetMode,
                // Alerts
                emailAlerts: state.emailAlerts,
                telegramAlerts: state.telegramAlerts,
                audioAlerts: state.audioAlerts,
                ledgerAlertThreshold: state.ledgerAlertThreshold,
                email: state.email,
                // Privacy
                inactivityLockMinutes: state.inactivityLockMinutes,
                autoDisconnectTimer: state.autoDisconnectTimer,
                stealthMode: state.stealthMode,
                requireSignForExports: state.requireSignForExports,
                allowAnalytics: state.allowAnalytics,
                // Identity
                chatName: state.chatName,
                chatBio: state.chatBio,
                qrLabel: state.qrLabel,
                hiddenAssets: state.hiddenAssets,
                // Quantum Aesthetics
                chatBackground: state.chatBackground,
                chatBackgroundCustomUrl: state.chatBackgroundCustomUrl,
                bubbleStyle: state.bubbleStyle,
                accentColor: state.accentColor,
                chatFont: state.chatFont,
                textSize: state.textSize,
                nftBorderEnabled: state.nftBorderEnabled,
                nftBorderColor: state.nftBorderColor,
                // Security & Sovereignty
                burnOnRead: state.burnOnRead,
                burnOnReadSeconds: state.burnOnReadSeconds,
                watermarkEnabled: state.watermarkEnabled,
                onionHops: state.onionHops,
                biometricLock: state.biometricLock,
                showReadReceipts: state.showReadReceipts,
                autoDestruct: state.autoDestruct,
                // Audio & Haptics
                soundPack: state.soundPack,
                mechanicalKeyboard: state.mechanicalKeyboard,
                hapticsIntensity: state.hapticsIntensity,
                notificationSound: state.notificationSound,
                // DeFi Tools
                tickerWidgets: state.tickerWidgets,
                contractScanner: state.contractScanner,
                smartMacros: state.smartMacros,
                showAttestationBadge: state.showAttestationBadge,
                // AI Ghost Mode
                toneTranslator: state.toneTranslator,
                ghostAutoReply: state.ghostAutoReply,
                ghostAutoReplyText: state.ghostAutoReplyText,
            }),
        }
    )
);


// [BACKEND SYNC] Subscribe to Zustand changes and sync to backend
if (typeof window !== 'undefined') {
  useSettingsStore.subscribe((state) => {
    // Debounce the sync to avoid API spam
    if ((window as any)._settingsSyncTimeout) clearTimeout((window as any)._settingsSyncTimeout);
    (window as any)._settingsSyncTimeout = setTimeout(() => {
      const address = localStorage.getItem('wagmi.store') ? JSON.parse(localStorage.getItem('wagmi.store')!).state.connections.value?.[0]?.[1]?.accounts?.[0] : null;
      if (!address) return;
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-verified-session-address': address },
        body: JSON.stringify(state)
      }).catch(e => console.error('[Zustand Sync] Failed:', e));
    }, 1000);
  });
}

