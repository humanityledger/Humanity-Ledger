import { ContentTypeId } from '@xmtp/xmtp-js';
export const ContentTypeQD = new ContentTypeId({
  authorityId: 'humanityledger.com',
  typeId: 'qd-transfer',
  versionMajor: 1,
  versionMinor: 0,
});

export class QDCodec {
  get contentType() { return ContentTypeQD; }
  encode(content: any) {
    return {
      type: ContentTypeQD,
      parameters: {},
      content: new TextEncoder().encode(JSON.stringify(content)),
    };
  }
  decode(encodedContent: any) {
    return JSON.parse(new TextDecoder().decode(encodedContent.content));
  }
  fallback(content: any) { return 'Sent you QDs'; }
}

