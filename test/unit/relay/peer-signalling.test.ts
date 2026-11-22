/**
 * Ledger Relay carries call set-up when it is switched on (lib/calls/media.ts, peerServerOptions):
 * PeerJS connects to the organisation's relay at /peerjs/peerjs instead of the public cloud.
 */
import { describe, expect, it } from 'vitest';
import { peerServerOptions } from '@/lib/calls/media';

describe('call signalling through Ledger Relay', () => {
  it('uses the first organisation relay when the relay is switched on', () => {
    expect(peerServerOptions({ NEXT_PUBLIC_LEDGER_RELAY: '1', NEXT_PUBLIC_LEDGER_RELAYS: 'https://relay.example.org, https://b.example.org' }))
      .toEqual({ host: 'relay.example.org', port: 443, path: '/peerjs/', key: 'peerjs', secure: true });
  });

  it('keeps the public service when the relay is off or not https', () => {
    expect(peerServerOptions({ NEXT_PUBLIC_LEDGER_RELAYS: 'https://relay.example.org' })).toEqual({});
    expect(peerServerOptions({ NEXT_PUBLIC_LEDGER_RELAY: '1', NEXT_PUBLIC_LEDGER_RELAYS: 'http://relay.example.org' })).toEqual({});
    expect(peerServerOptions({ NEXT_PUBLIC_LEDGER_RELAY: '1' })).toEqual({});
  });

  it('a PeerServer set explicitly still wins', () => {
    expect(peerServerOptions({ NEXT_PUBLIC_PEERJS_HOST: 'peer.ledgerchat.org', NEXT_PUBLIC_LEDGER_RELAY: '1', NEXT_PUBLIC_LEDGER_RELAYS: 'https://relay.example.org' }))
      .toEqual({ host: 'peer.ledgerchat.org', port: 443, path: '/', secure: true });
  });
});

describe('falling back when the relay does not answer', () => {
  const relay = { host: 'relay.example.org', port: 443, path: '/peerjs/', key: 'peerjs', secure: true };
  it('keeps the relay when /health answers ok', async () => {
    const { pickPeerServer } = await import('@/lib/calls/media');
    const f = (async () => new Response('{"ok":true}', { status: 200 })) as unknown as typeof fetch;
    expect(await pickPeerServer(relay, f)).toEqual(relay);
  });
  it('uses the public cloud when /health fails, errors or is another site', async () => {
    const { pickPeerServer } = await import('@/lib/calls/media');
    expect(await pickPeerServer(relay, (async () => new Response('down', { status: 502 })) as unknown as typeof fetch)).toEqual({});
    expect(await pickPeerServer(relay, (async () => { throw new Error('offline'); }) as unknown as typeof fetch)).toEqual({});
    expect(await pickPeerServer(relay, (async () => new Response('<html>Ledger Chat</html>', { status: 200 })) as unknown as typeof fetch)).toEqual({});
  });
  it('leaves any other PeerServer alone', async () => {
    const { pickPeerServer } = await import('@/lib/calls/media');
    const own = { host: 'peer.ledgerchat.org', port: 443, path: '/', secure: true };
    expect(await pickPeerServer(own, (async () => { throw new Error('not called'); }) as unknown as typeof fetch)).toEqual(own);
    expect(await pickPeerServer({})).toEqual({});
  });
});
