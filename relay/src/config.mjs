// @ts-check
/**
 * Ledger Relay configuration, read once from the environment. Every value has a safe default, and
 * a relay with no TURN secret, no VAPID key or no storage directory simply does not offer that
 * capability (GET /v0/info says which it offers). Secrets are never logged.
 */

const int = (v, d, min, max) => {
  const n = Number.parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n)) return d;
  return Math.min(max, Math.max(min, n));
};
const list = (v) => String(v ?? '').split(',').map((x) => x.trim()).filter(Boolean);

/** @param {Record<string, string | undefined>} env */
export function readConfig(env = process.env) {
  const turnUrls = list(env.RELAY_TURN_URLS);
  const accessTokens = list(env.RELAY_ACCESS_TOKENS);
  return {
    port: int(env.PORT ?? env.RELAY_PORT, 8080, 1, 65535),
    name: (env.RELAY_NAME || 'Ledger Relay').slice(0, 80),
    operator: (env.RELAY_OPERATOR || '').slice(0, 120),
    /** Origins allowed to call the relay from a browser (CORS). */
    allowedOrigins: list(env.RELAY_ALLOWED_ORIGINS || 'https://ledgerchat.org'),
    /** "open": anyone within the rate limits; "token": a bearer token from RELAY_ACCESS_TOKENS. */
    access: accessTokens.length ? 'token' : 'open',
    accessTokens,
    /** Read the client address from X-Forwarded-For (only behind a proxy you run). */
    trustProxy: env.RELAY_TRUST_PROXY === '1',
    turn: {
      secret: env.RELAY_TURN_SECRET || '',
      urls: turnUrls,
      ttlSeconds: int(env.RELAY_TURN_TTL, 3600, 300, 86400),
    },
    signalling: {
      enabled: env.RELAY_SIGNALLING !== '0',
      key: env.RELAY_PEER_KEY || 'peerjs',
      expireMs: int(env.RELAY_PEER_EXPIRE_MS, 5000, 1000, 60000),
      aliveMs: int(env.RELAY_PEER_ALIVE_MS, 60000, 10000, 600000),
      maxClients: int(env.RELAY_PEER_MAX_CLIENTS, 5000, 1, 1000000),
    },
    blobs: {
      dir: env.RELAY_BLOB_DIR || '',
      maxBytes: int(env.RELAY_BLOB_MAX_BYTES, 25 * 1024 * 1024, 1024, 512 * 1024 * 1024),
      defaultTtlSeconds: int(env.RELAY_BLOB_TTL, 86400, 60, 30 * 86400),
      maxTtlSeconds: int(env.RELAY_BLOB_MAX_TTL, 7 * 86400, 60, 30 * 86400),
      quotaBytes: int(env.RELAY_BLOB_QUOTA_BYTES, 5 * 1024 * 1024 * 1024, 1024 * 1024, Number.MAX_SAFE_INTEGER),
    },
    push: {
      publicKey: env.RELAY_VAPID_PUBLIC_KEY || '',
      privateKey: env.RELAY_VAPID_PRIVATE_KEY || '',
      subject: env.RELAY_VAPID_SUBJECT || '',
      ttlDays: int(env.RELAY_PUSH_TTL_DAYS, 30, 1, 365),
      file: env.RELAY_PUSH_FILE || '',
    },
    metricsToken: env.RELAY_METRICS_TOKEN || '',
  };
}

/** @typedef {ReturnType<typeof readConfig>} RelayConfig */

/** What this relay offers, from its configuration. */
export function capabilities(/** @type {RelayConfig} */ c) {
  return {
    turn: Boolean(c.turn.secret && c.turn.urls.length),
    signalling: c.signalling.enabled,
    blobs: Boolean(c.blobs.dir),
    push: Boolean(c.push.publicKey && c.push.privateKey && c.push.subject),
  };
}
