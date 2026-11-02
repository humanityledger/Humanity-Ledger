import { vi } from 'vitest';
import { parseScanPayload } from '@/lib/scan/parseScanPayload';

describe('parseScanPayload', () => {
  it('classifies session URL with uuid and pub', () => {
    const r = parseScanPayload(
      'https://www.humanidfi.com/connect?uuid=abc-123&pub=testpub&ecdh=1'
    );
    expect(r.type).toBe('session');
  });

  it('classifies legacy JSON session', () => {
    const r = parseScanPayload(
      JSON.stringify({ uuid: 'u1', ephemeralPub: 'pk', isECDH: false })
    );
    expect(r.type).toBe('session');
  });

  it('prefers session over wallet when URL contains both uuid/pub and an address', () => {
    const r = parseScanPayload(
      'https://example.com/connect?uuid=u&pub=p&address=0x1111111111111111111111111111111111111111'
    );
    expect(r.type).toBe('session');
  });

  it('classifies bare ethereum address', () => {
    const r = parseScanPayload('0x2222222222222222222222222222222222222222');
    expect(r.type).toBe('wallet');
    expect(r.walletAddress?.toLowerCase()).toBe('0x2222222222222222222222222222222222222222');
  });

  it('classifies ethereum: URI', () => {
    const r = parseScanPayload('ethereum:0x3333333333333333333333333333333333333333');
    expect(r.type).toBe('wallet');
  });

  it('classifies address query param', () => {
    const r = parseScanPayload('https://pay.example.com/?address=0x4444444444444444444444444444444444444444');
    expect(r.type).toBe('wallet');
  });

  it('classifies humanidfi passport URL', () => {
    const r = parseScanPayload('https://www.humanidfi.com/passport/my-test-slug-12');
    expect(r.type).toBe('passport');
    expect(r.slug).toBe('my-test-slug-12');
  });

  it('classifies passport query param', () => {
    const r = parseScanPayload('https://example.com/?passport=sluggy-99');
    expect(r.type).toBe('passport');
    expect(r.slug).toBe('sluggy-99');
  });

  it('classifies GS1 path /01/GTIN', () => {
    const r = parseScanPayload('https://example.com/01/00812345678901');
    expect(r.type).toBe('gs1');
    expect(r.gtin).toBe('00812345678901');
  });

  it('classifies id.gs1.org style host', () => {
    const r = parseScanPayload('https://id.gs1.org/01/9504000059430');
    expect(r.type).toBe('gs1');
    expect(r.gtin).toBe('9504000059430');
  });

  it('returns unknown for random text', () => {
    expect(parseScanPayload('hello world').type).toBe('unknown');
  });
});
