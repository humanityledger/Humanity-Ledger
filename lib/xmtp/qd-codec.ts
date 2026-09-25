import { ContentTypeId } from '@xmtp/browser-sdk';
export const ContentTypeQD = new ContentTypeId('humanityledger.com', 'qd-transfer', 1, 0);

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
  shouldPush(content: any) { return true; }
}


