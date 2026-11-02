import { create } from 'zustand';

export type DynamicIslandState = 'idle' | 'calling' | 'recording' | 'syncing' | 'notification' | 'wallet_connected' | 'tx_processing' | 'tx_success';

export interface DynamicIslandPayload {
  title?: string;
  subtitle?: string;
  icon?: string;
  progress?: number;
  waveform?: number[];
  color?: string;
}

interface DynamicIslandStore {
  activeState: DynamicIslandState;
  payload: DynamicIslandPayload | undefined;
  expanded: boolean;
  _gen: number;
  
  // Actions
  setState: (state: DynamicIslandState, payload?: DynamicIslandPayload, autoDismiss?: number) => void;
  setExpanded: (expanded: boolean) => void;
  dismiss: () => void;
}

export const useDynamicIsland = create<DynamicIslandStore>((set, get) => ({
  activeState: 'idle',
  payload: undefined,
  expanded: false,
  _gen: 0,

  setState: (state, payload, autoDismiss) => {
    const gen = get()._gen + 1;
    set({ activeState: state, payload, expanded: true, _gen: gen });
    if (autoDismiss) {
      setTimeout(() => {
        if (get()._gen === gen) {
          set({ expanded: false });
          setTimeout(() => { if (get()._gen === gen) set({ activeState: 'idle', payload: undefined }); }, 500);
        }
      }, autoDismiss);
    }
  },

  setExpanded: (expanded) => set({ expanded }),

  dismiss: () => {
    const gen = get()._gen + 1;
    set({ expanded: false, _gen: gen });
    setTimeout(() => { if (get()._gen === gen) set({ activeState: 'idle', payload: undefined }); }, 500);
  },
}));