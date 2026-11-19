import { describe, expect, it } from 'vitest';
import { isPhoneRequest } from '@/lib/landing/device';

const req = (ua: string, extra: Record<string, string> = {}) => new Headers({ 'user-agent': ua, ...extra });
const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  ipadDesktopMode: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  androidTablet: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

describe('isPhoneRequest: which landing tree a request gets', () => {
  it('phones get the mobile tree', () => {
    expect(isPhoneRequest(req(UA.iphone))).toBe(true);
    expect(isPhoneRequest(req(UA.android))).toBe(true);
  });
  it('tablets and iPads keep the desktop tree', () => {
    expect(isPhoneRequest(req(UA.ipad))).toBe(false);
    expect(isPhoneRequest(req(UA.ipadDesktopMode))).toBe(false);
    expect(isPhoneRequest(req(UA.androidTablet))).toBe(false);
  });
  it('desktops keep the desktop tree', () => {
    expect(isPhoneRequest(req(UA.desktop))).toBe(false);
    expect(isPhoneRequest(new Headers())).toBe(false);
  });
  it('the client hint Sec-CH-UA-Mobile: ?1 means a phone', () => {
    expect(isPhoneRequest(req(UA.desktop, { 'sec-ch-ua-mobile': '?1' }))).toBe(true);
    expect(isPhoneRequest(req(UA.android, { 'sec-ch-ua-mobile': '?0' }))).toBe(true);
  });
});
