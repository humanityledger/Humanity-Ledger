// lib/wallet/callHistory.ts
// Sovereign Local Call History - 100% Client Side, Zero-Knowledge

export interface CallRecord {
  id: string;
  peerAddress: string;
  type: 'audio' | 'video';
  direction: 'incoming' | 'outgoing';
  status: 'answered' | 'missed' | 'declined';
  durationSeconds: number;
  timestamp: number;
}

const getStorageKey = (walletAddress: string) => `ledger_calls_${walletAddress.toLowerCase()}`;

export const getCallHistory = (walletAddress: string): CallRecord[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(walletAddress));
    if (!raw) return [];
    return JSON.parse(raw) as CallRecord[];
  } catch (e) {
    console.error("Failed to parse local call history", e);
    return [];
  }
};

export const saveCallRecord = (walletAddress: string, call: Omit<CallRecord, 'id' | 'timestamp'>): CallRecord => {
  const history = getCallHistory(walletAddress);
  const now = Date.now();

  // Deduplication guard: prevent identical duplicate records from rapid signaling or stream re-runs
  const recentDuplicate = history.find(c =>
    c.peerAddress.toLowerCase() === call.peerAddress.toLowerCase() &&
    c.status === call.status &&
    c.direction === call.direction &&
    Math.abs(now - c.timestamp) < 5000
  );
  if (recentDuplicate) {
    return recentDuplicate;
  }

  const newCall: CallRecord = {
    ...call,
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `call-${now}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
  };

  // Prepend to keep newest first
  history.unshift(newCall);

  // Keep only last 1000 calls
  if (history.length > 1000) history.pop();

  localStorage.setItem(getStorageKey(walletAddress), JSON.stringify(history));
  
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ledger_calls_updated', { detail: { walletAddress, history } }));
  }
  
  return newCall;
};

export const clearCallHistory = (walletAddress: string): void => {
  localStorage.removeItem(getStorageKey(walletAddress));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ledger_calls_updated', { detail: { walletAddress, history: [] } }));
  }
};
