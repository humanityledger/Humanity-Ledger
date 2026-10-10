'use client';

/**
 * CryptoTransferCodec — Content codec for native crypto transfer messages.
 * Replaces the legacy QD transfer codec.
 */
export class QDCodec {
  get contentType() { return { authorityId: 'humanityledger.com', typeId: 'qd-transfer', versionMajor: 1, versionMinor: 0, sameAs(id: any) { return this.authorityId === id.authorityId && this.typeId === id.typeId; } }; }
  encode(content: any) { return { type: this.contentType, parameters: {}, content: new TextEncoder().encode(JSON.stringify(content)), }; }
  decode(encodedContent: any) { return JSON.parse(new TextDecoder().decode(encodedContent.content)); }
  fallback(content: any) { return ''; }
  shouldPush(content: any) { return true; }
}
