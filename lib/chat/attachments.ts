// lib/chat/attachments.ts
export interface RemoteAttachmentHeader {
  url: string;
  secret: string; // 256-bit AES-GCM key in hex
  salt: string;
  nonce: string;
  contentDigest: string;
  contentLength: number;
  filename: string;
}
