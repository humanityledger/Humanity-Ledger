import { vi } from 'vitest';
import { validateUrlForFetch } from '@/lib/security/ssrfGuard';

describe('validateUrlForFetch (B-031 SSRF Guard)', () => {
  it('allows valid public HTTPS and HTTP URLs', () => {
    expect(validateUrlForFetch('https://example.com/avatar.png').safe).toBe(true);
    expect(validateUrlForFetch('https://api.github.com/users/octocat').safe).toBe(true);
    expect(validateUrlForFetch('http://example.org/feed.xml').safe).toBe(true);
  });

  it('blocks cloud metadata IP 169.254.169.254', () => {
    const res = validateUrlForFetch('http://169.254.169.254/latest/meta-data/');
    expect(res.safe).toBe(false);
    expect(res.reason).toMatch(/metadata/i);
  });

  it('blocks private IPv4 RFC1918 ranges (10.x, 172.16.x, 192.168.x)', () => {
    expect(validateUrlForFetch('http://10.0.0.1/admin').safe).toBe(false);
    expect(validateUrlForFetch('http://172.16.0.1/status').safe).toBe(false);
    expect(validateUrlForFetch('http://192.168.1.1/').safe).toBe(false);
  });

  it('blocks loopback / localhost', () => {
    expect(validateUrlForFetch('http://127.0.0.1:8080/secret').safe).toBe(false);
    expect(validateUrlForFetch('http://localhost:3000/api').safe).toBe(false);
  });

  it('blocks non-HTTP protocols (file://, ftp://, gopher://)', () => {
    expect(validateUrlForFetch('file:///etc/passwd').safe).toBe(false);
    expect(validateUrlForFetch('ftp://anonymous@ftp.example.com').safe).toBe(false);
  });
});
