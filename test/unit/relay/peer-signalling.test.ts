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
