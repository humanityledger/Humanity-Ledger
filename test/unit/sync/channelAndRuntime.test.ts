import { describe, it, expect, beforeEach, vi } from 'vitest';
import { XmtpSyncChannel, SYNC_GROUP_NAME } from '@/lib/sync/xmtpSyncChannel';
import { encodeMessage, decodeMessage } from '@/lib/sync/lww';

const SELF = 'inbox-self';
const A = '0x' + 'a'.repeat(40);

type FakeGroup = {
  id: string; name?: string; createdAtNs?: bigint;
  memberIds: string[]; sent: string[];
  members(): Promise<Array<{ inboxId: string }>>;
  send(t: string): Promise<string>;
};

function group(id: string, name: string | undefined, memberIds: string[], created = 1): FakeGroup {
  return {
    id, name, createdAtNs: BigInt(created), memberIds, sent: [],
    async members() { return this.memberIds.map(inboxId => ({ inboxId })); },
    async send(t: string) { this.sent.push(t); return 'msg-' + this.sent.length; },
  };
}

function fakeClient(groups: FakeGroup[]) {
  const created: FakeGroup[] = [];
  return {
    inboxId: SELF,
    created,
    conversations: {
      async sync() {},
      async listGroups() { return [...groups, ...created]; },
      async newGroup(ids: string[], opts: { name?: string }) {
        const g = group('new-' + (created.length + 1), opts?.name, [SELF, ...ids], 99);
        created.push(g);
        return g;
      },
    },
  } as any;
}

describe('XmtpSyncChannel', () => {
  it('uses only groups with the reserved name whose members are all us', async () => {
    const ours = group('g-ours', SYNC_GROUP_NAME, [SELF], 1);
    const trap = group('g-trap', SYNC_GROUP_NAME, [SELF, 'inbox-attacker'], 0); // older, but not ours alone
    const chat = group('g-chat', 'Friends', [SELF, 'inbox-friend']);
    const ch = new XmtpSyncChannel(fakeClient([trap, chat, ours]));
    await ch.open();
    expect(ch.isSyncConversation('g-ours')).toBe(true);
    expect(ch.isSyncConversation('g-trap')).toBe(false);
    expect(ch.isSyncConversation('g-chat')).toBe(false);
  });

  it('creates a sync group when there is none', async () => {
    const client = fakeClient([]);
    const ch = new XmtpSyncChannel(client);
    await ch.open();
    expect(client.created).toHaveLength(1);
    expect(client.created[0].name).toBe(SYNC_GROUP_NAME);
    expect(client.created[0].memberIds).toEqual([SELF]);
  });

  it('sends to every valid sync group so two devices that each made one converge', async () => {
    const g1 = group('g1', SYNC_GROUP_NAME, [SELF], 1);
    const g2 = group('g2', SYNC_GROUP_NAME, [SELF], 2);
    const ch = new XmtpSyncChannel(fakeClient([g2, g1]));
    await ch.open();
    await ch.send('hello');
    expect(g1.sent).toEqual(['hello']);
    expect(g2.sent).toEqual(['hello']);
  });

  it('accepts a message only from our sync group AND from our own inbox', async () => {
    const ours = group('g-ours', SYNC_GROUP_NAME, [SELF]);
    const ch = new XmtpSyncChannel(fakeClient([ours]));
    await ch.open();
    expect(ch.accepts({ conversationId: 'g-ours', senderInboxId: SELF })).toBe(true);
    expect(ch.accepts({ conversationId: 'g-ours', senderInboxId: 'inbox-attacker' })).toBe(false);
    expect(ch.accepts({ conversationId: 'dm-with-attacker', senderInboxId: SELF })).toBe(false);
  });
});

describe('selectInstallationsToRevoke', () => {
  it('keeps the newest four and revokes the rest', async () => {
    vi.doMock('@xmtp/browser-sdk', () => ({ Client: {} }));
    const { selectInstallationsToRevoke } = await import('@/lib/xmtp/client');
    const inst = Array.from({ length: 10 }, (_, i) => ({ bytes: new Uint8Array([i]), clientTimestampNs: BigInt(i * 1000) }));
    const revoked = selectInstallationsToRevoke(inst).map(b => b[0]).sort((a, b) => a - b);
    expect(revoked).toEqual([0, 1, 2, 3, 4, 5]); // 6..9 are the newest and stay
    expect(selectInstallationsToRevoke(inst.slice(0, 3))).toEqual([]);
  });
});

describe('runtime end to end (one page, a message from another device)', () => {
  class MemKV {
    private m = new Map<string, string>();
    get length() { return this.m.size; }
    key(i: number) { return [...this.m.keys()][i] ?? null; }
    getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
    setItem(k: string, v: string) { this.m.set(k, String(v)); }
    removeItem(k: string) { this.m.delete(k); }
  }
  let kv: MemKV;
  let events: any[];

  beforeEach(() => {
    vi.resetModules();
    kv = new MemKV();
    events = [];
    (globalThis as any).window = {
      localStorage: kv,
      dispatchEvent: (e: any) => { events.push(e.detail); return true; },
    };
  });

  it('applies a change from the phone, writes the legacy key, and answers a new device with a snapshot', async () => {
    const rt = await import('@/lib/sync/runtime');
    const me = '0x' + '1'.repeat(40);
    const ours = group('g-ours', SYNC_GROUP_NAME, [SELF]);
    await rt.startDeviceSync(fakeClient([ours]), me);

    // Starting announced this device with a snapshot that asks others to answer.
    const first = decodeMessage(ours.sent[0])!;
    expect(first.k).toBe('snap');
    expect((first as any).ask).toBe(true);

    // A local change goes out after the debounce.
    rt.setSynced(me, { [`archived:${A}`]: true });
    await new Promise(r => setTimeout(r, 400));
    const opsMsg = ours.sent.map(t => decodeMessage(t)!).find(m => m.k === 'ops')!;
    expect(opsMsg.ops[0][0]).toBe(`archived:${A}`);

    // The phone mutes a chat and asks for state.
    const phoneMsg = encodeMessage({ k: 'snap', from: 'phonedevice9', ask: true, ops: [[`muted:${A}`, true, Date.now() + 10, 'phonedevice9']] });
    const sentBefore = ours.sent.length;
    expect(rt.handleDeviceSyncMessage({ content: phoneMsg, conversationId: 'g-ours', senderInboxId: SELF })).toBe(true);
    await new Promise(r => setTimeout(r, 50));

    expect(rt.getSynced(me, `muted:${A}`)).toBe(true);
    expect(kv.getItem(`ledger_muted_${A}`)).toBe('1');
    expect(events.some(d => d.source === 'remote' && d.keys.includes(`muted:${A}`))).toBe(true);
    // It answered the new device once, with what it knows.
    const answers = ours.sent.slice(sentBefore).map(t => decodeMessage(t)!);
    expect(answers).toHaveLength(1);
    expect(answers[0].k).toBe('snap');
    expect(answers[0].ops.some(o => o[0] === `archived:${A}`)).toBe(true);

    rt.stopDeviceSync();
  });

  it('ignores sync-looking messages from anyone else, but still hides them from the chat', async () => {
    const rt = await import('@/lib/sync/runtime');
    const me = '0x' + '1'.repeat(40);
    const ours = group('g-ours', SYNC_GROUP_NAME, [SELF]);
    await rt.startDeviceSync(fakeClient([ours]), me);
    const evil = encodeMessage({ k: 'ops', from: 'attacker01', ops: [[`muted:${A}`, true, Date.now() + 10, 'attacker01']] });
    // Sent by a peer in a normal DM.
    expect(rt.handleDeviceSyncMessage({ content: evil, conversationId: 'dm-x', senderInboxId: 'inbox-attacker' })).toBe(true);
    await new Promise(r => setTimeout(r, 50));
    expect(rt.getSynced(me, `muted:${A}`)).toBeUndefined();
    // Ordinary chat text is not swallowed.
    expect(rt.handleDeviceSyncMessage({ content: 'hola', conversationId: 'dm-x', senderInboxId: 'inbox-attacker' })).toBe(false);
    rt.stopDeviceSync();
  });
});
