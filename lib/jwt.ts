import { SignJWT, jwtVerify, JWTPayload, importJWK } from 'jose';
import { isSessionPayload } from './security/sessionClaims';

const alg = 'EdDSA';

// ─── Lazy secret resolver ─────────────────────────────────────────────────────
// CRITICAL: Do NOT validate process.env at module level.
// `next build` eagerly imports all server modules and sets NODE_ENV=production,
// but runtime secrets (JWT_SECRET) are NOT injected until the container starts.
// Any top-level throw here will crash the Docker build on Railway.
// The validation is deferred to inside the exported functions so it only fires
// during actual HTTP request handling — never at import / build time.
let cachedHsSecretRaw: string | null = null;
let cachedHsSecretBytes: Uint8Array | null = null;

function getHS256SecretBytes(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  // Fail closed: a default written in this public repository would let anyone forge sessions.
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET (or NEXTAUTH_SECRET) must be set to at least 32 characters.');
  if (cachedHsSecretRaw !== secret || !cachedHsSecretBytes) {
    cachedHsSecretRaw = secret;
    cachedHsSecretBytes = new TextEncoder().encode(secret);
  }
  return cachedHsSecretBytes;
}

// ─── EdDSA key cache ──────────────────────────────────────────────────────────
const migrationCutoff = process.env.JWT_MIGRATION_CUTOFF
  ? new Date(process.env.JWT_MIGRATION_CUTOFF).getTime()
  : Date.now() + 30 * 24 * 60 * 60 * 1000; // default: 30 days from now

let cachedEddsaKeyPairSig = '';
let cachedPrivateKey: any = null;
let cachedPublicKey: any  = null;

async function getEdDSAKeys() {
  const privRaw = process.env.JWT_EDDSA_PRIVATE_JWK || '';
  const pubRaw = process.env.JWT_EDDSA_PUBLIC_JWK || '';
  if (!privRaw || !pubRaw) {
    cachedEddsaKeyPairSig = '';
    cachedPrivateKey = null;
    cachedPublicKey = null;
    return null;
  }
  const sig = `${privRaw}|${pubRaw}`;
  if (cachedEddsaKeyPairSig === sig && cachedPrivateKey && cachedPublicKey) {
    return { privateKey: cachedPrivateKey, publicKey: cachedPublicKey };
  }

  try {
    const privJwk = JSON.parse(privRaw);
    const pubJwk  = JSON.parse(pubRaw);
    cachedPrivateKey = await importJWK(privJwk, 'EdDSA');
    cachedPublicKey  = await importJWK(pubJwk,  'EdDSA');
    cachedEddsaKeyPairSig = sig;
    return { privateKey: cachedPrivateKey, publicKey: cachedPublicKey };
  } catch (parseErr) {
    console.warn(
      '[JWT] JWT_EDDSA_*_JWK env var is malformed or invalid JSON. Falling back to HS256.',
      parseErr instanceof SyntaxError ? parseErr.message : ''
    );
    cachedEddsaKeyPairSig = '';
    cachedPrivateKey = null;
    cachedPublicKey  = null;
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const mintJWT = async (payload: JWTPayload): Promise<string> => {
  const now  = Date.now();
  const keys = await getEdDSAKeys();
  const useEdDSA = keys && (now < migrationCutoff || process.env.NODE_ENV === 'production');

  if (useEdDSA && keys) {
    return new SignJWT(payload)
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setExpirationTime('7d')
      .setIssuer('ledgerchat.org')
      .setAudience('ledgerchat.org')
      .sign(keys.privateKey);
  }

  // Fallback HS256 — secret is validated lazily here (runtime only)
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .setIssuer('ledgerchat.org')
    .setAudience('ledgerchat.org')
    .sign(getHS256SecretBytes());
};

// Every caller treats the result as a sign-in, so a token that verifies but is
// not a session (a refresh token, a retired webauthn token) is refused here.
// See lib/security/sessionClaims.ts.
export const verifyJWT = async (token: string): Promise<JWTPayload> => {
  const keys = await getEdDSAKeys();

  let payload: JWTPayload;
  // EdDSA — strict: do not downgrade if keys are configured
  if (keys) {
    ({ payload } = await jwtVerify(token, keys.publicKey, { algorithms: [alg] }));
  } else {
    // HS256 fallback — secret validated lazily (runtime only)
    ({ payload } = await jwtVerify(token, getHS256SecretBytes(), { algorithms: ['HS256'] }));
  }
  if (!isSessionPayload(payload)) throw new Error('Not a session token');
  return payload;
};
