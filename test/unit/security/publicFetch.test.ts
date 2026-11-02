import { vi } from 'vitest';
import { isBlockedIp } from '@/lib/security/ipPolicy';
import { validateUrlForFetch } from '@/lib/security/ssrfGuard';
import { assertFetchableUrl, fetchPublicUrl, publicOnlyLookup, PublicFetchError } from '@/lib/security/publicFetch';

describe('ipPolicy.isBlockedIp', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.0.1',
    '169.254.169.254', '169.254.170.2', '100.64.0.1', '100.100.100.200', '0.0.0.0',
    '224.0.0.1', '255.255.255.255', '198.18.0.1',
    '::', '::1', '::7f00:1', '::ffff:127.0.0.1', '::ffff:7f00:1', '64:ff9b::7f00:1',
    '2002:7f00:1::', 'fd00:ec2::254', 'fe80::1', 'ff02::1', '[::1]', 'fe80::1%eth0',
  ])('blocks %s', ip => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each(['93.184.215.14', '1.1.1.1', '8.8.8.8', '2606:4700:4700::1111', '2a00:1450:4001:80b::200e'])(
    'allows public %s',
    ip => expect(isBlockedIp(ip)).toBe(false),
  );

  it('treats non-IP input as blocked (fails closed)', () => {
    expect(isBlockedIp('example.com')).toBe(true);
    expect(isBlockedIp('')).toBe(true);
  });
});

describe('validateUrlForFetch — bypasses found on 2026-10-27', () => {
  it.each([
    'http://[::]/',
    'http://[::7f00:1]/',
    'http://localhost./',
    'http://metadata.google.internal./computeMetadata/v1/',
    'http://foo.localhost/',
    'http://[64:ff9b::a9fe:a9fe]/',
  ])('blocks %s', url => {
    expect(validateUrlForFetch(url).safe).toBe(false);
  });

  it('still allows ordinary public URLs', () => {
    expect(validateUrlForFetch('https://example.com/').safe).toBe(true);
    expect(validateUrlForFetch('https://example.com./').safe).toBe(true);
  });
});

describe('assertFetchableUrl', () => {
  it('refuses non-standard ports, credentials and private literals', () => {
    expect(() => assertFetchableUrl('http://example.com:8080/')).toThrow(PublicFetchError);
    expect(() => assertFetchableUrl('http://example.com:22/')).toThrow(PublicFetchError);
    expect(() => assertFetchableUrl('http://user:pw@example.com/')).toThrow(PublicFetchError);
    expect(() => assertFetchableUrl('http://[::]/')).toThrow(PublicFetchError);
  });

  it('accepts default ports', () => {
    expect(assertFetchableUrl('https://example.com/a').href).toBe('https://example.com/a');
    expect(assertFetchableUrl('http://example.com:80/').hostname).toBe('example.com');
  });
});

describe('publicOnlyLookup (runs inside the socket, so DNS rebinding is covered)', () => {
  it('refuses a name that resolves to loopback', async () => {
    const err = await new Promise<any>(resolve => {
      publicOnlyLookup('localhost', {}, (e: any) => resolve(e));
    });
    expect(err?.code).toBe('SSRF_BLOCKED');
  });

  it('refuses in all-addresses mode too', async () => {
    const err = await new Promise<any>(resolve => {
      publicOnlyLookup('localhost', { all: true }, (e: any) => resolve(e));
    });
    expect(err?.code).toBe('SSRF_BLOCKED');
  });
});

describe('fetchPublicUrl', () => {
  it('never reaches a server on loopback, whatever the port', async () => {
    await expect(fetchPublicUrl('http://127.0.0.1/')).rejects.toMatchObject({ code: 'BLOCKED' });
    await expect(fetchPublicUrl('http://127.0.0.1:3000/')).rejects.toMatchObject({ code: 'BLOCKED' });
    await expect(fetchPublicUrl('http://localhost/')).rejects.toMatchObject({ code: 'BLOCKED' });
  });

  it('refuses non-http schemes before any network', async () => {
    await expect(fetchPublicUrl('file:///etc/passwd')).rejects.toMatchObject({ code: 'BLOCKED' });
    await expect(fetchPublicUrl('gopher://example.com/')).rejects.toMatchObject({ code: 'BLOCKED' });
  });
});

describe('fetchPublicUrl POST (onion relay forwarding)', () => {
  it('refuses private targets for POST as well', async () => {
    await expect(fetchPublicUrl('http://127.0.0.1/', { method: 'POST', body: '{}' })).rejects.toMatchObject({ code: 'BLOCKED' });
    await expect(fetchPublicUrl('http://[::]/relay', { method: 'POST', body: '{}' })).rejects.toMatchObject({ code: 'BLOCKED' });
    await expect(fetchPublicUrl('http://localhost./relay', { method: 'POST', body: '{}' })).rejects.toMatchObject({ code: 'BLOCKED' });
  });
});
