import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppTheme = 'dark' | 'light' | 'system';
export type AppLanguage = 'en' | 'es';
export type PrivacyLevel = 'strict' | 'standard';

interface PersistedUIState {
  isStealthMode: boolean;
  activePanel: 'history' | 'notifications' | 'settings' | 'privacy' | null;
  theme: AppTheme;
  language: AppLanguage;
  soundsEnabled: boolean;
  ghostMode: boolean;
  privacyLevel: PrivacyLevel;
}

interface UIState extends PersistedUIState {
  isConnectModalOpen: boolean;
  isLinked: boolean;
  isZkVerified: boolean;
  toggleStealthMode: () => void;
  setStealthMode: (value: boolean) => void;
  openConnectModal: () => void;
  closeConnectModal: () => void;
  setLinked: (value: boolean) => void;
  setZkVerified: (value: boolean) => void;
  setActivePanel: (panel: 'history' | 'notifications' | 'settings' | 'privacy' | null) => void;
  setTheme: (theme: AppTheme) => void;
  setLanguage: (lang: AppLanguage) => void;
  setSoundsEnabled: (enabled: boolean) => void;
  setGhostMode: (enabled: boolean) => void;
  setPrivacyLevel: (level: PrivacyLevel) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      //  Persisted preferences 
      isStealthMode: false,
      activePanel: null,
      theme: 'system',
      language: 'en',
      soundsEnabled: true,
      ghostMode: false,
      privacyLevel: 'standard',

      //  Runtime-only state (never persisted) 
      isConnectModalOpen: false,
      isLinked: false,
      isZkVerified: false,

      //  Actions 
      toggleStealthMode: () => set((state) => ({ isStealthMode: !state.isStealthMode })),
      setStealthMode: (value: boolean) => set({ isStealthMode: value }),
      openConnectModal: () => set({ isConnectModalOpen: true }),
      closeConnectModal: () => set({ isConnectModalOpen: false }),
      setLinked: (value: boolean) => set({ isLinked: value }),
      setZkVerified: (value: boolean) => set({ isZkVerified: value }),
      setActivePanel: (panel) => set({ activePanel: panel }),
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setSoundsEnabled: (soundsEnabled) => set({ soundsEnabled }),
      setGhostMode: (ghostMode) => set({ ghostMode }),
      setPrivacyLevel: (privacyLevel) => set({ privacyLevel }),
    }),
    {
      name: 'ledger-ui-storage',
      partialize: (state): PersistedUIState => ({
        isStealthMode: state.isStealthMode,
        activePanel: state.activePanel,
        theme: state.theme,
        language: state.language,
        soundsEnabled: state.soundsEnabled,
        ghostMode: state.ghostMode,
        privacyLevel: state.privacyLevel,
      }),
    }
  )
);
