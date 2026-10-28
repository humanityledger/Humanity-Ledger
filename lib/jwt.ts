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
function getHS256Secret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      '[SECURITY CRITICAL] JWT_SECRET is not set. ' +
      'This error fires at request time — set JWT_SECRET in environment variables.'
    );
  }
  return secret;
}

// ─── EdDSA key cache ──────────────────────────────────────────────────────────
const migrationCutoff = process.env.JWT_MIGRATION_CUTOFF
  ? new Date(process.env.JWT_MIGRATION_CUTOFF).getTime()
  : Date.now() + 30 * 24 * 60 * 60 * 1000; // default: 30 days from now

let cachedPrivateKey: any = null;
let cachedPublicKey: any  = null;

async function getEdDSAKeys() {
  if (cachedPrivateKey && cachedPublicKey) return { privateKey: cachedPrivateKey, publicKey: cachedPublicKey };

  if (process.env.JWT_EDDSA_PRIVATE_JWK && process.env.JWT_EDDSA_PUBLIC_JWK) {
    try {
      const privJwk = JSON.parse(process.env.JWT_EDDSA_PRIVATE_JWK);
      const pubJwk  = JSON.parse(process.env.JWT_EDDSA_PUBLIC_JWK);
      cachedPrivateKey = await importJWK(privJwk, 'EdDSA');
      cachedPublicKey  = await importJWK(pubJwk,  'EdDSA');
      return { privateKey: cachedPrivateKey, publicKey: cachedPublicKey };
    } catch (parseErr) {
      console.warn(
        '[JWT] JWT_EDDSA_*_JWK env var is malformed or invalid JSON. Falling back to HS256.',
        parseErr instanceof SyntaxError ? parseErr.message : ''
      );
      cachedPrivateKey = null;
      cachedPublicKey  = null;
      return null;
    }
  }
  return null;
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
      .setIssuer('humanidfi.com')
      .setAudience('humanidfi.com')
      .sign(keys.privateKey);
  }

  // Fallback HS256 — secret is validated lazily here (runtime only)
  const secret = getHS256Secret();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .setIssuer('humanidfi.com')
    .setAudience('humanidfi.com')
    .sign(new TextEncoder().encode(secret));
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
    const secret = getHS256Secret();
    ({ payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] }));
  }
  if (!isSessionPayload(payload)) throw new Error('Not a session token');
  return payload;
};
