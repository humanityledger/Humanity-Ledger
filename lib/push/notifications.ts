// lib/push/notifications.ts
export interface SilentPushPayload {
  notification: {
    title: 'Humanity Ledger';
    body: 'New encrypted message received';
  };
  data: {
    type: 'NEW_ENCRYPTED_MESSAGE';
    timestamp: number;
    // NO message content, sender address or personal data
  };
}
