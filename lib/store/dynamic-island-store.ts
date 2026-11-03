import { create } from 'zustand';

/**
 * The Dynamic Island shows live activity that is really happening: a call,
 * a voice recording, a sign-in or reconnect, a wallet operation, an incoming
 * message. Every state is set by the code that runs the activity; nothing
 * here invents progress, waveforms or network health.
 */
export type DynamicIslandState = 'idle' | 'calling' | 'recording' | 'syncing' | 'notification' | 'wallet_connected' | 'tx_processing' | 'tx_success';

export type CallPhase = 'calling' | 'ringing' | 'connecting' | 'active';

export interface DynamicIslandPayload {
  title?: string;
  subtitle?: string;
  /** Avatar for a notification. Only same-origin paths and data: images are drawn. */
  icon?: string;
  /** Calls: where the call is. The duration is shown only once it is 'active'. */
  phase?: CallPhase;
  /** Calls and recordings: when the timed part began (ms since epoch). */
  startedAt?: number;
  /** Notifications: what tapping "open" does (e.g. open that chat). */
  onOpen?: () => void;
  /** Kept for older callers; ignored by the island. */
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
    const prev = get();
    const gen = prev._gen + 1;
    // A call or recording that only changes phase keeps the user's choice of
    // expanded or collapsed; anything new opens expanded so it is seen.
    const samePersistent = prev.activeState === state && (state === 'calling' || state === 'recording');
    set({ activeState: state, payload, expanded: samePersistent ? prev.expanded : true, _gen: gen });
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
