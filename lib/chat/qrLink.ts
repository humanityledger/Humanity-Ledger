// lib/chat/qrLink.ts
// Device pairing via ephemeral ECDH exchange without server seed persistence
export interface PairingPayload {
  publicKey: string;
  ephemeralSessionId: string;
  fingerprint: string;
}
