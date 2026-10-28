import { NextResponse } from "next/server";

/**
 * Retired on 27 October 2026.
 *
 * This route moved Quantum Dots (QD), the token that never launched and was
 * retired on 23 October 2026 together with /api/aztec/airdrop. Since the
 * custodial key derivation it depended on was removed, every call fell back
 * to "Mode B": it debited an off-chain balance and returned a transaction
 * hash it had made up with SHA-256, plus an Aztec explorer link to a
 * transaction that does not exist. A payment receipt that looks real and is
 * not must never be produced, so the route now refuses every request.
 *
 * Real private transfers belong to the Aztec PXE in the client, signed by the
 * user's own keys, never to a server route.
 */

function gone() {
  return NextResponse.json(
    { error: "Gone", code: "QD_RETIRED", detail: "Humanity Ledger has no token. See /docs/overview." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

export function POST() {
  return gone();
}

export function GET() {
  return gone();
}
