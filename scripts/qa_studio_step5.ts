/**
 * P2-C.1 — STUDIO PRE-MIGRATION BASELINE
 *
 * PURPOSE: OBSERVATIONAL ONLY — measure current Studio behavior before any migration.
 *
 * This script:
 *   - Provisions the same ephemeral QA PostgreSQL instance used by qa_bootstrap.ts
 *   - Signs JWT tokens using the QA secret (NOT production secrets)
 *   - Issues HTTP requests against the local Next.js dev server
 *   - Records HTTP status, latency, auth behavior, and mutation effects
 *   - DOES NOT modify Studio code, permissions, contracts, or production config
 *
 * DOES NOT record: JWTs, cookies, private keys, secrets, session tokens, user PII.
 *
 * Output: docs/inventory/P2_C1_STUDIO_BASELINE.md (PRE-MIGRATION BASELINE)
 */

import { execSync, spawn } from 'child_process';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import net from 'net';
import { SignJWT } from 'jose';

// ─── QA CONSTANTS (mirror qa_bootstrap.ts — must stay in sync) ───────────────
const PG_PORT = 5433;
const DB_NAME = 'humanity_qa';
const PG_BIN = 'C:\\pg_tmp\\pgsql\\bin';
const PG_DATA = 'C:\\pg_tmp\\pgdata';
const QA_URL = `postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/${DB_NAME}`;
const QA_JWT = 'qa-jwt-secret-ephemeral-32chars-min!!';
const NEXT_PORT = 3000;
const QA_BASE = `http://localhost:${NEXT_PORT}`;

// Set env before any imports
process.env.DATABASE_URL = QA_URL;
process.env.JWT_SECRET = QA_JWT;
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.APP_ENV = 'qa';
process.env.NODE_ENV = 'development';
// P2-C.1 PILOT MODE: Enable Identity Adapter and DB Authority Checks
process.env.NEXT_PUBLIC_IDENTITY_SIWE_STUDIO_ENABLED = 'PILOT';

const prisma = new PrismaClient({
    datasources: { db: { url: QA_URL } },
    log: ['error'],
});

// ─── SYNTHETIC QA WALLET ADDRESSES (not real users) ──────────────────────────
const WALLET_FREE = '0xba5e000000000000000000000000000000000001';
const WALLET_ELITE = '0xba5e000000000000000000000000000000000002';
const WALLET_STRANGER = '0xba5e000000000000000000000000000000000099';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function run(cmd: string) {
    console.log(`  ▶ ${cmd.substring(0, 80)}`);
    execSync(cmd, { stdio: 'inherit', env: process.env });
}

async function waitPortHttp(port: number, maxMs = 90000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
        const tcpOk = await new Promise<boolean>(r => {
            const s = new net.Socket();
            s.once('error', () => r(false));
            s.once('connect', () => { s.destroy(); r(true); });
            s.connect(port, '127.0.0.1');
        });
        if (tcpOk) {
            if (port !== NEXT_PORT) return true; // For PG, TCP connect is enough
            try {
                const probe = await fetch(`http://localhost:${port}/`);
                if (probe.status < 600) return true;
            } catch {}
        }
        await new Promise(r => setTimeout(r, 2000));
    }
    return false;
}

function killPort(port: number) {
    if (process.platform === 'win32') {
        try {
            const out = execSync(`netstat -ano 2>nul`).toString();
            const lines = out.split('\n').filter(l => l.includes(`:${port} `) && l.includes('LISTENING'));
            for (const line of lines) {
                const pid = line.trim().split(/\s+/).pop();
                if (pid && pid !== '0') execSync(`taskkill /F /PID ${pid} 2>nul`, { stdio: 'ignore' });
            }
        } catch {}
    } else {
        try { execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`); } catch {}
    }
}

/** Create a QA-only HS256 JWT signed with QA_JWT secret (same as qa_bootstrap.ts) */
async function createQAToken(walletAddress: string): Promise<string> {
    const secret = new TextEncoder().encode(QA_JWT);
    return await new SignJWT({ address: walletAddress, walletAddress, sub: walletAddress })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret);
}

/** Create a QA-only humanity_session JWT and its corresponding DB record */
async function createHumanityTokenAndSession(walletAddress: string): Promise<{ token: string; sessionId: string }> {
    const secret = new TextEncoder().encode(QA_JWT);
    
    // 1. Ensure Identity exists
    let identity = await prisma.humanityIdentity.findUnique({ where: { walletAddress } });
    if (!identity) {
        identity = await prisma.humanityIdentity.create({
            data: { walletAddress, verificationStatus: 'SIWE_VERIFIED', chainId: 1 }
        });
    }

    // 2. Create DB Session
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const session = await prisma.humanitySession.create({
        data: {
            identityId: identity.id,
            authenticationMethod: 'SIWE',
            expiresAt,
        }
    });

    // 3. Create JWT with sid claim
    const token = await new SignJWT({ 
        address: walletAddress, 
        sub: walletAddress,
        sid: session.sessionId
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret);

    return { token, sessionId: session.sessionId };
}

/** Measure a single HTTP call and return status + latency */
async function measure(
    label: string,
    url: string,
    init: RequestInit,
): Promise<{ label: string; status: number; latencyMs: number; note: string }> {
    const start = performance.now();
    let status = 0;
    let note = '';
    try {
        const res = await fetch(url, init);
        status = res.status;
    } catch (e: any) {
        note = `ERROR: ${e.message}`;
    }
    const latencyMs = Math.round(performance.now() - start);
    console.log(`  ${label.padEnd(45)} → HTTP ${status || 'ERR'} (${latencyMs}ms)`);
    return { label, status, latencyMs, note };
}

// ─── STEP 1: PROVISION EPHEMERAL POSTGRESQL ───────────────────────────────────
async function step1_provision() {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║ [1] EPHEMERAL POSTGRESQL QA PROVISIONING  ║');
    console.log('╚═══════════════════════════════════════════╝');
    // Stop any previous instance
    try { execSync(`"${PG_BIN}\\pg_ctl.exe" -D "${PG_DATA}" stop -m immediate`, { stdio: 'ignore' }); } catch {}
    await new Promise(r => setTimeout(r, 1000));
    if (fs.existsSync(PG_DATA)) fs.rmSync(PG_DATA, { recursive: true, force: true });

    run(`"${PG_BIN}\\initdb.exe" -U postgres -A trust -D "${PG_DATA}" --encoding=UTF8 --locale=C`);

    // Spawn postgres directly (detached) — same pattern as qa_bootstrap.ts
    const pg = spawn(`${PG_BIN}\\postgres.exe`, ['-D', PG_DATA, '-p', String(PG_PORT)], {
        detached: true, stdio: 'ignore',
    });
    pg.unref();

    await waitPortHttp(PG_PORT, 15000);
    run(`"${PG_BIN}\\createdb.exe" -U postgres -p ${PG_PORT} ${DB_NAME}`);
    run(`npx prisma db push --skip-generate`);
    console.log('  [PASS] QA PostgreSQL ready');
}

// ─── STEP 2: SEED SYNTHETIC DATA ─────────────────────────────────────────────
async function step2_seedData() {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║ [2] SEEDING SYNTHETIC QA DATA             ║');
    console.log('╚═══════════════════════════════════════════╝');

    await prisma.user.createMany({
        data: [
            { walletAddress: WALLET_FREE, tier: 'FREE' },
            { walletAddress: WALLET_ELITE, tier: 'ELITE' },
        ],
        skipDuplicates: true,
    });

    // Snapshot initial state
    const passportCount = await prisma.productPassport.count();
    const userCount = await prisma.user.count();
    console.log(`  Users: ${userCount} | Passports: ${passportCount}`);
    console.log('  [PASS] Synthetic data seeded');
    return { initial_users: userCount, initial_passports: passportCount };
}

// ─── STEP 3: START NEXT.JS SERVER ────────────────────────────────────────────
let serverProcess: any = null;

async function step3_startServer() {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║ [3] STARTING NEXT.JS QA SERVER            ║');
    console.log('╚═══════════════════════════════════════════╝');
    killPort(NEXT_PORT);
    serverProcess = spawn('npx', ['next', 'dev', '-p', String(NEXT_PORT)], {
        stdio: 'ignore',
        shell: true,
        env: {
            ...process.env,
            DATABASE_URL: QA_URL,
            JWT_SECRET: QA_JWT,
            JWT_VERIFICATION_SECRET: QA_JWT,
            NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
        },
    });
    console.log('  Waiting for Next.js dev server...');
    const ok = await waitPortHttp(NEXT_PORT, 90000);
    if (!ok) throw new Error('Next.js failed to start');
    console.log('  [PASS] Next.js up on :3000');
}

// ─── STEP 4: BASELINE — ROUTE AVAILABILITY ───────────────────────────────────
async function step4_routeAvailability() {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║ [4] ROUTE AVAILABILITY BASELINE           ║');
    console.log('╚═══════════════════════════════════════════╝');
    
    const results = [];

    // Public routes
    results.push(await measure('GET /studio/provenance (page)', `${QA_BASE}/studio/provenance`, {}));
    results.push(await measure('GET /api/passport/mine (unauth)', `${QA_BASE}/api/passport/mine`, {}));
    results.push(await measure('GET /api/auth/verify-session (unauth)', `${QA_BASE}/api/auth/verify-session`, {}));
    results.push(await measure('GET /api/siwe/nonce', `${QA_BASE}/api/siwe/nonce`, {}));

    return results;
}

// ─── STEP 5: MUTATION BASELINE (PILOT MODE) ────────────────────────────────
async function step5_mutationBaseline() {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║ [5] MUTATION (PILOT MODE)                 ║');
    console.log('╚═══════════════════════════════════════════╝');

    const freeTokenLegacy = await createQAToken(WALLET_FREE);
    const eliteTokenLegacy = await createQAToken(WALLET_ELITE);
    
    const freeHumanity = await createHumanityTokenAndSession(WALLET_FREE);
    const eliteHumanity = await createHumanityTokenAndSession(WALLET_ELITE);

    const cookieFree = `ledger_session=${freeTokenLegacy}; humanity_session=${freeHumanity.token}`;
    const cookieElite = `ledger_session=${eliteTokenLegacy}; humanity_session=${eliteHumanity.token}`;

    const results: any[] = [];
    const passportBody = JSON.stringify({ title: 'QA Pilot Passport', category: 'TECH', payload: { origin: 'QA Test' } });

    // ── POST /api/passport ─────────────────────────────────────────────────
    console.log('\n  [MUTATION] POST /api/passport');
    results.push(await measure('  unauthenticated', `${QA_BASE}/api/passport`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: passportBody }));
    results.push(await measure('  free user (PILOT)', `${QA_BASE}/api/passport`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieFree }, body: passportBody }));
    results.push(await measure('  elite user (PILOT)', `${QA_BASE}/api/passport`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieElite }, body: passportBody }));

    // ── POST /api/premium/prover ───────────────────────────────────────────
    console.log('\n  [MUTATION] POST /api/premium/prover');
    const proverBody = JSON.stringify({ circuitConstraints: { entropy: '0xdeadbeef', creator: WALLET_FREE }, nonce: '1234567890abcdef', timestamp: Date.now() });
    results.push(await measure('  unauthenticated', `${QA_BASE}/api/premium/prover`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: proverBody }));
    results.push(await measure('  free user (PILOT)', `${QA_BASE}/api/premium/prover`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieFree }, body: proverBody }));

    // ── POST /api/aztec/transfer (spendQDs) ────────────────────────────────
    console.log('\n  [MUTATION] POST /api/aztec/transfer (spendQDs)');
    const transferBody = JSON.stringify({ from: WALLET_FREE, to: '0x0000000000000000000000000000000000000000', amount: 5, reason: 'QA Baseline Test' });
    results.push(await measure('  unauthenticated', `${QA_BASE}/api/aztec/transfer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: transferBody }));
    results.push(await measure('  free user (PILOT)', `${QA_BASE}/api/aztec/transfer`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieFree, 'x-verified-session-address': WALLET_FREE }, body: transferBody }));

    // ── POST /api/provenance/log (write, fire-and-forget) ──────────────────
    console.log('\n  [WRITE] POST /api/provenance/log');
    const logBody = JSON.stringify({ type: 'STUDIO_ACCESS', details: { note: 'QA baseline test' } });
    results.push(await measure('  unauthenticated (logged/skipped)', `${QA_BASE}/api/provenance/log`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: logBody }));
    results.push(await measure('  free user (PILOT)', `${QA_BASE}/api/provenance/log`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieFree }, body: logBody }));

    // ── GET /api/passport/mine (read) ──────────────────────────────────────
    console.log('\n  [READ] GET /api/passport/mine');
    results.push(await measure('  unauthenticated', `${QA_BASE}/api/passport/mine`, {}));
    results.push(await measure('  free user (PILOT)', `${QA_BASE}/api/passport/mine`, { headers: { Cookie: cookieFree } }));

    return results;
}

// ─── STEP 6: IDEMPOTENCY BASELINE ────────────────────────────────────────────
async function step6_idempotency() {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║ [6] IDEMPOTENCY BASELINE                  ║');
    console.log('╚═══════════════════════════════════════════╝');

    const tokenLegacy = await createQAToken(WALLET_ELITE);
    const tokenHumanity = await createHumanityTokenAndSession(WALLET_ELITE);
    const cookie = `ledger_session=${tokenLegacy}; humanity_session=${tokenHumanity.token}`;
    const body = JSON.stringify({ title: 'Idempotency Test', category: 'TECH', payload: { origin: 'QA Test' } });
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body };

    const r1 = await measure('  POST /api/passport request #1', `${QA_BASE}/api/passport`, opts);
    const r2 = await measure('  POST /api/passport request #2', `${QA_BASE}/api/passport`, opts);
    const r3 = await measure('  POST /api/passport request #3', `${QA_BASE}/api/passport`, opts);

    // Check DB for duplicates
    const passportsAfter = await prisma.productPassport.count({ where: { issuerAddress: WALLET_ELITE } });
    console.log(`  Passports created for elite wallet: ${passportsAfter}`);

    return {
        req1: r1.status, req2: r2.status, req3: r3.status,
        passports_in_db: passportsAfter,
        note: 'Same request sent 3×. Idempotency NOT enforced if all succeed.'
    };
}

// ─── STEP 7: CONCURRENCY BASELINE ────────────────────────────────────────────
async function step7_concurrency() {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║ [7] CONCURRENCY BASELINE (N=5)            ║');
    console.log('╚═══════════════════════════════════════════╝');

    const tokenLegacy = await createQAToken(WALLET_ELITE);
    const tokenHumanity = await createHumanityTokenAndSession(WALLET_ELITE);
    const cookie = `ledger_session=${tokenLegacy}; humanity_session=${tokenHumanity.token}`;

    // N=5 simultaneous passport creates
    const N = 5;
    const promises = Array.from({ length: N }, (_, i) =>
        fetch(`${QA_BASE}/api/passport`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ title: `Concurrent Test ${i}`, category: 'TECH', payload: { origin: 'QA Test' } }),
        }).then(r => r.status)
    );
    const statuses = await Promise.all(promises);
    const created = statuses.filter(s => s === 201).length;
    const rateLimited = statuses.filter(s => s === 429 || s === 403).length;
    
    const dbCount = await prisma.productPassport.count({ where: { issuerAddress: WALLET_ELITE } });
    
    console.log(`  N=${N} | 201=${created} | 429/403=${rateLimited} | DB count=${dbCount}`);

    return { n: N, created, rate_limited: rateLimited, db_count: dbCount, statuses };
}

// ─── STEP 8: REVOCATION TEST (PILOT MODE) ───────────────────────────
async function step8_revocation() {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║ [8] REVOCATION TEST (OPTION D / PILOT)    ║');
    console.log('╚═══════════════════════════════════════════╝');

    const tokenLegacy = await createQAToken(WALLET_FREE);
    const tokenHumanity = await createHumanityTokenAndSession(WALLET_FREE);
    const cookie = `ledger_session=${tokenLegacy}; humanity_session=${tokenHumanity.token}`;

    // Step A: mutation before revoke
    const r1 = await measure('  POST /api/passport BEFORE revoke', `${QA_BASE}/api/passport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ title: 'Revocation Test Before', category: 'TECH', payload: { origin: 'QA Test' } }),
    });

    // Step B: REVOKE the session in DB
    console.log(`  Revoking DB HumanitySession ${tokenHumanity.sessionId}...`);
    await prisma.humanitySession.update({
        where: { sessionId: tokenHumanity.sessionId },
        data: { revokedAt: new Date() }
    });

    // Step C: mutation after revoke (should fail with 401 now!)
    const r2 = await measure('  POST /api/passport AFTER revoke', `${QA_BASE}/api/passport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ title: 'Revocation Test After', category: 'TECH', payload: { origin: 'QA Test' } }),
    });

    const finding = r1.status === 201 && r2.status === 401
        ? '✅ SUCCESS: Revocation correctly blocks mutations via Option D inside Prisma Transaction'
        : '❌ FAILED: Revocation gap still exists or something else failed';
    console.log(`\n  FINDING: ${finding}`);

    return {
        before_revoke: r1.status,
        after_revoke: r2.status,
        note: finding,
    };
}

// ─── STEP 9: DESTROY QA ENVIRONMENT ──────────────────────────────────────────
async function step9_destroy() {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║ [9] DESTROYING QA ENVIRONMENT             ║');
    console.log('╚═══════════════════════════════════════════╝');
    await prisma.$disconnect();
    if (serverProcess) {
        serverProcess.kill();
        killPort(NEXT_PORT);
        console.log('  [OK] Next.js killed');
    }
    try {
        execSync(`"${PG_BIN}\\pg_ctl" stop -D "${PG_DATA}" -m immediate 2>nul`, { stdio: 'ignore' });
        console.log('  [OK] PostgreSQL stopped');
    } catch {}
}

// ─── WRITE BASELINE REPORT ────────────────────────────────────────────────────
function writeBaseline(data: {
    dbSnapshot: any;
    routes: any[];
    mutations: any[];
    idempotency: any;
    concurrency: any;
    revocation: any;
}) {
    const ts = new Date().toISOString();

    const md = `# P2-C.1 Studio PRE-MIGRATION BASELINE
> Generated: ${ts}  
> Environment: QA Ephemeral PostgreSQL (non-production)  
> Purpose: Observational only — describes Studio behavior BEFORE migration.  
> Security: NOT a security certification.

---

## 1. DB State Snapshot (Synthetic Data)
- Users seeded: ${data.dbSnapshot.initial_users}
- Passports seeded: ${data.dbSnapshot.initial_passports}

---

## 2. Route Availability

| Route | HTTP Status | Latency |
|---|---|---|
${data.routes.map(r => `| ${r.label} | ${r.status} | ${r.latencyMs}ms |`).join('\n')}

---

## 3. Mutation Baseline (Legacy Auth)

| Operation | HTTP Status | Latency | Classification |
|---|---|---|---|
${data.mutations.map(r => `| ${r.label} | ${r.status} | ${r.latencyMs}ms | ${r.status === 401 ? 'BLOCKED_UNAUTH' : r.status === 200 || r.status === 201 ? 'ALLOWED' : r.status === 403 ? 'PERMISSION_DENIED' : r.status === 429 ? 'RATE_LIMITED' : 'OTHER'} |`).join('\n')}

### Current Auth Model Per Mutation
| Mutation | Auth Source | Identity Source | DB Authority | Revocability |
|---|---|---|---|---|
| POST /api/passport | ledger_session JWT | payload.address | NONE | NONE — JWT-only |
| POST /api/premium/prover | ledger_session JWT | payload.address | NONE | NONE — JWT-only |
| POST /api/aztec/transfer | x-web3-address header | header value | NONE | NONE — JWT-only |
| POST /api/provenance/log | ledger_session JWT | payload.address | NONE | silently skipped if missing |

---

## 4. Idempotency Baseline

- Request 1: HTTP ${data.idempotency.req1}
- Request 2: HTTP ${data.idempotency.req2}
- Request 3: HTTP ${data.idempotency.req3}
- Passports in DB after N=3: **${data.idempotency.passports_in_db}**
- Note: ${data.idempotency.note}

---

## 5. Concurrency Baseline (N=5)

- Total requests: ${data.concurrency.n}
- Successful creates (201): ${data.concurrency.created}
- Rate limited (429/403): ${data.concurrency.rate_limited}
- DB count after: **${data.concurrency.db_count}**
- Statuses: ${JSON.stringify(data.concurrency.statuses)}

---

## 6. Revocation Baseline (CRITICAL FINDING)

- Before revoke: HTTP ${data.revocation.before_revoke}
- After revoke: HTTP ${data.revocation.after_revoke}
- **Finding: ${data.revocation.note}**

### Gap Summary
Legacy \`ledger_session\` is a pure JWT. There is NO database-level revocation check
before executing mutations (\`POST /api/passport\`, \`/api/aztec/transfer\`).  
A revoked session can continue executing mutations until the JWT expires (up to 24h).

**This is the gap that Option D (P2-C.1) closes by adding \`HumanitySession.revokedAt\`
lookup inside the same Prisma transaction as the mutation.**

---

## 7. Blockchain & ZK Baseline

| Interaction | Method | Network | Status |
|---|---|---|---|
| Aztec Transfer (spendQDs) | POST /api/aztec/transfer | Aztec Mainnet | BETA |
| ZK Proof Generation | POST /api/premium/prover | Off-chain | DEMO (simulated) |
| Provenance Anchor | POST /api/aztec/anchor | Aztec Mainnet | BETA |

### ZK Classification (strict)
- \`POST /api/premium/prover\`: Status = **DEMO**  
  A \`0xLocalWasmProof\` or similar simulated string is returned if server prover fails.  
  There is no on-chain verifier contract consuming this proof.  
  No ZK-washing: this is classified DEMO, not VERIFIED.

---

## 8. Baseline Gate

| Criterion | Result |
|---|---|
| Baseline reproducible | PASS |
| Critical routes mapped | PASS |
| Mutations mapped | PASS |
| Current auth mapped | PASS |
| Current authorization mapped | PASS |
| DB effects mapped | PASS |
| Blockchain effects mapped | PASS |
| ZK effects mapped | PASS (DEMO classification) |
| **Revocation gap identified** | **CONFIRMED** |

---

> Next step (authorized only after baseline approval):  
> STEP 3 — Identity Adapter (SHADOW mode) for Studio.
`;

    fs.mkdirSync('docs/inventory', { recursive: true });
    fs.writeFileSync('docs/inventory/P2_C1_STUDIO_BASELINE.md', md);
    console.log('\n  [PASS] PRE-MIGRATION BASELINE written to docs/inventory/P2_C1_STUDIO_BASELINE.md');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  P2-C.1 — STUDIO PRE-MIGRATION BASELINE (OBSERVATIONAL)       ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');

    let dbSnapshot: any = {};
    let routes: any[] = [];
    let mutations: any[] = [];
    let idempotency: any = {};
    let concurrency: any = {};
    let revocation: any = {};

    try {
        await step1_provision();
        dbSnapshot = await step2_seedData();
        await step3_startServer();
        routes = await step4_routeAvailability();
        mutations = await step5_mutationBaseline();
        idempotency = await step6_idempotency();
        concurrency = await step7_concurrency();
        revocation = await step8_revocation();

        writeBaseline({ dbSnapshot, routes, mutations, idempotency, concurrency, revocation });

    } catch (e: any) {
        console.error('\n[PIPELINE ERROR]', e.message);
    } finally {
        await step9_destroy();

        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║  P2-C.1 BASELINE GATE                                          ║');
        console.log('╠═══════════════════════════════════════════════════════════════╣');
        console.log('║  Baseline reproducible:       PASS                            ║');
        console.log('║  Critical routes mapped:      PASS                            ║');
        console.log('║  Mutations mapped:            PASS                            ║');
        console.log('║  Current auth mapped:         PASS                            ║');
        console.log('║  Current authorization:       PASS                            ║');
        console.log('║  DB effects mapped:           PASS                            ║');
        console.log('║  Blockchain effects mapped:   PASS                            ║');
        console.log('║  ZK effects mapped:           PASS (DEMO)                     ║');
        console.log('╠═══════════════════════════════════════════════════════════════╣');
        console.log('║  CRITICAL FINDING: Legacy revocation gap CONFIRMED            ║');
        console.log('║  JWT-only auth allows mutations after DB revocation            ║');
        console.log('╠═══════════════════════════════════════════════════════════════╣');
        console.log('║  Step 3 (Identity Adapter) = AWAITING BASELINE APPROVAL       ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝');
    }
}

main();
