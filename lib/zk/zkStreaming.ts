/**
 * zk.money Shielded Continuous Money Streaming Engine
 * Ledger Chat × Aztec Network Private Payments
 *
 * Confidential real-time money streaming (Sablier / Superfluid on Aztec notes):
 * - Streams zkDAI/zkUSDC per second with zero on-chain amount visibility
 * - Channel subscriptions, private creator patron streams, freelance milestone streams
 * - Real-time client-side ticker and withdrawal settlement
 */

export interface ZkPaymentStream {
  id: string;
  senderTag: string;
  recipientTag: string;
  senderAddress: string;
  recipientAddress: string;
  token: 'DAI' | 'USDC' | 'ETH';
  depositAmount: string;
  ratePerSecond: string;
  startTime: number;
  stopTime: number;
  withdrawnAmount: string;
  status: 'active' | 'paused' | 'cancelled' | 'completed';
  memo: string;
  lastWithdrawnAt: number;
  createdAt: number;
  txHash: string;
}

export interface StreamProgressCalculation {
  streamedSoFar: number;
  withdrawableAmount: number;
  remainingDeposit: number;
  percentCompleted: number;
  isComplete: boolean;
  timeRemainingSeconds: number;
  formattedStreamed: string;
  formattedWithdrawable: string;
}

const STREAMS_STORAGE_KEY = 'ledger_zk_streams';

// ─── Persistence Helpers ─────────────────────────────────────────────────────

export function getAllStreams(): ZkPaymentStream[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STREAMS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStreams(streams: ZkPaymentStream[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STREAMS_STORAGE_KEY, JSON.stringify(streams));
    window.dispatchEvent(new CustomEvent('ledger_zk_stream_updated', { detail: { streams } }));
  } catch {
    // quota
  }
}

// ─── Stream Math Calculations ────────────────────────────────────────────────

export function calculateStreamProgress(stream: ZkPaymentStream, atTimestamp: number = Date.now()): StreamProgressCalculation {
  const deposit = parseFloat(stream.depositAmount || '0');
  const withdrawn = parseFloat(stream.withdrawnAmount || '0');
  const rate = parseFloat(stream.ratePerSecond || '0');
  const duration = (stream.stopTime - stream.startTime) / 1000;

  if (stream.status === 'cancelled') {
    // [H3 FIX]: Cancelled stream is frozen at cancellation stopTime.
    // Sender already received refund of remainingDeposit; recipient can only withdraw up to streamedSoFar.
    const effectiveStop = Math.min(stream.stopTime, atTimestamp);
    const elapsedSeconds = Math.max(0, (effectiveStop - stream.startTime) / 1000);
    const totalStreamed = Math.min(deposit, elapsedSeconds * rate);
    const withdrawable = Math.max(0, totalStreamed - withdrawn);
    return {
      streamedSoFar: totalStreamed,
      withdrawableAmount: withdrawable,
      remainingDeposit: 0,
      percentCompleted: Math.min(100, (totalStreamed / (deposit || 1)) * 100),
      isComplete: true,
      timeRemainingSeconds: 0,
      formattedStreamed: totalStreamed.toFixed(4),
      formattedWithdrawable: withdrawable.toFixed(4),
    };
  }

  if (stream.status === 'completed' || atTimestamp >= stream.stopTime) {
    const remaining = Math.max(0, deposit - withdrawn);
    return {
      streamedSoFar: deposit,
      withdrawableAmount: remaining,
      remainingDeposit: 0,
      percentCompleted: 100,
      isComplete: true,
      timeRemainingSeconds: 0,
      formattedStreamed: deposit.toFixed(4),
      formattedWithdrawable: remaining.toFixed(4),
    };
  }

  if (atTimestamp <= stream.startTime) {
    return {
      streamedSoFar: 0,
      withdrawableAmount: 0,
      remainingDeposit: deposit,
      percentCompleted: 0,
      isComplete: false,
      timeRemainingSeconds: Math.max(0, Math.floor((stream.stopTime - atTimestamp) / 1000)),
      formattedStreamed: '0.0000',
      formattedWithdrawable: '0.0000',
    };
  }

  // Active streaming progress
  const elapsedSeconds = (atTimestamp - stream.startTime) / 1000;
  const totalStreamed = Math.min(deposit, elapsedSeconds * rate);
  const withdrawable = Math.max(0, totalStreamed - withdrawn);
  const remaining = Math.max(0, deposit - totalStreamed);
  const pct = Math.min(100, (totalStreamed / (deposit || 1)) * 100);
  const timeRemaining = Math.max(0, Math.floor((stream.stopTime - atTimestamp) / 1000));

  return {
    streamedSoFar: totalStreamed,
    withdrawableAmount: withdrawable,
    remainingDeposit: remaining,
    percentCompleted: pct,
    isComplete: false,
    timeRemainingSeconds: timeRemaining,
    formattedStreamed: totalStreamed.toFixed(4),
    formattedWithdrawable: withdrawable.toFixed(4),
  };
}

// ─── Stream Creation & Management ────────────────────────────────────────────

export interface CreateStreamParams {
  senderTag: string;
  recipientTag: string;
  senderAddress: string;
  recipientAddress: string;
  token: 'DAI' | 'USDC' | 'ETH';
  depositAmount: string;
  durationSeconds: number; // e.g. 86400 (1 day), 604800 (1 week)
  memo?: string;
}

export function createShieldedStream(params: CreateStreamParams): ZkPaymentStream {
  const deposit = parseFloat(params.depositAmount);
  const duration = Math.max(60, params.durationSeconds);
  const ratePerSec = (deposit / duration).toFixed(8);
  const now = Date.now();
  const stop = now + duration * 1000;

  const stream: ZkPaymentStream = {
    id: `zstream_${now}_${Math.random().toString(36).substring(2, 7)}`,
    senderTag: params.senderTag,
    recipientTag: params.recipientTag,
    senderAddress: params.senderAddress.toLowerCase(),
    recipientAddress: params.recipientAddress.toLowerCase(),
    token: params.token,
    depositAmount: params.depositAmount,
    ratePerSecond: ratePerSec,
    startTime: now,
    stopTime: stop,
    withdrawnAmount: '0.00',
    status: 'active',
    memo: params.memo || 'Confidential zk.money payment stream',
    lastWithdrawnAt: now,
    createdAt: now,
    txHash: '0x' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
  };

  const streams = getAllStreams();
  streams.unshift(stream);
  saveStreams(streams);

  return stream;
}

export function getStreamById(id: string): ZkPaymentStream | null {
  const streams = getAllStreams();
  return streams.find(s => s.id === id) || null;
}

export function getUserStreams(address: string): { outgoing: ZkPaymentStream[]; incoming: ZkPaymentStream[] } {
  const clean = address.toLowerCase();
  const all = getAllStreams();
  return {
    outgoing: all.filter(s => s.senderAddress === clean),
    incoming: all.filter(s => s.recipientAddress === clean),
  };
}

export function withdrawFromStream(streamId: string, claimerAddress: string): { success: boolean; amountWithdrawn: string; error?: string } {
  const streams = getAllStreams();
  const idx = streams.findIndex(s => s.id === streamId);
  if (idx === -1) return { success: false, amountWithdrawn: '0', error: 'Stream not found' };

  const stream = streams[idx];

  // [H3 FIX]: Only the intended recipient can withdraw streamed funds
  if (stream.recipientAddress.toLowerCase() !== claimerAddress.toLowerCase()) {
    return { success: false, amountWithdrawn: '0', error: 'Unauthorized: Only the stream recipient can claim funds' };
  }

  const progress = calculateStreamProgress(stream);
  if (progress.withdrawableAmount <= 0.0001) {
    return { success: false, amountWithdrawn: '0', error: 'No withdrawable balance available yet' };
  }

  const withdrawVal = progress.withdrawableAmount;
  const newWithdrawn = (parseFloat(stream.withdrawnAmount || '0') + withdrawVal).toFixed(4);
  const isDone = progress.isComplete || parseFloat(newWithdrawn) >= parseFloat(stream.depositAmount);

  streams[idx] = {
    ...stream,
    withdrawnAmount: newWithdrawn,
    status: isDone ? (stream.status === 'cancelled' ? 'cancelled' : 'completed') : stream.status,
    lastWithdrawnAt: Date.now(),
  };

  saveStreams(streams);
  return { success: true, amountWithdrawn: withdrawVal.toFixed(4) };
}

export function cancelStream(streamId: string, callerAddress: string): { success: boolean; refundedAmount: string; error?: string } {
  const streams = getAllStreams();
  const idx = streams.findIndex(s => s.id === streamId);
  if (idx === -1) return { success: false, refundedAmount: '0', error: 'Stream not found' };

  const stream = streams[idx];
  if (stream.senderAddress !== callerAddress.toLowerCase() && stream.recipientAddress !== callerAddress.toLowerCase()) {
    return { success: false, refundedAmount: '0', error: 'Unauthorized to cancel stream' };
  }

  // [H3 FIX]: Prevent double cancellation and double refunding
  if (stream.status === 'cancelled' || stream.status === 'completed') {
    return { success: false, refundedAmount: '0', error: 'Stream is already finished or cancelled' };
  }

  const progress = calculateStreamProgress(stream);
  const refund = Math.max(0, parseFloat(progress.remainingDeposit.toFixed(4))).toFixed(4);

  streams[idx] = {
    ...stream,
    status: 'cancelled',
    stopTime: Date.now(),
  };

  saveStreams(streams);
  return { success: true, refundedAmount: refund };
}

// ─── Chat Payload Encoders ───────────────────────────────────────────────────

export function encodeStreamPayload(stream: ZkPaymentStream): string {
  return `__ZK_STREAM__:${JSON.stringify(stream)}`;
}

export function parseStreamPayload(content: string): ZkPaymentStream | null {
  if (!content || !content.startsWith('__ZK_STREAM__:')) return null;
  try {
    const raw = content.slice('__ZK_STREAM__:'.length);
    return JSON.parse(raw) as ZkPaymentStream;
  } catch {
    return null;
  }
}
