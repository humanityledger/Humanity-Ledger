import { describe, expect, it } from 'vitest';
import {
  MAX_NOTE_BYTES,
  ZERO_HEAD,
  encodeRecordMessage,
  isRecordMessage,
  membershipEpoch,
  openRecord,
  parseRecordMessage,
  recordPreview,
  sealFileBody,
  sealHandoff,
  sealNote,
  sha256Ready,
  verifyChain,
  buildPointer,
} from '../src/index';
import { sha256Hex, toHex, utf8 } from '../src/hex';

const members = ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'];

describe('sha-256', () => {
  it('matches the known digest of abc', async () => {
    expect(await sha256Hex(utf8('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('a sealed note', () => {
  it('opens only for the members it names, and the preview hides the key', async () => {
    const pointer = await sealNote({ text: 'The deed is in the drawer.', members, label: 'Note' });
    const message = encodeRecordMessage(pointer);
    expect(message.startsWith('{"type":"ledger.record"')).toBe(true);
    expect(recordPreview(pointer)).toBe('Sealed note');
    expect(recordPreview(pointer)).not.toContain(pointer.key);
    expect(message).toContain(pointer.key);
    expect(isRecordMessage(message)).toBe(true);

    const opened = await openRecord(message, members);
    expect(opened.text).toBe('The deed is in the drawer.');
    expect(opened.handoff).toBeNull();
    expect(pointer.generation).toBe(1);
    expect(pointer.prev).toBe(ZERO_HEAD);
    expect(pointer.epoch).toBe(await membershipEpoch([...members].reverse()));
  });

  it('refuses a different set of people', async () => {
    const message = encodeRecordMessage(await sealNote({ text: 'secret', members }));
    await expect(openRecord(message, [members[0]])).rejects.toMatchObject({ code: 'epoch' });
  });

  it('refuses a flipped ciphertext bit', async () => {
    const pointer = await sealNote({ text: 'secret', members });
    const cipher = pointer.inline!;
    const at = 20;
    const digit = cipher[at] === '0' ? '1' : '0';
    const tampered = { ...pointer, inline: cipher.slice(0, at) + digit + cipher.slice(at + 1) };
    await expect(openRecord(tampered, members)).rejects.toMatchObject({ code: 'digest' });
  });

  it('refuses a pointer whose head was left unchanged after the label changed', async () => {
    const pointer = await sealNote({ text: 'secret', members });
    const tampered = { ...pointer, label: 'Other' };
    await expect(openRecord(tampered, members)).rejects.toMatchObject({ code: 'head' });
  });

  it('rejects a message that is not a record, without throwing', () => {
    expect(parseRecordMessage('hello')).toBeNull();
    expect(parseRecordMessage('{"type":"ledger.record"')).toBeNull();
    expect(parseRecordMessage('{"type":"hl.attachment","v":1}')).toBeNull();
    expect(isRecordMessage(123)).toBe(false);
  });

  it('rejects an oversized note', async () => {
    await expect(sealNote({ text: 'x'.repeat(MAX_NOTE_BYTES + 1), members })).rejects.toMatchObject({ code: 'plain' });
  });
});

describe('versions', () => {
  it('links the second version to the first and refuses a gap', async () => {
    const first = await sealNote({ text: 'v1', members });
    const second = await sealNote({
      text: 'v2',
      members,
      previous: { id: first.id, head: first.head, generation: first.generation },
    });
    expect(second.id).toBe(first.id);
    expect(second.generation).toBe(2);
    expect(second.prev).toBe(first.head);
    expect(second.key).not.toBe(first.key);
    const chain = [encodeRecordMessage(first), encodeRecordMessage(second)];
    expect(await verifyChain(chain)).toBe(true);
    expect(await verifyChain([chain[1], chain[0]])).toBe(false);
    expect(await verifyChain([chain[1]])).toBe(false);

    const opened = await openRecord(chain[1], members);
    expect(opened.text).toBe('v2');
    expect(opened.plain).not.toEqual((await openRecord(chain[0], members)).plain);
  });
});

describe('a handoff', () => {
  it('names a payment or an agreement and nothing else', async () => {
    const peer = '0xcccccccccccccccccccccccccccccccccccccccc';
    const pointer = await sealHandoff({ action: 'pay', peer, members });
    const opened = await openRecord(encodeRecordMessage(pointer), members);
    expect(opened.handoff).toEqual({ action: 'pay', peer });
    expect(recordPreview(pointer)).toBe('Private payment');
    expect(recordPreview(pointer)).not.toContain(pointer.key);
    expect(JSON.stringify(opened.handoff)).not.toMatch(/amount|value|token/i);

    const lie = { ...pointer, action: 'agreement' as const };
    await expect(openRecord(lie, members)).rejects.toThrow();
  });

  it('refuses an amount hiding in the body', async () => {
    const pointer = await sealHandoff({ action: 'agreement', peer: '0xdddddddddddddddddddddddddddddddddddddddd', members });
    const extra = utf8('{"action":"agreement","peer":"' + pointer.peer + '","amount":"1"}');
    const sealed = await sealFileBody(extra);
    await expect(buildPointer({
      kind: 'handoff',
      label: 'Private agreement',
      members,
      plain: extra,
      sealed,
      inline: toHex(sealed.ciphertext),
      action: 'agreement',
      peer: pointer.peer,
    })).rejects.toMatchObject({ code: 'handoff' });
  });
});

describe('a file', () => {
  it('binds the digest, not the storage path, into the head', async () => {
    const plain = utf8('file-bytes');
    const sealed = await sealFileBody(plain);
    const url = '/api/chat/attachments/' + 'ab'.repeat(16);
    const pointer = await buildPointer({
      kind: 'file',
      label: 'deed.pdf',
      members,
      plain,
      sealed,
      url,
    });
    expect(pointer.url).toBe(url);
    expect(pointer.inline).toBeUndefined();
    const opened = await openRecord(pointer, members, sealed.ciphertext);
    expect(new TextDecoder().decode(opened.plain)).toBe('file-bytes');
    expect(recordPreview(pointer)).toBe('File: deed.pdf');

    const other = new Uint8Array(sealed.ciphertext);
    other[0] ^= 0xff;
    await expect(openRecord(pointer, members, other)).rejects.toMatchObject({ code: 'digest' });
    expect(parseRecordMessage(encodeRecordMessage({ ...pointer, url: 'https://evil.example/x' }))).toBeNull();
  });
});

describe('members', () => {
  it('treats order as irrelevant and rejects a duplicate', async () => {
    const a = await membershipEpoch(members);
    const b = await membershipEpoch([members[1], members[0]]);
    expect(a).toBe(b);
    await expect(membershipEpoch([members[0], members[0]])).rejects.toMatchObject({ code: 'members' });
    await expect(membershipEpoch([])).rejects.toMatchObject({ code: 'members' });
    await expect(membershipEpoch(['has space'])).rejects.toMatchObject({ code: 'members' });
  });
});

