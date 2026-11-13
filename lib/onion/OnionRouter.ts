/**
 * OnionRouter.ts — Ledger Chat Quantum Onion Routing Engine
 * ═══════════════════════════════════════════════════════════
 *
 * Orchestrates the construction of an onion circuit for end to end
 * privacy-preserving message delivery through multiple relay nodes.
 *
 * Flow:
 *   1. Discover N active relay peers via /api/chat/onion/peer-list
 *   2. Select 3 random relays to form the circuit (Guard → Middle → Exit)
 *   3. Build the onion: wrap the payload in N+1 encryption layers,
 *      each addressed to the corresponding relay in reverse order
 *   4. Send the outermost layer to the Guard node
 *   5. Each relay peels one layer and forwards to the next
 *   6. Exit node delivers the plaintext payload to XMTP
 *
 * Security Model (Session-inspired, improved):
 *   - Every message uses a freshly generated ECDH ephemeral key per layer
 *   - No relay knows both the sender and the final recipient
 *   - Guard node knows the sender's IP but not the destination
 *   - Exit node knows the destination but not the sender
 *   - Middle nodes know neither
 *   - Payload padding makes all packets identical in size
 *
 * Threat Model Coverage:
 *   ✅ Passive eavesdropping on the network
 *   ✅ Single relay node compromise
 *   ✅ Traffic correlation (mitigated by padding + jitter)
 *   ✅ Replay attacks (each packet has a unique AEAD ciphertext)
 *   ❌ All three relays simultaneously compromised (not in scope for v1)
 */

'use client';

import {
  type OnionPublicKey,
  type OnionLayer,
  encryptLayer,
  b64uEncode,
  b64uDecode,
} from '@/lib/onion/OnionCrypto';

// ── Types ──────────────────────────────────────────────────────────────────────

/** A registered relay node in the peer list */
export interface RelayNode {
  id:           string;           // Unique relay ID (wallet address or random UUID)
  publicKey:    OnionPublicKey;   // Relay's ECDH public key (safe to share)
  relayUrl:     string;           // URL of the relay endpoint
  lastSeen:     number;           // Unix ms — used to filter stale nodes
}

/**
 * A fully constructed onion packet ready to be sent to the guard relay.
 * The outer `OnionLayer` addresses the guard; inner layers are opaque blobs.
 */
export interface OnionPacket {
  /** The outermost encrypted layer — sent to Guard relay */
  outer: OnionLayer;
  /** The relay URL to send `outer` to (Guard node) */
  guardUrl: string;
  /** Circuit metadata for telemetry (never sent over the wire) */
  _circuit: { guard: string; middle: string; exit: string };
}

/** The final delivery instruction embedded inside the innermost onion layer */
export interface OnionDelivery {
  type:        'XMTP_DELIVER';
  destination: string;   // Recipient Ethereum address
  payload:     string;   // Plaintext message content
  sentAt:      number;   // Unix ms — for replay protection
  nonce:       string;   // Random hex — uniqueness guarantee
}

/** Onion envelope format passed between relays */
export interface OnionEnvelope {
  type:    'ONION_FORWARD';
  nextHop: string;           // URL of next relay (or 'DELIVER' for exit)
  layer:   OnionLayer;       // The next encrypted layer to forward
}

// ── Constants ──────────────────────────────────────────────────────────────────

/** How many relay hops to use (minimum for meaningful anonymity) */
const CIRCUIT_HOPS = 3;

/** Maximum age (ms) for a relay to be considered active */
const MAX_RELAY_AGE_MS = 60_000;

/** Jitter range (ms) to add before forwarding — reduces timing correlation */
const JITTER_MIN_MS = 50;
const JITTER_MAX_MS = 300;

// ── Relay Discovery ────────────────────────────────────────────────────────────

/**
 * Fetches the list of currently active relay peers from the server registry.
 * Falls back to an empty array if the endpoint is unavailable.
 */
export async function discoverRelays(): Promise<RelayNode[]> {
  try {
    const res = await fetch('/api/chat/onion/register', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache:   'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    const now = Date.now();
    return (data.relays as RelayNode[]).filter(
      (r) => now - r.lastSeen < MAX_RELAY_AGE_MS,
    );
  } catch {
    return [];
  }
}

/**
 * Selects `count` random relays from the available pool.
 * Uses crypto.getRandomValues for unpredictable selection — no Math.random().
 *
 * Fisher-Yates shuffle with WebCrypto randomness.
 */
export function selectRandomRelays(pool: RelayNode[], count: number): RelayNode[] {
  if (pool.length < count) return pool;

  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    // Cryptographically random index in [0, i]
    const rand = new Uint32Array(1);
    crypto.getRandomValues(rand);
    const j = rand[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

// ── Onion Construction ─────────────────────────────────────────────────────────

/**
 * Builds a complete onion packet for a given message.
 *
 * The onion is constructed in reverse order (innermost layer first):
 *
 *   Layer 0 (innermost — for Exit relay):
 *     Plaintext = OnionDelivery JSON
 *     Encrypted with Exit relay's public key
 *
 *   Layer 1 (for Middle relay):
 *     Plaintext = { type: 'ONION_FORWARD', nextHop: exitUrl, layer: Layer0 }
 *     Encrypted with Middle relay's public key
 *
 *   Layer 2 (outermost — for Guard relay):
 *     Plaintext = { type: 'ONION_FORWARD', nextHop: middleUrl, layer: Layer1 }
 *     Encrypted with Guard relay's public key
 *
 * @param content     The plaintext message content to deliver
 * @param destination The recipient's Ethereum/XMTP address
 * @param relays      The ordered circuit [guard, middle, exit]
 */
export async function buildOnionPacket(
  content:     string,
  destination: string,
  relays:      RelayNode[],
): Promise<OnionPacket> {
  if (relays.length < CIRCUIT_HOPS) {
    throw new Error(`[OnionRouter] Need at least ${CIRCUIT_HOPS} relay nodes to build a circuit.`);
  }

  const [guard, middle, exit] = relays;
  const encoder = new TextEncoder();

  // ── Innermost Layer: Delivery instruction for the Exit relay ──────────────
  const delivery: OnionDelivery = {
    type:        'XMTP_DELIVER',
    destination,
    payload:     content,
    sentAt:      Date.now(),
    nonce:       b64uEncode(crypto.getRandomValues(new Uint8Array(16))),
  };
  const deliveryBytes = encoder.encode(JSON.stringify(delivery));
  const layer0 = await encryptLayer(deliveryBytes, exit.publicKey);

  // ── Middle Layer: Envelope for the Middle relay ────────────────────────────
  const envelope1: OnionEnvelope = {
    type:    'ONION_FORWARD',
    nextHop: exit.relayUrl,
    layer:   layer0,
  };
  const envelope1Bytes = encoder.encode(JSON.stringify(envelope1));
  const layer1 = await encryptLayer(envelope1Bytes, middle.publicKey);

  // ── Outer Layer: Envelope for the Guard relay ──────────────────────────────
  const envelope2: OnionEnvelope = {
    type:    'ONION_FORWARD',
    nextHop: middle.relayUrl,
    layer:   layer1,
  };
  const envelope2Bytes = encoder.encode(JSON.stringify(envelope2));
  const layer2 = await encryptLayer(envelope2Bytes, guard.publicKey);

  return {
    outer:    layer2,
    guardUrl: guard.relayUrl,
    _circuit: {
      guard:  guard.id,
      middle: middle.id,
      exit:   exit.id,
    },
  };
}

// ── Jitter ────────────────────────────────────────────────────────────────────

/** Waits a random duration to break timing correlation between relays */
export function applyJitter(): Promise<void> {
  const rand = new Uint32Array(1);
  crypto.getRandomValues(rand);
  const delay = JITTER_MIN_MS + (rand[0] % (JITTER_MAX_MS - JITTER_MIN_MS));
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// ── Main Entry Point ──────────────────────────────────────────────────────────

/**
 * High-level function: sends a message through the onion routing circuit.
 *
 * Returns:
 *   'onion'  — Successfully routed through the onion circuit
 *   'direct' — Fell back to direct delivery (insufficient relay nodes)
 *
 * The caller (LedgerChat) handles the direct fallback case.
 */
export async function sendViaOnion(
  content:     string,
  destination: string,
  authToken:   string,
): Promise<'onion' | 'direct'> {
  // 1. Discover active relays
  const relays = await discoverRelays();

  if (relays.length < CIRCUIT_HOPS) {
    console.warn(`[OnionRouter] Only ${relays.length} relay(s) available. Minimum ${CIRCUIT_HOPS} required. Falling back to direct.`);
    return 'direct';
  }

  // 2. Select random circuit
  const circuit = selectRandomRelays(relays, CIRCUIT_HOPS);

  // 3. Build the onion packet
  const packet = await buildOnionPacket(content, destination, circuit);

  // 4. Apply jitter before sending (timing correlation resistance)
  await applyJitter();

  // 5. Send outermost layer to Guard relay
  const res = await fetch(packet.guardUrl, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${authToken}`,
      'X-Onion-Route': '1',
    },
    body: JSON.stringify({
      type:    'ONION_FORWARD',
      nextHop: circuit[1].relayUrl,
      layer:   packet.outer,
    }),
  });

  if (!res.ok) {
    throw new Error(`[OnionRouter] Guard relay rejected packet: HTTP ${res.status}`);
  }

  console.info(`[OnionRouter] ✅ Onion packet delivered via circuit: ${packet._circuit.guard.slice(0, 6)} → ${packet._circuit.middle.slice(0, 6)} → ${packet._circuit.exit.slice(0, 6)}`);
  return 'onion';
}

// ── Relay Self-Registration ────────────────────────────────────────────────────

/**
 * Relay node identity for this page load, kept in memory only. It used to be written to
 * sessionStorage, which put the ECDH private key (JWK) where any script on the origin could read
 * it. A reload now creates and registers a fresh identity.
 */
const LEGACY_RELAY_KEY_STORAGE = 'ledger_onion_relay_identity';
let relayIdentity: { publicKeyJwk: JsonWebKey; privateKeyJwk: JsonWebKey } | null = null;

/**
 * Registers the current browser session as an available relay node.
 *
 * This enables a voluntary P2P relay network where participating users
 * contribute their bandwidth to route other users' onion packets.
 * No sensitive information is exposed — only the relay's public key and URL.
 */
export async function registerAsRelay(
  walletAddress: string,
  relayBaseUrl:  string,
): Promise<void> {
  // Check if we already have a relay identity
  let identity = relayIdentity;
  // Remove the private key a previous version left in sessionStorage.
  try { sessionStorage.removeItem(LEGACY_RELAY_KEY_STORAGE); } catch { /* ignore */ }

  let pubKeyJwk: JsonWebKey;
  let privKeyJwk: JsonWebKey;

  if (identity) {
    pubKeyJwk  = identity.publicKeyJwk;
    privKeyJwk = identity.privateKeyJwk;
  } else {
    // Generate a fresh identity for this relay session
    const pair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits'],
    );
    pubKeyJwk  = await crypto.subtle.exportKey('jwk', pair.publicKey);
    privKeyJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);

    // Remove private 'd' field from public key export (safety)
    const { d: _unused, ...cleanPub } = pubKeyJwk as any;
    pubKeyJwk = cleanPub;

    identity = { publicKeyJwk: cleanPub, privateKeyJwk: privKeyJwk };
    relayIdentity = identity;
  }

  // POST to relay registry
  await fetch('/api/chat/onion/register', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id:        walletAddress,
      publicKey: { jwk: pubKeyJwk },
      relayUrl:  `${relayBaseUrl}/api/chat/onion/relay`,
    }),
  }).catch(() => { /* non-critical — registry is best-effort */ });
}
