// @ts-check
/**
 * Short-lived TURN credentials, in the "TURN REST API" form that coturn accepts with
 * use-auth-secret / static-auth-secret: username = "<expiry>:<random>", password =
 * base64(HMAC-SHA1(secret, username)). The username carries no user or wallet identifier.
 */
import { createHmac, randomBytes } from 'node:crypto';

/**
 * @param {{ secret: string; urls: string[]; ttlSeconds: number }} turn
 * @param {number} [now] milliseconds, for tests
 */
export function turnCredentials(turn, now = Date.now()) {
  if (!turn.secret || !turn.urls.length) return null;
  const expiry = Math.floor(now / 1000) + turn.ttlSeconds;
  const username = `${expiry}:${randomBytes(9).toString('base64url')}`;
  const credential = createHmac('sha1', turn.secret).update(username).digest('base64');
  return { iceServers: [{ urls: turn.urls, username, credential }], ttl: turn.ttlSeconds };
}

/** The check coturn performs, for tests and for operators debugging a secret. */
export function verifyTurnCredential(secret, username, credential, now = Date.now()) {
  const expiry = Number(username.split(':')[0]);
  if (!Number.isFinite(expiry) || expiry * 1000 < now) return false;
  return createHmac('sha1', secret).update(username).digest('base64') === credential;
}
