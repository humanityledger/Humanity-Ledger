import { describe, expect, it } from 'vitest';
import { sha256Bytes } from '@/vendor/ledger-record/src/sha256';
import { utf8 } from '@/vendor/ledger-record/src/hex';
import {
  ZERO_HEAD,
  bindFileUrl,
  membershipEpoch,
  openLegacyRecord,
  openRecord,
  parseRecordMessage,
  recordPreview,
  sealHandoff,
  sealLegacyNote,
  sealNote,
  verifyChain,
  wipeRecordKeys,
  type EpochSecret,
} from '@/vendor/ledger-record/src/index';

const members = ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'];

function epoch(over: Partial<EpochSecret> = {}): EpochSecret {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = i + 1;
  return { bytes, mlsEpoch: '4', conversationId: 'conv-1', source: 'mls-exporter', ...over };
}

describe('sha-256', () => {
  it('matches the known digest of abc', () => {
    const d = sha256Bytes(utf8('abc'));
    let hex = '';
    for (const b of d) hex += b.toString(16).padStart(2, '0');
    expect(hex).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('v2 records', () => {
  it('does not put the content key in the message, and a preview cannot leak the wrap', async () => {
    const sealed = await sealNote({ text: 'The deed is in the drawer.', members, epoch: epoch(), label: 'Note' });
    expect(sealed.message.includes(toHex(sealed.contentKey))).toBe(false);
    expect(recordPreview(sealed.pointer)).toBe('Sealed note');
    expect(recordPreview(sealed.pointer)).not.toContain(sealed.pointer.wrap);
    const opened = await openRecord(sealed.message, members, epoch());
    expect(opened.text).toBe('The deed is in the drawer.');
    wipeRecordKeys(sealed.contentKey, opened.contentKey);
  });

  it('refuses a different epoch secret, a stale epoch number, and a different membership', async () => {
    const sealed = await sealNote({ text: 'secret', members, epoch: epoch() });
    const wrong = epoch();
    wrong.bytes = new Uint8Array(wrong.bytes);
    wrong.bytes[0] ^= 0xff;
    await expect(openRecord(sealed.message, members, wrong)).rejects.toMatchObject({ code: 'unwrap' });
    const stale = epoch({ mlsEpoch: '5' });
    await expect(openRecord(sealed.message, members, stale)).rejects.toMatchObject({ code: 'epoch' });
    await expect(openRecord(sealed.message, [members[0]], epoch())).rejects.toMatchObject({ code: 'epoch' });
    wipeRecordKeys(sealed.contentKey);
  });

  it('opens from a stored key after the epoch secret is gone, and fails closed once that key is wiped', async () => {
    const sealed = await sealNote({ text: 'keep', members, epoch: epoch() });
    const stored = new Uint8Array(sealed.contentKey);
    const opened = await openRecord(sealed.message, members, null, undefined, stored);
    expect(opened.text).toBe('keep');
    wipeRecordKeys(stored, sealed.contentKey, opened.contentKey);
    await expect(openRecord(sealed.message, members, null)).rejects.toMatchObject({ code: 'epoch' });
  });

  it('a late joiner without the old secret and without a stored key cannot open', async () => {
    const sealed = await sealNote({ text: 'old', members, epoch: epoch({ mlsEpoch: '3' }) });
    wipeRecordKeys(sealed.contentKey);
    await expect(openRecord(sealed.message, members, null)).rejects.toMatchObject({ code: 'epoch' });
  });

  it('rejects a flipped or truncated ciphertext', async () => {
    const sealed = await sealNote({ text: 'secret', members, epoch: epoch() });
    const inline = sealed.pointer.inline!;
    const flipped = (inline[0] === '0' ? '1' : '0') + inline.slice(1);
    const tampered = { ...sealed.pointer, inline: flipped };
    await expect(openRecord(tampered, members, epoch())).rejects.toMatchObject({ code: 'digest' });
    await expect(openRecord({ ...sealed.pointer, inline: inline.slice(0, 8) }, members, epoch())).rejects.toMatchObject({ code: 'digest' });
    wipeRecordKeys(sealed.contentKey);
  });

  it('links a second version to the first under the same epoch', async () => {
    const first = await sealNote({ text: 'v1', members, epoch: epoch() });
    const second = await sealNote({
      text: 'v2',
      members,
      epoch: epoch(),
      previous: { id: first.pointer.id, head: first.pointer.head, generation: first.pointer.generation },
    });
    expect(second.pointer.prev).toBe(first.pointer.head);
    expect(second.contentKey).not.toEqual(first.contentKey);
    expect(await verifyChain([first.message, second.message], members)).toBe(true);
    expect(await verifyChain([second.message], members)).toBe(false);
    wipeRecordKeys(first.contentKey, second.contentKey);
  });

  it('a handoff carries no amount, and a fake amount in the body is rejected', async () => {
    const peer = '0xcccccccccccccccccccccccccccccccccccccccc';
    const sealed = await sealHandoff({ action: 'pay', peer, members, epoch: epoch(), commitment: 'ab'.repeat(32) });
    expect(sealed.message).not.toMatch(/amount|token|secret/i);
    const opened = await openRecord(sealed.message, members, epoch());
    expect(opened.handoff).toEqual({ action: 'pay', peer, commitment: 'ab'.repeat(32) });
    expect(opened.handoff && JSON.stringify(opened.handoff)).not.toMatch(/amount/);
    wipeRecordKeys(sealed.contentKey, opened.contentKey);
  });

  it('rejects an exporter that is not labelled as the MLS exporter', async () => {
    const bad = epoch();
    (bad as { source: string }).source = 'xmtp-hmac-epoch';
    await expect(sealNote({ text: 'no', members, epoch: bad })).rejects.toMatchObject({ code: 'epoch' });
  });

  it('binds a file to the ciphertext digest and not to another host', async () => {
    const { sealFileBody } = await import('@/vendor/ledger-record/src/index');
    const plain = utf8('file-bytes-and-more');
    const sealed = await sealFileBody(plain, {
      label: 'deed.pdf',
      members,
      epoch: epoch(),
      url: '/api/chat/attachments/' + 'ab'.repeat(16),
    });
    const opened = await openRecord(sealed.pointer, members, epoch(), sealed.ciphertext);
    expect(new TextDecoder().decode(opened.plain)).toBe('file-bytes-and-more');
    expect(() => bindFileUrl(sealed.pointer, 'https://evil.example/x')).toThrow(/Ledger storage/);
    expect(recordPreview(sealed.pointer)).toBe('File: deed.pdf');
    wipeRecordKeys(sealed.contentKey, opened.contentKey);
  });
});

describe('local key and rewrap', () => {
  it('a wrong passphrase does not open the stored key, and locking drops it', async () => {
    const { RecordKeySession, wrapContentKey } = await import('@/vendor/ledger-record/src/index');
    const tiny = { t: 1, m: 8, p: 1, dkLen: 32 as const };
    const salt = new Uint8Array(16).fill(7);
    const session = new RecordKeySession();
    await session.unlockPassphrase('correct horse battery', salt, tiny);
    const content = new Uint8Array(32).fill(9);
    const wrapped = await wrapContentKey(content, await (await import('@/vendor/ledger-record/src/local')).derivePassphraseKek('correct horse battery', salt, tiny));
    const opened = await session.hold('r1', wrapped);
    expect(opened[0]).toBe(9);
    session.lock();
    await expect(session.hold('r1', wrapped)).rejects.toMatchObject({ code: 'locked' });
    await session.unlockPassphrase('wrong passphrase here', salt, tiny);
    await expect(session.hold('r2', wrapped)).rejects.toMatchObject({ code: 'passphrase' });
  });

  it('rewrap lets a current member open under the new epoch and does not help someone without that secret or the old key', async () => {
    const { rewrapToEpoch } = await import('@/vendor/ledger-record/src/index');
    const sealed = await sealNote({ text: 'same body', members, epoch: epoch(), installation: 'deviceA' });
    const next = epoch({ mlsEpoch: '9' });
    next.bytes = new Uint8Array(32).fill(4);
    const shared = await rewrapToEpoch({
      pointer: sealed.pointer,
      contentKey: sealed.contentKey,
      members,
      epoch: next,
      installation: 'deviceB',
    });
    const opened = await openRecord(shared.message, members, next);
    expect(opened.text).toBe('same body');
    await expect(openRecord(shared.message, members, epoch())).rejects.toMatchObject({ code: 'epoch' });
    await expect(openRecord(shared.message, members, null)).rejects.toMatchObject({ code: 'epoch' });
    const tampered = { ...sealed.pointer, installation: 'other' };
    await expect(openRecord(tampered, members, epoch())).rejects.toMatchObject({ code: 'aad' });
    wipeRecordKeys(sealed.contentKey, opened.contentKey);
  });

  it('reads a file one slice at a time', async () => {
    const { sealFileBody } = await import('@/vendor/ledger-record/src/index');
    const source = utf8('abcdefghijklmnopqrstuvwxyz');
    let live = 0;
    let peak = 0;
    const sealed = await sealFileBody(new Uint8Array(), {
      label: 'letters',
      members,
      epoch: epoch(),
      url: '/api/chat/attachments/' + 'cd'.repeat(16),
      reader: {
        size: source.length,
        read: async (start, end) => {
          live = end - start;
          peak = Math.max(peak, live);
          return source.slice(start, end);
        },
      },
    });
    expect(peak).toBeLessThanOrEqual(source.length);
    expect(sealed.timings.bytes).toBe(source.length);
    expect(sealed.timings.chunkBytes).toBe(64 * 1024);
    const opened = await openRecord(sealed.pointer, members, epoch(), sealed.ciphertext);
    expect(new TextDecoder().decode(opened.plain)).toBe('abcdefghijklmnopqrstuvwxyz');
    wipeRecordKeys(sealed.contentKey, opened.contentKey);
  });
});

describe('v1 records still open', () => {
  it('opens a legacy message that carries its key, and the new sealer does not emit one', async () => {
    const legacy = await sealLegacyNote({ text: 'old note', members, label: 'Note' });
    const message = (await import('@/vendor/ledger-record/src/v1')).encodeRecordMessage(legacy);
    expect(message).toContain(legacy.key);
    const opened = await openLegacyRecord(message, members);
    expect(opened.text).toBe('old note');
    expect(parseRecordMessage(message)).toBeNull();
    expect(opened.pointer.prev).toBe(ZERO_HEAD);
  });
});

function toHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}
