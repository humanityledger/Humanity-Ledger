import { NextResponse } from "next/server";

/**
 * Retired on 23 October 2026.
 *
 * Quantum Dots (QD) was a token design that never launched. Humanity Ledger has
 * no token: nothing can be bought, claimed, earned, airdropped or transferred
 * in QD, and no payment is accepted for it. This route used to credit an
 * off-chain QD balance, in one case in exchange for ETH sent to a treasury
 * address. It now refuses every request and moves nothing.
 */

function gone() {
  return NextResponse.json(
    { error: "Gone", code: "QD_RETIRED", detail: "Humanity Ledger has no token. See /docs/overview." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

export function GET() {
  return gone();
}

export function POST() {
  return gone();
}
