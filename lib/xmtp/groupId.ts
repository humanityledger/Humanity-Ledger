/**
 * Group ids we will store on CommunityChannel.xmtpGroupId.
 * The id comes from createSecureGroup (lib/xmtp/groups.ts). The server stores it and never the message.
 * XMTP conversation ids are opaque; this only rejects empty, huge, or non-token values.
 */
const GROUP_ID = /^[A-Za-z0-9._:-]{8,128}$/;

export function isPersistableXmtpGroupId(id: unknown): id is string {
  return typeof id === 'string' && GROUP_ID.test(id);
}
