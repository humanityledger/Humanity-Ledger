/**
 * zk.money Privacy Notification System
 * Real-time alerts for:
 * - Note settlements (Aztec block inclusion)
 * - Payment receipts
 * - Stream milestones
 * - Escrow state changes
 * - Privacy score drops
 * - Anonymity set updates
 */

export type ZkNotificationType =
  | 'payment_received'
  | 'payment_sent'
  | 'note_settled'
  | 'escrow_locked'
  | 'escrow_released'
  | 'escrow_disputed'
  | 'stream_started'
  | 'stream_milestone'
  | 'stream_completed'
  | 'invoice_sent'
  | 'invoice_paid'
  | 'privacy_score_drop'
  | 'anonymity_set_low'
  | 'note_pending'
  | 'treasury_deposit'
  | 'bounty_claimed'
  | 'tip_received';

export interface ZkNotification {
  id: string;
  type: ZkNotificationType;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  link?: string;
  metadata?: Record<string, any>;
}

const NOTIFICATIONS_KEY = 'ledger_zk_notifications';

// ─── Storage ─────────────────────────────────────────────────────────────────

export function getZkNotifications(): ZkNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveZkNotifications(notifications: ZkNotification[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    window.dispatchEvent(new CustomEvent('ledger_zk_notification', { detail: { notifications } }));
  } catch {}
}

export function markNotificationsRead(): void {
  const notifications = getZkNotifications();
  const updated = notifications.map(n => ({ ...n, read: true }));
  saveZkNotifications(updated);
}

export function getUnreadCount(): number {
  return getZkNotifications().filter(n => !n.read).length;
}

// ─── Notification Factory ────────────────────────────────────────────────────

export function pushZkNotification(
  type: ZkNotificationType,
  data: { title: string; body: string; link?: string; metadata?: Record<string, any> }
): ZkNotification {
  const notif: ZkNotification = {
    id: `zkn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type,
    title: data.title,
    body: data.body,
    timestamp: Date.now(),
    read: false,
    link: data.link,
    metadata: data.metadata,
  };

  const existing = getZkNotifications();
  existing.unshift(notif);
  // Keep max 100
  saveZkNotifications(existing.slice(0, 100));

  // Browser native notification if permitted
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(`🛡️ ${notif.title}`, { body: notif.body, icon: '/favicon.ico' });
  }

  return notif;
}

// ─── Pre-built Notification Helpers ─────────────────────────────────────────

export function notifyPaymentReceived(senderTag: string, amount: string, token: string, txHash: string): ZkNotification {
  return pushZkNotification('payment_received', {
    title: 'Shielded Payment Received',
    body: `${senderTag} sent you ${amount} zk${token} privately via Aztec Network`,
    link: `https://aztecscan.xyz/tx-effect/${txHash.slice(2)}`,
    metadata: { senderTag, amount, token, txHash },
  });
}

export function notifyPaymentSent(recipientTag: string, amount: string, token: string, txHash: string): ZkNotification {
  return pushZkNotification('payment_sent', {
    title: 'Private Payment Sent',
    body: `Your ${amount} zk${token} payment to ${recipientTag} has been submitted to the Aztec sequencer`,
    link: `https://aztecscan.xyz/tx-effect/${txHash.slice(2)}`,
    metadata: { recipientTag, amount, token, txHash },
  });
}

export function notifyNoteSettled(noteId: string, amount: string, token: string): ZkNotification {
  return pushZkNotification('note_settled', {
    title: 'Note Settled on Aztec',
    body: `Your ${amount} ${token} note has been included in a rollup block and is now spendable`,
    metadata: { noteId, amount, token },
  });
}

export function notifyEscrowLocked(escrowId: string, amount: string, token: string, recipientTag: string): ZkNotification {
  return pushZkNotification('escrow_locked', {
    title: 'Escrow Locked',
    body: `${amount} ${token} has been locked in escrow for ${recipientTag}. Milestones awaiting approval.`,
    metadata: { escrowId, amount, token, recipientTag },
  });
}

export function notifyEscrowReleased(escrowId: string, amount: string, token: string): ZkNotification {
  return pushZkNotification('escrow_released', {
    title: 'Escrow Released',
    body: `${amount} ${token} has been released from escrow and transferred to the recipient.`,
    metadata: { escrowId, amount, token },
  });
}

export function notifyStreamStarted(senderTag: string, amount: string, token: string, durationHours: number): ZkNotification {
  return pushZkNotification('stream_started', {
    title: 'Payment Stream Started',
    body: `${senderTag} is streaming ${amount} ${token} to you over ${durationHours}h`,
    metadata: { senderTag, amount, token, durationHours },
  });
}

export function notifyInvoicePaid(invoiceNumber: string, amount: string, token: string, txHash: string): ZkNotification {
  return pushZkNotification('invoice_paid', {
    title: `Invoice ${invoiceNumber} Paid`,
    body: `You received ${amount} zk${token} settlement for your invoice`,
    link: `https://aztecscan.xyz/tx-effect/${txHash.slice(2)}`,
    metadata: { invoiceNumber, amount, token, txHash },
  });
}

export function notifyPrivacyScoreDrop(newScore: number, riskLevel: string): ZkNotification {
  return pushZkNotification('privacy_score_drop', {
    title: 'Privacy Score Alert',
    body: `Your privacy score dropped to ${newScore}/100 (${riskLevel} risk). Consider waiting for larger anonymity set.`,
    metadata: { newScore, riskLevel },
  });
}

export function notifyTipReceived(senderTag: string, amount: string, token: string, message?: string): ZkNotification {
  return pushZkNotification('tip_received', {
    title: '🎉 Private Tip Received!',
    body: `${senderTag} tipped you ${amount} zk${token}${message ? ` — "${message}"` : ''}`,
    metadata: { senderTag, amount, token, message },
  });
}

export function notifyBountyClaimed(bountyTitle: string, reward: string, token: string): ZkNotification {
  return pushZkNotification('bounty_claimed', {
    title: 'Bounty Claimed',
    body: `Your bounty "${bountyTitle}" has been claimed. ${reward} ${token} payout pending.`,
    metadata: { bountyTitle, reward, token },
  });
}

// ─── Notification Type Metadata ──────────────────────────────────────────────

export function getNotificationIconAndColor(type: ZkNotificationType): { emoji: string; color: string } {
  const map: Record<ZkNotificationType, { emoji: string; color: string }> = {
    payment_received:     { emoji: '🔒', color: '#1C1C1E' },
    payment_sent:         { emoji: '📤', color: '#1C1C1E' },
    note_settled:         { emoji: '✓',  color: '#1C1C1E' },
    escrow_locked:        { emoji: '🔒', color: '#1C1C1E' },
    escrow_released:      { emoji: '🔓', color: '#1C1C1E' },
    escrow_disputed:      { emoji: '⚠️', color: '#1C1C1E' },
    stream_started:       { emoji: '🌊', color: '#1C1C1E' },
    stream_milestone:     { emoji: '🎯', color: '#1C1C1E' },
    stream_completed:     { emoji: '✓',  color: '#1C1C1E' },
    invoice_sent:         { emoji: '📄', color: '#1C1C1E' },
    invoice_paid:         { emoji: '✓',  color: '#1C1C1E' },
    privacy_score_drop:   { emoji: '⚠️', color: '#1C1C1E' },
    anonymity_set_low:    { emoji: '⚠️', color: '#1C1C1E' },
    note_pending:         { emoji: '⏳', color: '#1C1C1E' },
    treasury_deposit:     { emoji: '🏦', color: '#1C1C1E' },
    bounty_claimed:       { emoji: '🎯', color: '#1C1C1E' },
    tip_received:         { emoji: '✦',  color: '#1C1C1E' },
  };
  return map[type] || { emoji: '🔔', color: '#1C1C1E' };
}

// ─── Request Browser Notification Permission ──────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}
