# P2-C.1 Studio Pilot — Identity Migration Status

> Updated: 2026-08-24  
> Step: **3 (SHADOW Mode) + 4 (Authoritative Session Check) — IMPLEMENTED**  
> Security Hold: **REDUCED (active monitoring)**  
> P2-C: **PILOT — Studio only**

---

## Current Mode

```
NEXT_PUBLIC_IDENTITY_SIWE_STUDIO_ENABLED = OFF   ← deploy default (safe)
                                           SHADOW ← telemetría sin impacto
                                           PILOT  ← Option D enforced
                                           LIVE   ← migración completa
```

---

## Step 3 — Identity Adapter (Shadow Mode)

### Files Implemented

| File | Role |
|---|---|
| [`lib/security/studio-identity-adapter.ts`](../../lib/security/studio-identity-adapter.ts) | Adapter core: resolución dual, SHADOW telemetría, DB authority check |
| [`app/api/passport/route.ts`](../../app/api/passport/route.ts) | POST /api/passport integrado con adapter + Option D en tx |
| [`app/api/premium/prover/route.ts`](../../app/api/premium/prover/route.ts) | POST /api/premium/prover con adapter + Option D pre-Aztec |
| [`app/api/auth/verify-session/route.ts`](../../app/api/auth/verify-session/route.ts) | GET devuelve `humanityIdentity` suplementario |
| [`components/provenance/ProvenanceSessionGate.tsx`](../../components/provenance/ProvenanceSessionGate.tsx) | Gate client: SHADOW telemetría de mismatch |

### Shadow Mode Behaviour (mode = SHADOW)

```
1. resolveStudioIdentity() se llama al inicio de cada mutación.
2. Resuelve en paralelo: legacy getSession() + humanity_session JWT.
3. Compara direcciones. Si hay mismatch → console.warn() con ambas.
4. authorizedAddress = legacyAddress (comportamiento idéntico al anterior).
5. Cero impacto en producción para el usuario final.
```

---

## Step 4 — Authoritative Session Check (Option D)

### Implementación

```typescript
// En POST /api/passport (y /api/premium/prover):
passport = await prisma.$transaction(async (tx) => {
  // 1. Verificar sesión DB DENTRO de la transacción
  if (identity.sessionId && (identity.mode === 'PILOT' || identity.mode === 'LIVE')) {
    const sessionStillValid = await checkDbSessionValidInTx(tx, identity.sessionId, issuerAddress);
    if (!sessionStillValid) throw { code: 'SESSION_REVOKED' };
  }
  // 2. Crear passport atómicamente (misma tx)
  return tx.productPassport.create({ ... });
});
```

### Race Window: ELIMINATED

```
Baseline gap:        JWT válido → mutación ejecuta (24h ventana)
After Option D:      JWT válido → DB check dentro de tx → mutación
                     Si JWT revocado entre check y write → tx ROLLBACK
                     Race window = microsegundos (tiempo de tx DB)
```

### DB Checks ejecutados en `checkDbSessionValidInTx`

| Check | Condición de fallo |
|---|---|
| Session exists | `findUnique` devuelve null |
| Not revoked | `revokedAt !== null` |
| Not expired | `expiresAt < new Date()` |
| Identity ownership | `identity.walletAddress !== address` |

---

## Revocation Policy

| Operación | Auth Requerida | DB Check | Race Window |
|---|---|---|---|
| GET /api/passport/mine | JWT legacy | NO (lectura) | N/A |
| POST /api/passport | JWT + HumanitySession (PILOT) | Dentro de tx | Eliminada |
| POST /api/premium/prover | JWT + HumanitySession (PILOT) | Dentro de tx | Eliminada |
| POST /api/aztec/transfer | x-verified-session-address | Middleware | Reducida |
| POST /api/provenance/log | JWT legacy | NO (fire-and-forget) | N/A |

---

## ZK Anti-Washing

`POST /api/premium/prover` devuelve explícitamente `zkStatus: "DEMO"` en la respuesta hasta que se despliegue un contrato verifier real en Aztec. Esto evita que el estado se clasifique como `VERIFIED` sin evidencia on-chain.

---

## Next Step

> **Step 5 — Security + E2E + Concurrency tests** en modo SHADOW  
> Requiere autorización explícita antes de proceder.
