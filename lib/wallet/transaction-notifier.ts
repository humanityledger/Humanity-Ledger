import { toast } from 'sonner';

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
export type TransactionSource = 'moonpay' | 'wallet' | 'swap' | 'bridge' | 'manual';

export interface TransactionNotification {
  hash?: string;
  amount: string;
  symbol: string;
  usdValue?: number;
  source: TransactionSource;
  type: 'incoming' | 'outgoing' | 'swap' | 'bridge';
  timestamp: number;
  chainId?: number;
}

/**
 * [LEGENDARY] Transaction Notifier Service
 * Centralised notification system for all transaction types
 */
class TransactionNotifierService {
  private history: TransactionNotification[] = [];
  private readonly MAX_HISTORY = 50;

  /**
   * Show a rich notification for an incoming transaction
   */
  notify(notification: TransactionNotification) {
    // Add to history
    this.history.unshift(notification);
    if (this.history.length > this.MAX_HISTORY) {
      this.history.pop();
    }

    // Save to localStorage
    this.saveHistory();

    // Determine toast message based on source and type
    const { amount, symbol, source, type, hash, usdValue } = notification;

    let title = ' Transaction Detected!';
    let description = `${amount} ${symbol}`;

    if (type === 'incoming') {
      if (source === 'moonpay') {
        title = ' MoonPay Purchase Complete!';
        description = `+${amount} ${symbol} added to your wallet`;
      } else if (source === 'wallet') {
        title = ' Funds Received!';
        description = `+${amount} ${symbol} incoming`;
      }
    } else if (type === 'swap') {
      title = ' Swap Confirmed!';
      description = `Swapped ${amount} ${symbol}`;
    } else if (type === 'bridge') {
      title = ' Bridge Complete!';
      description = `Bridged ${amount} ${symbol}`;
    }

    // Add USD value if available
    if (usdValue) {
      description += ` (~$${safeToFixed(usdValue, 2)})`;
    }

    // Show toast notification — SILENCED in chat context
    if (false) toast.success(title, {
      description,
      duration: 8000,
      action: hash ? {
        label: 'View',
        onClick: () => this.openExplorer(hash, notification.chainId)
      } : undefined
    });

    // Optional: Play sound effect (if user enables it)
    // this.playNotificationSound(); — silenced
  }

  /**
   * Open transaction in blockchain explorer
   */
  private openExplorer(hash: string, chainId?: number) {
    const explorers: Record<number, string> = {
      1: 'https://etherscan.io/tx/',
      137: 'https://polygonscan.com/tx/',
      8453: 'https://basescan.org/tx/',
      42161: 'https://arbiscan.io/tx/',
      10: 'https://optimistic.etherscan.io/tx/',
      480: 'https://worldscan.org/tx/'
    };

    const baseUrl = chainId ? explorers[chainId] || explorers[1] : explorers[1];
    window.open(baseUrl + hash, '_blank');
  }

  /**
   * Play notification sound (optional, can be disabled by user)
   */
  private playNotificationSound() {
    const enabled = localStorage.getItem('notificationSoundEnabled') !== 'false';
    if (!enabled) return;

    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Autoplay blocked, ignore
      });
    } catch (e) {
      // Sound file not found or other error, ignore
    }
  }

  /**
   * Get transaction history
   */
  getHistory(): TransactionNotification[] {
    return this.history;
  }

  /**
   * Save history to localStorage
   */
  private saveHistory() {
    try {
      localStorage.setItem('tx-notification-history', JSON.stringify(this.history));
    } catch (e) {
      // Storage quota exceeded, ignore
    }
  }

  /**
   * Load history from localStorage
   */
  loadHistory() {
    try {
      const stored = localStorage.getItem('tx-notification-history');
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch (e) {
      // Invalid JSON or other error, ignore
    }
  }

  /**
   * Clear all notification history
   */
  clearHistory() {
    this.history = [];
    localStorage.removeItem('tx-notification-history');
  }
}

// Export singleton instance
export const transactionNotifier = new TransactionNotifierService();

// Load history on initialization
if (typeof window !== 'undefined') {
  transactionNotifier.loadHistory();
}

