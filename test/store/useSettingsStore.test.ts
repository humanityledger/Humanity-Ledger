import { vi } from 'vitest';
import { useSettingsStore } from '../../lib/store/useSettingsStore';

// Mock safeStorage to simulate cross-platform persistence behavior
vi.mock('../../lib/security/safe-storage', () => {
  let mockStorage: Record<string, string> = {};
  return {
    safeStorage: {
      getItem: vi.fn((key) => mockStorage[key] || null),
      setItem: vi.fn((key, value) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
    }
  };
});

// Mock fetch for updateSetting API call
global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })) as any;

describe('useSettingsStore (Quantum UX Multiplatform Settings Sync)', () => {
  beforeEach(() => {
    // Reset Zustand store state before each test
    const initialState = useSettingsStore.getState();
    useSettingsStore.setState(initialState, true);
    vi.clearAllMocks();
  });

  it('should initialize with default Quantum values across instances', () => {
    const state = useSettingsStore.getState();
    expect(state.chatBackground).toBe('default');
    expect(state.bubbleStyle).toBe('default');
    expect(state.accentColor).toBe('#6366f1');
    expect(state.burnOnRead).toBe(false);
    expect(state.ghostAutoReply).toBe(false);
  });

  it('should successfully update Aesthetics settings', () => {
    // Update theme and styles
    useSettingsStore.getState().updateSetting('chatBackground', 'matrix');
    useSettingsStore.getState().updateSetting('bubbleStyle', 'cyberpunk');
    useSettingsStore.getState().updateSetting('accentColor', '#FF0055');
    useSettingsStore.getState().updateSetting('chatFont', 'geist-mono');

    const state = useSettingsStore.getState();
    expect(state.chatBackground).toBe('matrix');
    expect(state.bubbleStyle).toBe('cyberpunk');
    expect(state.accentColor).toBe('#FF0055');
    expect(state.chatFont).toBe('geist-mono');
  });

  it('should perfectly handle Security configuration for Multiplatform', () => {
    // Simulating user turning on extreme privacy mode
    useSettingsStore.getState().updateSetting('burnOnRead', true);
    useSettingsStore.getState().updateSetting('burnTimer', 10);
    useSettingsStore.getState().updateSetting('routingHops', 5);
    useSettingsStore.getState().updateSetting('watermarking', true);
    useSettingsStore.getState().updateSetting('stealthMode', true);

    const state = useSettingsStore.getState();
    expect(state.burnOnRead).toBe(true);
    expect(state.burnTimer).toBe(10);
    expect(state.routingHops).toBe(5);
    expect(state.watermarking).toBe(true);
    expect(state.stealthMode).toBe(true);
  });

  it('should configure DeFi/Trading scanners flawlessly', () => {
    useSettingsStore.getState().updateSetting('recognizeTickers', true);
    useSettingsStore.getState().updateSetting('contractScanner', true);
    useSettingsStore.getState().updateSetting('ledgerAlertThreshold', 50000);

    const state = useSettingsStore.getState();
    expect(state.recognizeTickers).toBe(true);
    expect(state.contractScanner).toBe(true);
    expect(state.ledgerAlertThreshold).toBe(50000);
  });
});
