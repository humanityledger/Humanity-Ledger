'use client';
/**
 * Test-only: R8 between two real browsers, on the Aztec TEST network. Reachable only in builds with
 * NEXT_PUBLIC_E2E_HARNESS=1, at /chat?e2e=r8&as=alice (or &as=bob). scripts/ui/r8-two-browser.mjs
 * opens one page per person, each in its own browser context, and signs for each with a throwaway
 * Ethereum account made for that run (neither is the operator).
 *
 * Nothing is simulated. Each page runs, with the code the chat runs:
 *   - its own XMTP client (getXMTPClient) on the XMTP network of the build, and a real DM;
 *   - its own private wallet (PrivateWallet.connect): PXE in the page, account deployed on testnet;
 *   - G7 scheme v2: aztecAddressProof, the announcement sent in the DM, recordPeerAnnouncement on
 *     receipt (as AgreementCard does) and verifiedPeerBinding before value moves;
 *   - the payment through sendDirectPrivatePayment (the composer's path: fresh G7 check, then
 *     PrivateWallet.send, proven in the page), and directPaymentMessage in the DM;
 *   - the receiver's sync (registerChatPeers, refresh) and its balance.
 * The script only calls these steps in order and checks what each returns.
 */
import React, { useEffect, useState } from 'react';
import { getXMTPClient, sendMessage } from '@/lib/xmtp/client';
import { getPrivateWallet } from '@/lib/aztec/wallet/client';
import { AZTEC_WALLET_CONFIG, type TokenKey } from '@/lib/aztec/wallet/config';
import {
  localStoragePeerBindingStore,
  parseAnnouncement,
  recordPeerAnnouncement,
  sdkBindingCrypto,
  verifiedAnnouncementFor,
  verifiedPeerBinding,
  verifyAddressProof,
  type AztecAddressAnnouncementV2,
} from '@/lib/aztec/peer-binding';
import { directPaymentMessage, sendDirectPrivatePayment } from '@/lib/payments/direct-private';

type Person = 'alice' | 'bob';

declare global {
  interface Window {
    /** Exposed by the Playwright script: signs with this page's throwaway Ethereum account. */
    __r8Sign?: (req: { kind: 'message'; message: string } | { kind: 'typed'; typedData: unknown }) => Promise<string>;
    __r8?: R8Api;
  }
}

export interface R8Api {
  start(evm: string): Promise<{ inboxId: string; aztecAddress: string; network: string | undefined }>;
  fund(token: TokenKey, amount: string): Promise<{ faucetTx?: string; shieldTx?: string }>;
  share(peerEvm: string, peerInboxId: string): Promise<{ messageId?: string; announcement: string }>;
  receive(peerInboxId: string, timeoutMs?: number): Promise<{ results: string[]; binding: { address?: string; verified: boolean; reason?: string }; texts: string[] }>;
  refusals(peerInboxId: string, otherInboxId: string): Promise<Record<string, string>>;
  payUnverified(token: TokenKey, amount: string, strangerInboxId: string): Promise<string>;
  pay(peerEvm: string, peerInboxId: string, token: TokenKey, amount: string): Promise<{ txHash: string; payee: string }>;
  balance(token: TokenKey, wantAtLeast?: string, timeoutMs?: number): Promise<{ privateUnits: string; activity: Array<{ kind: string; txHash?: string; status?: string }> }>;
}

const errText = (e: unknown) => String((e as any)?.message ?? e).slice(0, 300);

async function waitFor<T>(fn: () => Promise<T | undefined>, timeoutMs: number, every = 4000): Promise<T | undefined> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn().catch(() => undefined);
    if (v !== undefined) return v;
    if (Date.now() > end) return undefined;
    await new Promise((r) => setTimeout(r, every));
  }
}

export default function R8Harness() {
  const [as] = useState<Person>(() => (new URLSearchParams(window.location.search).get('as') === 'bob' ? 'bob' : 'alice'));
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const say = (s: string) => setLog((l) => [...l.slice(-40), `${new Date().toISOString().slice(11, 19)} ${s}`]);
    const sign = (req: Parameters<NonNullable<Window['__r8Sign']>>[0]) => {
      if (!window.__r8Sign) throw new Error('The test script did not expose a signer.');
      return window.__r8Sign(req);
    };
    const wallet = getPrivateWallet();
    const store = localStoragePeerBindingStore();
    let xmtp: any = null;
    let selfInboxId = '';
    let evmAddress = '';

    const dmWith = async (peerInboxId: string) => {
      await xmtp.conversations.sync();
      const dms: any[] = await xmtp.conversations.listDms();
      for (const dm of dms) {
        const peer = typeof dm.peerInboxId === 'function' ? await dm.peerInboxId() : dm.peerInboxId;
        if (String(peer).toLowerCase() === peerInboxId.toLowerCase()) return dm;
      }
      return undefined;
    };

    const api: R8Api = {
      async start(evm) {
        evmAddress = evm;
        say(`start ${as} ${evm}`);
        xmtp = await getXMTPClient({ getAddress: async () => evm, signMessage: (m) => sign({ kind: 'message', message: typeof m === 'string' ? m : new TextDecoder().decode(m) }) });
        selfInboxId = String(xmtp.inboxId);
        say(`xmtp inbox ${selfInboxId.slice(0, 10)}…`);
        await wallet.connect(evm, (typedData) => sign({ kind: 'typed', typedData }));
        const s = wallet.state;
        if (s.phase !== 'ready' || !s.aztecAddress) throw new Error(`wallet not ready: ${s.phase} ${s.error ?? ''}`);
        say(`aztec ${s.aztecAddress.slice(0, 12)}…`);
        return { inboxId: selfInboxId, aztecAddress: s.aztecAddress, network: wallet.bindingContext().network };
      },

      async fund(token, amount) {
        // The test faucet of this build (a throwaway minter made for this run), then shield: the
        // same two buttons a person uses in the wallet on the test network.
        const f: any = await wallet.faucet(token);
        const sh: any = await wallet.shield(token, amount);
        say(`funded ${amount} ${token}`);
        return { faucetTx: f?.txHash?.toString?.(), shieldTx: sh?.txHash?.toString?.() };
      },

      async share(peerEvm, peerInboxId) {
        const proof = await wallet.aztecAddressProof(selfInboxId, peerInboxId);
        const announcement = verifiedAnnouncementFor(wallet.state.aztecAddress!, proof);
        const messageId = await sendMessage(xmtp, peerEvm, announcement, evmAddress);
        say('shared Aztec address (G7 v2)');
        return { messageId, announcement };
      },

      async receive(peerInboxId, timeoutMs = 180_000) {
        const crypto = await sdkBindingCrypto();
        const results: string[] = [];
        const texts: string[] = [];
        const done = await waitFor(async () => {
          const dm = await dmWith(peerInboxId);
          if (!dm) return undefined;
          await dm.sync();
          const msgs: any[] = await dm.messages();
          let sawAnnouncement = false;
          results.length = 0;
          texts.length = 0;
          for (const m of msgs) {
            const body = typeof m.content === 'string' ? m.content : undefined;
            if (body === undefined) continue;
            texts.push(body.slice(0, 400));
            if (!parseAnnouncement(body)) continue;
            sawAnnouncement = true;
            // Exactly what AgreementCard does with an incoming announcement.
            const r = await recordPeerAnnouncement(store, { senderInboxId: String(m.senderInboxId), peerInboxId, body, selfInboxId }, crypto, { network: wallet.bindingContext().network });
            results.push(r.status + ('verified' in r && r.verified ? ':verified' : '') + ('reason' in r ? `:${r.reason}` : ''));
          }
          return sawAnnouncement ? true : undefined;
        }, timeoutMs);
        const binding = await verifiedPeerBinding(store, peerInboxId, selfInboxId, crypto, wallet.bindingContext());
        say(`received: ${done ? results.join(', ') : 'nothing'}; verified=${binding.verified}`);
        return { results, binding, texts };
      },

      async refusals(peerInboxId, otherInboxId) {
        // The peer's genuine announcement, re-checked in the ways an attacker would try to reuse it.
        const crypto = await sdkBindingCrypto();
        const raw = await store.get(`proof:${peerInboxId}`);
        const ann = parseAnnouncement(raw) as AztecAddressAnnouncementV2 | undefined;
        if (!ann || ann.version !== 2) throw new Error('no stored proof for the peer');
        const net = wallet.bindingContext();
        const reason = (r: { ok: boolean; reason?: string }) => (r.ok ? 'ACCEPTED' : r.reason!);
        const out: Record<string, string> = {};
        out.genuine = reason(await verifyAddressProof(ann, { senderInboxId: peerInboxId, selfInboxId, ...net }, crypto));
        out.replayedToAnotherInbox = reason(await verifyAddressProof(ann, { senderInboxId: peerInboxId, selfInboxId: otherInboxId, ...net }, crypto));
        out.forwardedByAnotherSender = reason(await verifyAddressProof(ann, { senderInboxId: otherInboxId, selfInboxId, ...net }, crypto));
        out.otherNetwork = reason(await verifyAddressProof(ann, { senderInboxId: peerInboxId, selfInboxId, network: 'aztec:1:1', requireNetwork: true }, crypto));
        const swapped = { ...ann, address: '0x' + (BigInt(ann.address) ^ 1n).toString(16).padStart(64, '0') };
        out.addressSwapped = reason(await verifyAddressProof(swapped, { senderInboxId: peerInboxId, selfInboxId, ...net }, crypto));
        const sig = ann.proof.signature;
        const flipped = { ...ann, proof: { ...ann.proof, signature: sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0') } };
        out.signatureFlipped = reason(await verifyAddressProof(flipped, { senderInboxId: peerInboxId, selfInboxId, ...net }, crypto));
        return out;
      },

      async payUnverified(token, amount, strangerInboxId) {
        // A pin with no proof of control (trust on first use only): the payment must be refused
        // before anything is proven.
        await store.set(strangerInboxId, wallet.state.aztecAddress!);
        try {
          await sendDirectPrivatePayment({ token, amount, dmPeerInboxId: strangerInboxId, selfInboxId });
          return 'SENT';
        } catch (e) {
          return errText(e);
        }
      },

      async pay(peerEvm, peerInboxId, token, amount) {
        const r = await sendDirectPrivatePayment({ token, amount, dmPeerInboxId: peerInboxId, selfInboxId });
        await sendMessage(xmtp, peerEvm, directPaymentMessage({ token, txHash: r.txHash, senderAztec: wallet.state.aztecAddress }), evmAddress);
        say(`paid ${amount} ${token}: ${r.txHash.slice(0, 12)}…`);
        return r;
      },

      async balance(token, wantAtLeast, timeoutMs = 600_000) {
        const units = () => {
          const b = wallet.state.balances.find((x) => x.key === token);
          return b ? BigInt(b.privateUnits) : 0n;
        };
        const want = wantAtLeast ? BigInt(wantAtLeast) : 0n;
        await waitFor(async () => {
          await wallet.registerChatPeers();
          await wallet.refresh();
          return units() >= want ? true : undefined;
        }, timeoutMs, 10_000);
        say(`balance ${token}: ${units()}`);
        return {
          privateUnits: units().toString(),
          activity: wallet.state.activity.map((a: any) => ({ kind: a.kind, txHash: a.txHash, status: a.status })),
        };
      },
    };
    window.__r8 = api;
    say(`ready as ${as} on ${AZTEC_WALLET_CONFIG.network}`);
  }, [as]);

  return (
    <div data-testid="r8-harness" data-as={as} className="min-h-screen bg-white p-4 font-mono text-[12px] text-[#15171C]">
      <h1 className="text-[15px] font-semibold mb-2">R8 · {as}</h1>
      {log.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}
