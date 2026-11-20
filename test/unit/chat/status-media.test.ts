/** Status: photo and short video as our own encrypted attachments; audience controls; no leak. */
import fs from 'node:fs';
import { audienceAllows, encodeStatusMedia, normalizeAudience, parseStatusMedia, statusKindOf } from '@/lib/chat/status-media';

const h = (c: string, n: number) => c.repeat(n);
const media = { path: `/api/chat/attachments/${h('a', 32)}`, mime: 'image/jpeg', contentDigest: h('b', 64), secret: h('c', 64), salt: h('d', 64), nonce: h('e', 24) };

describe('status media URL', () => {
  it('round-trips our attachment path with its key', () => {
    const url = encodeStatusMedia(media, 'https://ledgerchat.org');
    expect(parseStatusMedia(url)).toEqual(media);
    expect(statusKindOf({ ...media, mime: 'video/mp4' })).toBe('video');
  });
  it('refuses third-party paths, http, query strings, partial keys and other MIME types', () => {
    const ok = encodeStatusMedia(media, 'https://ledgerchat.org');
    expect(parseStatusMedia(ok.replace('/api/chat/attachments/', '/track/'))).toBeNull();
    expect(parseStatusMedia(ok.replace('https:', 'http:'))).toBeNull();
    expect(parseStatusMedia(ok.replace('#', '?x=1#'))).toBeNull();
    expect(parseStatusMedia(encodeStatusMedia({ ...media, nonce: 'zz' }, 'https://x.org'))).toBeNull();
    expect(parseStatusMedia(encodeStatusMedia({ ...media, mime: 'text/html' }, 'https://x.org'))).toBeNull();
    expect(parseStatusMedia('https://evil.example/pixel.gif')).toBeNull();
  });
});

describe('audience', () => {
  const a = '0x' + h('1', 40), b = '0x' + h('2', 40), c = '0x' + h('3', 40);
  it('normalizes to unique lowercase addresses and drops the rest', () => {
    expect(normalizeAudience([a.toUpperCase().replace('0X', '0x'), a, 'nope', 7, b])).toEqual([a, b]);
    expect(normalizeAudience('x')).toEqual([]);
  });
  it('empty = every contact; a list narrows it; the author always sees their own', () => {
    expect(audienceAllows(a, [], c)).toBe(true);
    expect(audienceAllows(a, [b], c)).toBe(false);
    expect(audienceAllows(a, [b], b)).toBe(true);
    expect(audienceAllows(a, [b], a)).toBe(true);
  });
});

describe('stories route', () => {
  const src = fs.readFileSync('app/api/chat/stories/route.ts', 'utf8');
  it('in-memory statuses are filtered by author like database ones', () => {
    expect(src).toMatch(/inMemoryStories\.filter\(s => new Date\(s\.expiresAt\) > now && authors\.has\(s\.authorAddress\)\)/);
  });
  it('media must parse as our attachment, and the audience list is never returned to viewers', () => {
    expect(src).toMatch(/parseStatusMedia\(content\)/);
    expect(src).toMatch(/const \{ audience: _hidden, \.\.\.rest \} = s;/);
    expect(src).toMatch(/MAX_ACTIVE = 30/);
  });
  it('the migration is additive', () => {
    const sql = fs.readFileSync('prisma/migrations/20261120120000_story_audience/migration.sql', 'utf8');
    expect(sql).toMatch(/ADD COLUMN "audience" TEXT\[\] NOT NULL DEFAULT ARRAY\[\]::TEXT\[\]/);
    expect(sql).not.toMatch(/DROP|ALTER COLUMN|RENAME/i);
  });
  it('the composer states the limits and uses no icon library', () => {
    const ui = fs.readFileSync('components/chat/LedgerUpdatesTab.tsx', 'utf8');
    expect(ui).toMatch(/not end-to-end encrypted/);
    expect(ui).not.toMatch(/lucide-react/);
  });
});
