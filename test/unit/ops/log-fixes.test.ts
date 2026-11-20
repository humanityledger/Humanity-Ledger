/** Three production log issues of 20/11/2026: P1002 lock timeouts, CSP media-src data:, XMTP intent waits. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { dataUrlToBlob } from '@/lib/chat/media-url';
import { isSyncWaitError } from '@/lib/xmtp/syncErrors';

const require = createRequire(import.meta.url);
const { isLockTimeout, lockRetryDelay } = require('../../../lib/db/migrate-lock.js');
const read = (f: string) => fs.readFileSync(f, 'utf8');

describe('P1002 advisory lock timeouts', () => {
  it('a P1002 is recognised and retried with bounded backoff', () => {
    expect(isLockTimeout('Error: P1002\nThe database server was reached but timed out. Timed out trying to acquire a postgres advisory lock')).toBe(true);
    expect(isLockTimeout('P3009 migrate found failed migrations')).toBe(false);
    expect(lockRetryDelay(1, 120_000)).toBe(5000);
    expect(lockRetryDelay(3, 120_000)).toBe(15000);
    expect(lockRetryDelay(3, 12_000)).toBe(2000);
    expect(lockRetryDelay(1, 5_000)).toBe(0);
  });
  it('the pre-deploy keeps the output, retries a P1002 with no holder three times, and still never accepts data loss', () => {
    const s = read('scripts/railway-pre-deploy.js');
    expect(s).toMatch(/err\.output =/);
    expect(s).toMatch(/!holder && isLockTimeout\(deployErr && deployErr\.output\) && lockTimeouts < 3/);
    expect(s).not.toMatch(/--accept-data-loss['"`]/);
  });
});

describe('CSP media-src data: on /chat', () => {
  it('data: media become blob: URLs; the policy stays without data: for media', () => {
    const b = dataUrlToBlob('data:audio/webm;codecs=opus;base64,AAEC');
    expect(b?.type).toBe('audio/webm');
    expect(b?.size).toBe(3);
    expect(dataUrlToBlob('https://ledgerchat.org/x.mp3')).toBeNull();
    expect(read('middleware.ts')).toMatch(/media-src 'self' blob: mediastream:;/);
  });
  it('the voice-note player and inline videos use the blob URL', () => {
    expect(read('components/chat/CustomAudioPlayer.tsx')).toMatch(/const src = useMediaUrl\(rawSrc\)/);
    expect(read('components/chat/MessageBubble.tsx')).toMatch(/<InlineVideo src=\{attachment\.url\}/);
  });
});

describe('XMTP "Sync failed to wait for intent" and publish_gave_up', () => {
  it('the newer wording is recognised as a sync wait, not a failure', () => {
    expect(isSyncWaitError(new Error('Sync failed to wait for intent'))).toBe(true);
    expect(isSyncWaitError(new Error('group not found'))).toBe(false);
  });
  it('a retry after an intent wait syncs first; giving up is shown with Retry and retried on reconnect', () => {
    const c = read('lib/xmtp/client.ts');
    expect(c).toMatch(/if \(isSyncWaitError\(err\)\) await runSerial\(cacheKey, \(\) => withTimeout\(entry\.dm\.sync\(\)/);
    expect(c).toMatch(/undelivered\.set\(cacheKey, dm\);/);
    expect(c).toMatch(/action: \{ label: 'Retry'/);
    expect(c).toMatch(/if \(undelivered\.size\) await retryUndelivered\(\);/);
  });
});
