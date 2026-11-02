/**
 * lib/security/messageEnvelope.ts
 *
 * A server-side guard against persisting readable message bodies.
 *
 * Context (F2-02 / N0): `lib/xmtp/client.ts` was cleaned so that `sendMessage`
 * delivers only over XMTP MLS and throws rather than falling back. But two API
 * routes still accept a message body and write it to storage as given:
 *
 *   app/api/chat/direct/route.ts  → prisma.directMessage.content  (PostgreSQL)
 *   app/api/chat/send/route.ts    → Redis sorted set + Redis pub/sub
 *                                 → prisma.pendingChatMessage.content
 *
 * Both are session-authenticated, so this is not an impersonation bug. It is a
 * confidentiality bug: anyone with read access to the database or to Redis —
 * an operator, a backup, a support query, a compromised managed instance —
 * reads every direct message in the clear.
 *
 * The fix this module supports does NOT invent a cipher. The client already
 * holds MLS keys through XMTP; the server has no business knowing the scheme.
 * The server's only job is to refuse anything that is not already sealed.
 *
 * Envelope format the routes accept:
 *
 *   hlv1.<alg>.<base64url payload>
 *
 * `alg` is an opaque label the client chooses (for example `mls` or
 * `x25519-xchacha20poly1305`). The server never parses the payload.
 *
 * ── Rollout ───────────────────────────────────────────────────────────────
 * Set CHAT_REQUIRE_SEALED_ENVELOPE=true once every client build sends sealed
 * bodies. Until then the guard runs in report-only mode: it stores what it is
 * given and logs a warning naming the route, so the remaining plaintext
 * callers show up in logs instead of having to be guessed at.
 *
 * Turning the flag on before the clients are updated will reject sends. That
 * is the intended failure direction, but it is a coordinated change.
 */

export const ENVELOPE_PREFIX = 'hlv1.';

/** Matches hlv1.<alg>.<base64url>, with alg limited to a short safe label. */
const ENVELOPE_RE = /^hlv1\.[a-z0-9][a-z0-9_-]{0,31}\.[A-Za-z0-9_-]+={0,2}$/;

export interface EnvelopeCheck {
  /** True when the body is a sealed envelope this server will never be able to read. */
  sealed: boolean;
  /** Set when the body must be refused. */
  rejection?: { error: string; code: string };
}

export function isSealedEnvelope(content: unknown): boolean {
  return typeof content === 'string' && ENVELOPE_RE.test(content);
}

/**
 * Decide whether a message body may be persisted.
 *
 * @param content the body as supplied by the client
 * @param route   a stable label used in the warning log, e.g. 'chat/direct'
 */
export function checkMessageEnvelope(content: unknown, route: string): EnvelopeCheck {
  const required = process.env.CHAT_REQUIRE_SEALED_ENVELOPE === 'true';

  if (isSealedEnvelope(content)) {
    return { sealed: true };
  }

  if (required) {
    return {
      sealed: false,
      rejection: {
        error:
          'This endpoint stores sealed message bodies only. Encrypt the message on the client and send the hlv1 envelope.',
        code: 'PLAINTEXT_REFUSED',
      },
    };
  }

  // Report-only mode: persist, but make the remaining plaintext callers visible.
  // The body itself is never logged.
  console.warn(
    `[E2EE][${route}] Persisting an UNSEALED message body. ` +
      `This is readable by anyone with database or Redis access. ` +
      `Set CHAT_REQUIRE_SEALED_ENVELOPE=true once clients send hlv1 envelopes. (F2-02)`,
  );

  return { sealed: false };
}

/**
 * Bytes-only length check that does not depend on whether the body is sealed.
 * Base64url inflates by about a third, so the sealed limit is set accordingly.
 */
export function withinSizeLimit(content: string, plaintextMaxBytes: number): boolean {
  const max = isSealedEnvelope(content) ? Math.ceil(plaintextMaxBytes * 1.4) : plaintextMaxBytes;
  return Buffer.byteLength(content, 'utf8') <= max;
}
