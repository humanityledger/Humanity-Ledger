
export class QDCodec {
  get contentType() { return { authorityId: 'humanityledger.com', typeId: 'qd-transfer', versionMajor: 1, versionMinor: 0 }; }
  encode(content: any) {
    return {
      type: this.contentType,
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


